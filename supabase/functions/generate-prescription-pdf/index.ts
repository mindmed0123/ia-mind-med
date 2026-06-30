import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    const jwt = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await userClient.auth.getClaims(jwt);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claims.claims.sub as string;

    const { prescription_id } = await req.json();

    // Fetch through user client so RLS enforces ownership
    const { data: prescription, error: prescError } = await userClient
      .from('prescriptions')
      .select('*')
      .eq('id', prescription_id)
      .maybeSingle();

    if (prescError || !prescription || prescription.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Receituário não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Doctor profile through user client (RLS allows reading own profile)
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('*')
      .eq('id', prescription.user_id)
      .maybeSingle();


    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
    }

    // Gerar HTML do receituário
    const html = generatePrescriptionHTML(prescription, profile);

    // Aqui você integraria com um serviço de geração de PDF
    // Por enquanto, vamos retornar uma mensagem de sucesso
    // Em produção, use um serviço como Puppeteer, PDFKit ou similar

    console.log('PDF gerado para receituário:', prescription_id);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: 'https://example.com/prescription.pdf', // URL temporária
        html: html
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// ─────────────────────────────────────────────────────────────
// Classificação de receitas (espelha src/lib/receita-classifier.ts)
// ─────────────────────────────────────────────────────────────
type TipoReceita =
  | 'branca_comum'
  | 'antimicrobiano'
  | 'controle_especial'
  | 'azul_b'
  | 'amarela_a';

const TIPO_LABEL: Record<TipoReceita, string> = {
  branca_comum: 'Receita Comum (Branca)',
  antimicrobiano: 'Receita de Antimicrobiano (Branca — 2 vias)',
  controle_especial: 'Receita de Controle Especial (Branca — 2 vias)',
  azul_b: 'Notificação de Receita B (Azul)',
  amarela_a: 'Notificação de Receita A (Amarela)',
};

const TIPO_HEADER_COLOR: Record<TipoReceita, string> = {
  branca_comum: '#1e40af',
  antimicrobiano: '#7c2d12',
  controle_especial: '#581c87',
  azul_b: '#1e3a8a',
  amarela_a: '#854d0e',
};

const TIPO_BG: Record<TipoReceita, string> = {
  branca_comum: '#ffffff',
  antimicrobiano: '#fffbeb',
  controle_especial: '#faf5ff',
  azul_b: '#eff6ff',
  amarela_a: '#fefce8',
};

function isControlado(t: TipoReceita): boolean {
  return t === 'antimicrobiano' || t === 'controle_especial' || t === 'azul_b' || t === 'amarela_a';
}

function inferTipoReceita(item: any): TipoReceita {
  const raw = (item.tipo_receita || '').toString().toLowerCase();
  if (raw === 'branca_comum' || raw === 'antimicrobiano' || raw === 'controle_especial' || raw === 'azul_b' || raw === 'amarela_a') {
    return raw as TipoReceita;
  }
  const tarja = (item.tarja || '').toString().toLowerCase();
  if (tarja.includes('amarela')) return 'amarela_a';
  if (tarja.includes('preta') || tarja.includes('azul')) return 'azul_b';
  if (tarja.includes('vermelha')) {
    const nome = (item.medicamento || '').toLowerCase();
    if (/(amoxicilina|azitromicina|cefalexina|ciprofloxa|levofloxa|claritromic|sulfameto|metronidazol|nitrofurantoína|nitrofurantoina|clindamicina|doxiciclina|ampicilina|penicilina)/.test(nome)) {
      return 'antimicrobiano';
    }
    return 'controle_especial';
  }
  return 'branca_comum';
}

