import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PdfSection {
  identificacao?: { nome?: string; idade?: string; sexo?: string };
  queixa?: string;
  hda?: string;
  exame_fisico?: string;
  hipoteses?: { principal?: string; diferencial?: string };
  conduta?: string;
  cid10?: string[];
  embasamento_teorico?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== AUTH =====
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwtMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!jwtMatch) {
      return new Response(JSON.stringify({ error: 'Formato de token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtMatch[1]);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { laudo_id } = await req.json();
    if (!laudo_id) throw new Error('ID do laudo não fornecido');

    // ===== RATE LIMITING =====
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentExports } = await supabase
      .from('laudos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('pdf_hash', 'is', null)
      .gte('updated_at', oneMinuteAgo);

    if (recentExports !== null && recentExports >= 10) {
      return new Response(JSON.stringify({
        error: 'Limite de exportações atingido. Aguarde 1 minuto.',
        retry_after: 60,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    console.log('[export-pdf] Starting export:', { laudo_id, uid: user.id.substring(0, 8) });

    // Buscar laudo
    const { data: laudo, error: laudoError } = await supabase
      .from('laudos')
      .select('*')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (laudoError || !laudo) throw new Error('Laudo não encontrado');

    // Buscar perfil do médico
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Build sections from individual fields if sections is empty
    let sections = laudo.sections as PdfSection || {};
    const isSectionsEmpty = !sections.hipoteses?.principal && !sections.conduta;
    
    if (isSectionsEmpty) {
      const hypotheses = laudo.hypotheses as any;
      const conducts = laudo.conducts as any;
      const patientData = laudo.patient_data as any;
      const cid10 = laudo.cid10_codes as any;
      const reportMd = laudo.report_markdown as string;
      
      sections = {
        identificacao: {
          nome: patientData?.iniciais || patientData?.nome || 'Não informado',
          idade: patientData?.idade ? String(patientData.idade) : 'N/I',
          sexo: patientData?.sexo || 'N/I',
        },
        queixa: laudo.clinical_context?.chief_complaint || '',
        hda: laudo.summary?.resumo_clinico || '',
        exame_fisico: laudo.clinical_context?.exam_findings || '',
        hipoteses: {
          principal: hypotheses?.mais_provavel?.descricao || laudo.diagnosis_main || '',
          diferencial: hypotheses?.menos_provavel?.descricao || laudo.diagnosis_diff || '',
        },
        conduta: Array.isArray(conducts) ? conducts.join('\n• ') : (typeof conducts === 'string' ? conducts : ''),
        cid10: Array.isArray(cid10) ? cid10 : [],
        embasamento_teorico: typeof laudo.hypotheses?.embasamento_teorico === 'object' 
          ? (laudo.hypotheses.embasamento_teorico.fundamentacao || '') 
          : '',
      };
      
      if (!sections.hipoteses?.principal && reportMd) {
        sections.hipoteses = { principal: 'Ver laudo completo em anexo', diferencial: '' };
        sections.conduta = sections.conduta || 'Ver laudo completo em anexo';
      }
    }

    // Validate
    if (!sections.hipoteses?.principal && !laudo.report_markdown) {
      throw new Error('Laudo incompleto: gere o laudo antes de exportar o PDF');
    }

    // Gerar hash
    const contentForHash = JSON.stringify({
      id: laudo.id, sections, user_id: user.id,
      timestamp: new Date().toISOString()
    });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentForHash));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Token de verificação
    const verifyToken = btoa(JSON.stringify({
      id: laudo.id, hash, exp: Date.now() + (90 * 24 * 60 * 60 * 1000)
    }));

    // Gerar HTML
    const html = generatePdfHtml(laudo, sections, profile, hash, verifyToken);

    const pdfData = { html, fileName: `laudo-${laudo.id}-${Date.now()}.pdf`, hash, verifyToken };

    // Atualizar laudo com hash
    await adminClient.from('laudos').update({
      pdf_hash: hash, pdf_verify_token: verifyToken
    }).eq('id', laudo.id);

    // Audit log
    try {
      await supabase.rpc('log_audit_action', {
        p_entity: 'REPORT', p_entity_id: laudo.id, p_action: 'EXPORT',
        p_diff: { hash, timestamp: new Date().toISOString() }
      });
    } catch (e) {
      console.warn('Audit log failed:', e);
    }

    console.log('PDF gerado com sucesso:', laudo.id);

    return new Response(JSON.stringify(pdfData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    const errorId = crypto.randomUUID();
    console.error('Error ID:', errorId, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro ao processar exportação',
      error_id: errorId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generatePdfHtml(
  laudo: any, sections: PdfSection, profile: any,
  hash: string, verifyToken: string
): string {
  const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '');
  const verifyUrl = `${baseUrl}/functions/v1/verify-pdf/${laudo.id}?token=${verifyToken}`;
  
  const logoHtml = profile?.logo_url 
    ? `<img src="${profile.logo_url}" alt="Logo" style="max-height: 60px; max-width: 180px; object-fit: contain;" />`
    : '';
    
  const signatureHtml = profile?.signature_image_url
    ? `<img src="${profile.signature_image_url}" alt="Assinatura" style="max-height: 50px; max-width: 180px; object-fit: contain;" />`
    : '';

  const doctorName = profile?.full_name || 'Médico Responsável';
  const doctorCrm = profile?.crm || '';
  const doctorCrmUf = profile?.crm_uf || '';
  const doctorSpecialty = profile?.specialty || '';
  const clinicName = profile?.clinic_name || '';
  const doctorPhone = profile?.phone || '';
  const doctorEmail = profile?.email_public || '';
  const doctorAddress = profile?.address || '';

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const redFlags = laudo.red_flags as string[] | null;
  const complementaryExams = laudo.complementary_exams as string[] | null;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
      font-size: 9.5pt; 
      line-height: 1.55; 
      color: #1e293b; 
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 22mm 30mm 22mm;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      margin-bottom: 18px;
      border-bottom: 2.5px solid #1e40af;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .brand-mark {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 18px; font-weight: 800;
    }
    .brand-text h1 {
      font-size: 18pt; font-weight: 800; color: #1e40af;
      letter-spacing: -0.5px; line-height: 1.1;
    }
    .brand-text p {
      font-size: 7pt; color: #64748b; font-weight: 500;
      letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px;
    }

    /* ── Doctor Bar ── */
    .doctor-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 18px;
    }
    .doctor-bar .name {
      font-size: 11pt; font-weight: 700; color: #0f172a; margin-bottom: 2px;
    }
    .doctor-bar .meta {
      font-size: 8pt; color: #475569; line-height: 1.6;
    }
    .doctor-bar .meta span { margin-right: 14px; }
    .doctor-bar .contact {
      text-align: right; font-size: 7.5pt; color: #64748b; line-height: 1.7;
    }

    /* ── Document Title ── */
    .doc-title {
      text-align: center;
      font-size: 13pt;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 18px;
      padding: 8px 0;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }

    /* ── Patient + Meta Grid ── */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .meta-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .meta-card-header {
      background: #f1f5f9;
      padding: 6px 12px;
      font-size: 7.5pt;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta-card-body {
      padding: 10px 12px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 8.5pt;
      border-bottom: 1px dotted #f1f5f9;
    }
    .meta-row:last-child { border-bottom: none; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 600; text-align: right; }

    /* ── Sections ── */
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .section-title .icon {
      width: 22px; height: 22px;
      background: #1e40af;
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; flex-shrink: 0;
    }
    .section-title h2 {
      font-size: 10pt; font-weight: 700; color: #1e3a8a;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .section-body {
      padding: 10px 14px;
      background: #fafbfd;
      border: 1px solid #e8ecf2;
      border-radius: 6px;
      font-size: 9.5pt;
      line-height: 1.65;
      text-align: justify;
    }

    /* ── Hypothesis highlight ── */
    .hypothesis-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .hypothesis-card.primary {
      border-color: #3b82f6;
    }
    .hypothesis-label {
      padding: 5px 12px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .hypothesis-card.primary .hypothesis-label {
      background: #1e40af; color: #fff;
    }
    .hypothesis-card.secondary .hypothesis-label {
      background: #f1f5f9; color: #475569;
    }
    .hypothesis-value {
      padding: 10px 14px;
      font-size: 10pt;
      font-weight: 600;
      color: #0f172a;
    }

    /* ── CID Tags ── */
    .cid-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .cid-tag {
      display: inline-block;
      padding: 3px 10px;
      background: #1e40af;
      color: #fff;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    /* ── Red Flags ── */
    .red-flags {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #dc2626;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .red-flags h3 {
      font-size: 8.5pt; font-weight: 700; color: #991b1b;
      text-transform: uppercase; margin-bottom: 6px;
    }
    .red-flags li {
      font-size: 9pt; color: #7f1d1d; margin: 3px 0; list-style: none;
    }
    .red-flags li::before { content: "⚠ "; }

    /* ── Complementary Exams ── */
    .exams-list {
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
    }
    .exams-list li {
      font-size: 9pt; color: #166534; margin: 3px 0; list-style: none;
    }
    .exams-list li::before { content: "→ "; color: #16a34a; font-weight: 700; }

    /* ── Embasamento ── */
    .embasamento {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 9pt;
      color: #0c4a6e;
      line-height: 1.6;
    }

    /* ── Signature ── */
    .signature-area {
      margin-top: 36px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-inner {
      display: inline-block;
      min-width: 260px;
      text-align: center;
    }
    .signature-line {
      width: 100%;
      border-top: 1.5px solid #1e3a8a;
      margin: 8px 0;
    }
    .signature-name {
      font-size: 10pt; font-weight: 700; color: #1e3a8a;
    }
    .signature-detail {
      font-size: 8pt; color: #475569;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 7pt;
      color: #94a3b8;
    }
    .footer-left p { margin: 2px 0; }
    .footer-right {
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .footer-right p { margin: 1px 0; font-size: 6.5pt; }
    .hash-code {
      font-family: 'Courier New', monospace;
      font-size: 5.5pt;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      margin-top: 4px;
      display: inline-block;
      word-break: break-all;
    }
    .watermark {
      position: fixed;
      bottom: 8px;
      right: 12px;
      font-size: 6pt;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="brand-mark">M</div>
        <div class="brand-text">
          <h1>MindMed</h1>
          <p>Laudos Médicos Inteligentes</p>
        </div>
      </div>
      <div>${logoHtml}</div>
    </div>

    <!-- Doctor Bar -->
    <div class="doctor-bar">
      <div>
        <div class="name">Dr(a). ${doctorName}</div>
        <div class="meta">
          ${doctorCrm ? `<span>CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</span>` : ''}
          ${doctorSpecialty ? `<span>${doctorSpecialty}</span>` : ''}
          ${clinicName ? `<span>${clinicName}</span>` : ''}
        </div>
      </div>
      <div class="contact">
        ${doctorPhone ? `<div>${doctorPhone}</div>` : ''}
        ${doctorEmail ? `<div>${doctorEmail}</div>` : ''}
        ${doctorAddress ? `<div>${doctorAddress}</div>` : ''}
      </div>
    </div>

    <!-- Document Title -->
    <div class="doc-title">Laudo Médico</div>

    <!-- Patient + Document Info -->
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-card-header">Dados do Paciente</div>
        <div class="meta-card-body">
          <div class="meta-row"><span class="label">Nome / Iniciais</span><span class="value">${sections.identificacao?.nome || 'Não informado'}</span></div>
          <div class="meta-row"><span class="label">Idade</span><span class="value">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</span></div>
          <div class="meta-row"><span class="label">Sexo</span><span class="value">${sections.identificacao?.sexo || 'N/I'}</span></div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-card-header">Informações do Documento</div>
        <div class="meta-card-body">
          <div class="meta-row"><span class="label">Data</span><span class="value">${dateFormatted}</span></div>
          <div class="meta-row"><span class="label">Hora</span><span class="value">${timeFormatted}</span></div>
          <div class="meta-row"><span class="label">Especialidade</span><span class="value">${laudo.specialty || doctorSpecialty || 'N/I'}</span></div>
        </div>
      </div>
    </div>

    <!-- Queixa Principal -->
    ${sections.queixa ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">Q</div>
        <h2>Queixa Principal</h2>
      </div>
      <div class="section-body">${sections.queixa}</div>
    </div>` : ''}

    <!-- HDA -->
    ${sections.hda ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">H</div>
        <h2>História da Doença Atual</h2>
      </div>
      <div class="section-body">${sections.hda}</div>
    </div>` : ''}

    <!-- Exame Físico -->
    ${sections.exame_fisico ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">E</div>
        <h2>Exame Físico / Achados</h2>
      </div>
      <div class="section-body">${sections.exame_fisico}</div>
    </div>` : ''}

    <!-- Hipóteses -->
    <div class="section">
      <div class="section-title">
        <div class="icon">D</div>
        <h2>Hipóteses Diagnósticas</h2>
      </div>
      ${sections.hipoteses?.principal ? `
      <div class="hypothesis-card primary">
        <div class="hypothesis-label">Hipótese Principal</div>
        <div class="hypothesis-value">${sections.hipoteses.principal}</div>
      </div>` : ''}
      ${sections.hipoteses?.diferencial ? `
      <div class="hypothesis-card secondary">
        <div class="hypothesis-label">Diagnóstico Diferencial</div>
        <div class="hypothesis-value">${sections.hipoteses.diferencial}</div>
      </div>` : ''}
    </div>

    <!-- CID-10 -->
    ${sections.cid10 && sections.cid10.length > 0 ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">C</div>
        <h2>Classificação CID-10</h2>
      </div>
      <div class="cid-row">
        ${sections.cid10.map(c => `<span class="cid-tag">${c}</span>`).join('')}
      </div>
    </div>` : ''}

    <!-- Red Flags -->
    ${redFlags && redFlags.length > 0 ? `
    <div class="red-flags">
      <h3>Sinais de Alerta (Red Flags)</h3>
      <ul>${redFlags.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>` : ''}

    <!-- Conduta -->
    ${sections.conduta ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">P</div>
        <h2>Conduta / Plano Terapêutico</h2>
      </div>
      <div class="section-body">${sections.conduta.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <!-- Exames Complementares -->
    ${complementaryExams && complementaryExams.length > 0 ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">X</div>
        <h2>Exames Complementares Solicitados</h2>
      </div>
      <div class="exams-list">
        <ul>${complementaryExams.map(e => `<li>${e}</li>`).join('')}</ul>
      </div>
    </div>` : ''}

    <!-- Embasamento Teórico -->
    ${sections.embasamento_teorico ? `
    <div class="section">
      <div class="section-title">
        <div class="icon">R</div>
        <h2>Embasamento Teórico</h2>
      </div>
      <div class="embasamento">${sections.embasamento_teorico}</div>
    </div>` : ''}

    <!-- Assinatura -->
    <div class="signature-area">
      <div class="signature-inner">
        ${signatureHtml}
        <div class="signature-line"></div>
        <div class="signature-name">Dr(a). ${doctorName}</div>
        ${doctorCrm ? `<div class="signature-detail">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</div>` : ''}
        ${doctorSpecialty ? `<div class="signature-detail">${doctorSpecialty}</div>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        <p><strong>Documento gerado por MindMed</strong> — Laudos Médicos com IA</p>
        <p>Informações protegidas pela LGPD (Lei nº 13.709/2018)</p>
        <p>ID: ${laudo.id}</p>
      </div>
      <div class="footer-right">
        <p><strong>Verificação Digital</strong></p>
        <p>📱 [QR Code seria gerado aqui]</p>
        <div class="hash-code">${hash.substring(0, 32)}...</div>
      </div>
    </div>

  </div>
  <div class="watermark">MindMed © ${new Date().getFullYear()}</div>
</body>
</html>
  `.trim();
}