function groupByReceita(items: any[]): Array<{ tipo: TipoReceita; items: any[] }> {
  const map = new Map<TipoReceita, any[]>();
  for (const it of items) {
    const t = inferTipoReceita(it);
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(it);
  }
  const order: TipoReceita[] = ['branca_comum', 'antimicrobiano', 'controle_especial', 'azul_b', 'amarela_a'];
  return order.filter(t => map.has(t)).map(t => ({ tipo: t, items: map.get(t)! }));
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────
function generatePrescriptionHTML(prescription: any, profile: any): string {
  const items = Array.isArray(prescription.items) ? prescription.items : [];
  const groups = groupByReceita(items);
  const patientAge = prescription.patient_dob
    ? new Date().getFullYear() - new Date(prescription.patient_dob).getFullYear()
    : null;

  const hasPartner = items.some((i: any) => i.parceiro);
  const dataFmt = new Date(prescription.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const renderHeader = (tipo: TipoReceita) => `
    <div class="header" style="border-bottom-color:${TIPO_HEADER_COLOR[tipo]};">
      ${profile?.logo_url ? `<img src="${esc(profile.logo_url)}" alt="Logo">` : ''}
      <h1 style="color:${TIPO_HEADER_COLOR[tipo]};">${esc(profile?.full_name || 'Médico')}</h1>
      <div class="doctor-info">
        ${profile?.crm && profile?.crm_uf ? `<p style="font-weight:600;color:${TIPO_HEADER_COLOR[tipo]};">CRM: ${esc(profile.crm)}/${esc(profile.crm_uf)}</p>` : ''}
        ${profile?.specialty ? `<p>${esc(profile.specialty)}</p>` : ''}
        ${profile?.clinic_name ? `<p style="margin-top:6px;font-weight:500;">${esc(profile.clinic_name)}</p>` : ''}
        ${profile?.address ? `<p>${esc(profile.address)}</p>` : ''}
        ${profile?.phone ? `<p>${esc(profile.phone)}</p>` : ''}
      </div>
    </div>
  `;

  const renderPatient = () => `
    <div class="patient-info">
      <h2>Identificação do Paciente</h2>
      <p><strong>Nome:</strong> ${esc(prescription.patient_name)}</p>
      ${patientAge ? `<p><strong>Idade:</strong> ${patientAge} anos</p>` : ''}
      ${prescription.patient_sex ? `<p><strong>Sexo:</strong> ${esc(prescription.patient_sex)}</p>` : ''}
      ${prescription.patient_id_external ? `<p><strong>Prontuário:</strong> ${esc(prescription.patient_id_external)}</p>` : ''}
    </div>
    <div class="date">${dataFmt}</div>
  `;

  const renderItems = (groupItems: any[]) => `
    <div class="prescription-symbol">℞</div>
    <div class="medications">
      ${groupItems.map((item: any, index: number) => `
        <div class="medication-item">
          <h3>${index + 1}. ${esc(item.medicamento)}
            ${item.parceiro ? `<span class="partner-tag">${esc(item.parceiro)}</span>` : ''}
          </h3>
          <p><strong>Dosagem:</strong> ${esc(item.dosagem)}</p>
          <p><strong>Posologia:</strong> ${esc(item.posologia)}</p>
          ${item.duracao ? `<p><strong>Duração:</strong> ${esc(item.duracao)}</p>` : ''}
          ${item.observacoes ? `<p><strong>Observações:</strong> ${esc(item.observacoes)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  const renderSignature = () => `
    ${prescription.notes ? `<div class="footer-text"><strong>Observações Gerais:</strong><br>${esc(prescription.notes)}</div>` : ''}
    ${profile?.prescription_footer_text ? `<div class="footer-text">${esc(profile.prescription_footer_text)}</div>` : ''}
    <div class="signature-section">
      ${profile?.signature_image_url ? `<img src="${esc(profile.signature_image_url)}" alt="Assinatura">` : `<div class="signature-line"></div>`}
      <p>${esc(profile?.full_name || 'Médico')}</p>
      ${profile?.crm && profile?.crm_uf ? `<p style="font-size:10pt;color:#64748b;">CRM: ${esc(profile.crm)}/${esc(profile.crm_uf)}</p>` : ''}
    </div>
    <div class="qr-block">
      <div class="qr-img">📱 [QR Code seria gerado aqui]</div>
      <div class="qr-text">
        Verifique a autenticidade<br>
        <span class="qr-id">ID: ${esc(prescription.id?.toString().slice(0, 8) || '')}</span>
      </div>
    </div>
    ${profile?.stamp_image_url ? `<div class="stamp"><img src="${esc(profile.stamp_image_url)}" alt="Carimbo"></div>` : ''}
  `;

  const renderPage = (tipo: TipoReceita, groupItems: any[], via?: string) => `
    <section class="page" style="background:${TIPO_BG[tipo]};">
      <div class="tipo-banner" style="background:${TIPO_HEADER_COLOR[tipo]};">
        ${esc(TIPO_LABEL[tipo])}${via ? ` · ${esc(via)}` : ''}
      </div>
      ${renderHeader(tipo)}
      ${renderPatient()}
      ${renderItems(groupItems)}
      ${renderSignature()}
      <div class="footer-mini">Receituário emitido por MindMed · Documento válido com assinatura e carimbo do médico</div>
    </section>
  `;

  const pages: string[] = [];
  for (const g of groups) {
    if (isControlado(g.tipo)) {
      pages.push(renderPage(g.tipo, g.items, '1ª via — Farmácia'));
      pages.push(renderPage(g.tipo, g.items, '2ª via — Paciente'));
    } else {
      pages.push(renderPage(g.tipo, g.items));
    }
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 1.5cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1f2937; }
  .page { padding: 8px 12px 24px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .tipo-banner {
    color: #fff; text-align: center; padding: 8px 12px;
    font-weight: 700; font-size: 11pt; letter-spacing: 0.5px;
    border-radius: 6px; margin-bottom: 16px; text-transform: uppercase;
  }
  .header {
    text-align: center; padding: 16px; margin-bottom: 20px;
    background: #f8fafc; border-radius: 10px; border-bottom: 3px solid #1e40af;
  }
  .header img { max-width: 140px; max-height: 80px; margin-bottom: 10px; border-radius: 6px; }
  .header h1 { font-size: 18pt; margin: 8px 0 6px; font-weight: 700; }
  .doctor-info { font-size: 10pt; color: #64748b; }
  .doctor-info p { margin: 2px 0; }
  .patient-info {
    background: #f0fdf4; padding: 14px 16px; margin: 16px 0;
    border-left: 4px solid #10b981; border-radius: 6px;
  }
  .patient-info h2 { font-size: 12pt; margin-bottom: 8px; color: #065f46; }
  .patient-info p { margin: 4px 0; }
  .patient-info strong { color: #047857; min-width: 90px; display: inline-block; }
  .date { text-align: right; margin: 8px 0 16px; font-size: 10pt; color: #475569; font-weight: 500; }
  .prescription-symbol {
    font-size: 44pt; font-weight: bold; color: #1e40af;
    margin: 12px 0 8px; text-align: center;
  }
  .medications { margin: 16px 0; }
  .medication-item {
    margin-bottom: 14px; padding: 14px 16px;
    border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #ffffff; page-break-inside: avoid;
  }
  .medication-item h3 {
    font-size: 12.5pt; color: #1e40af; margin-bottom: 8px; font-weight: 700;
    padding-bottom: 6px; border-bottom: 1.5px solid #dbeafe;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .medication-item p { margin: 4px 0; padding-left: 6px; }
  .medication-item strong { color: #1e3a8a; min-width: 90px; display: inline-block; font-weight: 600; }
  .partner-tag {
    font-size: 8pt; padding: 2px 8px; border-radius: 999px;
    background: #dbeafe; color: #1e40af; font-weight: 600;
    border: 1px solid #93c5fd;
  }
  .footer-text {
    margin-top: 16px; padding: 10px 14px;
    background: #fefce8; border: 1.5px solid #fbbf24; border-radius: 6px;
    font-size: 9.5pt; color: #92400e;
  }
  .signature-section {
    margin-top: 40px; text-align: center; page-break-inside: avoid;
  }
  .signature-section img { max-width: 180px; max-height: 70px; margin: 8px 0; }
  .signature-line { width: 320px; border-top: 1.5px solid #1e3a8a; margin: 36px auto 8px; }
  .signature-section p { margin: 3px 0; color: #1e40af; font-weight: 600; }
  .stamp { text-align: center; margin-top: 16px; }
  .stamp img { max-width: 140px; max-height: 140px; border-radius: 6px; }
  .qr-block {
    margin-top: 20px; display: flex; align-items: center; justify-content: center;
    gap: 12px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px;
    page-break-inside: avoid;
  }
  .qr-img img { width: 90px; height: 90px; }
  .qr-text { font-size: 8.5pt; color: #475569; text-align: left; line-height: 1.4; }
  .qr-id { font-family: 'Courier New', monospace; font-size: 8pt; color: #1e293b; }
  .footer-mini {
    margin-top: 20px; text-align: center; font-size: 8pt; color: #94a3b8;
    padding-top: 10px; border-top: 1px solid #e2e8f0;
  }
</style>
</head>
<body>
  ${pages.join('\n')}
  ${hasPartner ? `
    <div style="display:none;">Parceiros: ${items.filter((i: any) => i.parceiro).map((i: any) => esc(i.parceiro)).join(', ')}</div>
  ` : ''}
</body>
</html>
  `.trim();
}

