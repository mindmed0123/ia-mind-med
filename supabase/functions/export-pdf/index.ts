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
  const logoHtml = profile?.logo_url 
    ? `<img src="${profile.logo_url}" alt="Logo" class="header-logo-img" />`
    : '';
    
  const signatureHtml = profile?.signature_image_url
    ? `<img src="${profile.signature_image_url}" alt="Assinatura" class="sig-img" />`
    : '';

  const stampHtml = profile?.stamp_image_url
    ? `<img src="${profile.stamp_image_url}" alt="Carimbo" class="stamp-img" />`
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
  const dateShort = now.toLocaleDateString('pt-BR');

  const redFlags = laudo.red_flags as string[] | null;
  const complementaryExams = laudo.complementary_exams as string[] | null;

  const formatContent = (text: string) => text.replace(/\n/g, '<br>');

  // Build clinical sections
  const buildSection = (num: string, title: string, content: string, accent = '#0B3D6B') => {
    if (!content) return '';
    return `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:${accent};">${num}</div>
        <h2 class="section-title">${title}</h2>
        <div class="section-line"></div>
      </div>
      <div class="section-body">${formatContent(content)}</div>
    </div>`;
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Merriweather:wght@700;900&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.65;
    color: #1E293B;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 0;
    position: relative;
  }

  /* ════════════════ GOLD ACCENT BAR ════════════════ */
  .top-accent {
    height: 5px;
    background: linear-gradient(90deg, #0B3D6B 0%, #1565A8 35%, #C7944A 65%, #D4A84B 100%);
  }

  /* ════════════════ HEADER ════════════════ */
  .header {
    padding: 20px 32px 16px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .header-logo-img {
    max-height: 50px;
    max-width: 150px;
    object-fit: contain;
  }
  .logo-mark {
    width: 46px; height: 46px;
    background: linear-gradient(145deg, #0B3D6B 0%, #1565A8 100%);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    box-shadow: 0 2px 8px rgba(11,61,107,0.25);
  }
  .logo-mark span {
    color: #fff; font-weight: 800; font-size: 22px;
    font-family: 'Merriweather', serif;
  }
  .logo-mark::after {
    content: '';
    position: absolute; bottom: -2px; right: -2px;
    width: 14px; height: 14px;
    background: #D4A84B;
    border-radius: 50%;
    border: 2px solid #fff;
  }
  .brand-name {
    font-family: 'Merriweather', serif;
    font-size: 18pt; font-weight: 900; color: #0B3D6B;
    letter-spacing: -0.5px; line-height: 1.1;
  }
  .brand-sub {
    font-size: 7pt; color: #94A3B8; font-weight: 600;
    letter-spacing: 2.5px; text-transform: uppercase; margin-top: 2px;
  }
  .header-right {
    text-align: right;
    font-size: 8.5pt; color: #475569;
    line-height: 1.65;
  }
  .doc-name {
    font-size: 12pt; font-weight: 700; color: #0B3D6B;
  }
  .doc-crm {
    font-weight: 600; color: #1565A8; font-size: 9pt;
  }
  .doc-detail {
    font-size: 8pt; color: #64748B;
  }

  .header-line {
    height: 1.5px;
    background: linear-gradient(90deg, #0B3D6B, #CBD5E1 70%, transparent);
    margin: 0 32px;
  }

  /* ════════════════ PATIENT CARD ════════════════ */
  .patient-card {
    margin: 18px 32px 0 32px;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    overflow: hidden;
  }
  .patient-card-header {
    background: linear-gradient(135deg, #0B3D6B 0%, #1565A8 100%);
    padding: 8px 20px;
    display: flex; align-items: center; gap: 8px;
  }
  .patient-card-header span {
    color: #fff; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px;
  }
  .patient-card-header .icon-user {
    width: 16px; height: 16px;
    background: rgba(255,255,255,0.2); border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 9px; font-weight: 700;
  }
  .patient-card-body {
    padding: 14px 20px;
    background: #F8FAFC;
  }
  .patient-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 48px;
  }
  .pf { display: flex; align-items: baseline; gap: 8px; font-size: 9.5pt; }
  .pf .lbl { color: #64748B; font-weight: 600; min-width: 110px; }
  .pf .val { color: #0F172A; font-weight: 500; }

  /* ════════════════ DOCUMENT TITLE ════════════════ */
  .doc-title {
    margin: 22px 32px 20px 32px;
    text-align: center;
    position: relative;
    padding: 12px 0;
  }
  .doc-title::before, .doc-title::after {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, #CBD5E1 20%, #CBD5E1 80%, transparent);
  }
  .doc-title::before { top: 0; }
  .doc-title::after { bottom: 0; }
  .doc-title h2 {
    font-family: 'Merriweather', serif;
    font-size: 13pt; font-weight: 700; color: #0B3D6B;
    letter-spacing: 4px; text-transform: uppercase;
  }
  .doc-title .title-accent {
    width: 40px; height: 3px;
    background: linear-gradient(90deg, #C7944A, #D4A84B);
    margin: 8px auto 0; border-radius: 2px;
  }

  /* ════════════════ SECTIONS ════════════════ */
  .sections-wrapper {
    padding: 0 32px;
  }
  .section {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .section-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .section-num {
    width: 26px; height: 26px;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 11px; font-weight: 700;
    flex-shrink: 0;
  }
  .section-title {
    font-size: 10pt; font-weight: 700; color: #0B3D6B;
    text-transform: uppercase; letter-spacing: 0.8px;
    white-space: nowrap;
  }
  .section-line {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, #CBD5E1, transparent);
    margin-left: 8px;
  }
  .section-body {
    padding: 8px 0 8px 36px;
    font-size: 10pt; line-height: 1.75;
    color: #334155;
    text-align: justify;
  }

  /* ════════════════ DIAGNOSIS ════════════════ */
  .dx-group { margin-bottom: 16px; page-break-inside: avoid; }
  .dx-card {
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .dx-card.main {
    border: 2px solid #0B3D6B;
    box-shadow: 0 2px 8px rgba(11,61,107,0.08);
  }
  .dx-card.diff { border: 1px solid #E2E8F0; }
  .dx-label {
    padding: 6px 16px;
    font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px;
  }
  .dx-card.main .dx-label {
    background: linear-gradient(135deg, #0B3D6B, #1565A8);
    color: #fff;
  }
  .dx-card.diff .dx-label {
    background: #F1F5F9; color: #64748B;
    border-bottom: 1px solid #E2E8F0;
  }
  .dx-body {
    padding: 12px 16px;
    font-size: 10.5pt; font-weight: 600; color: #0F172A;
    background: #fff;
  }

  /* ════════════════ CID TAGS ════════════════ */
  .cid-row {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 4px 0 0 36px;
  }
  .cid-chip {
    display: inline-block;
    padding: 3px 14px;
    background: #0B3D6B; color: #fff;
    border-radius: 20px;
    font-size: 8pt; font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* ════════════════ RED FLAGS ════════════════ */
  .alert-box {
    margin: 8px 0 16px 0;
    background: linear-gradient(135deg, #FFF5F5, #FFF1F1);
    border: 1px solid #FECACA;
    border-left: 4px solid #DC2626;
    border-radius: 8px;
    padding: 12px 18px;
    page-break-inside: avoid;
  }
  .alert-box h3 {
    font-size: 8.5pt; font-weight: 700; color: #991B1B;
    text-transform: uppercase; letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .alert-box li {
    font-size: 9pt; color: #7F1D1D; margin: 3px 0;
    list-style: none; padding-left: 16px; position: relative;
  }
  .alert-box li::before {
    content: "▲"; position: absolute; left: 0; top: 1px;
    color: #DC2626; font-size: 6pt;
  }

  /* ════════════════ EXAMS ════════════════ */
  .exams-list {
    padding: 4px 0 0 36px;
  }
  .exams-list li {
    font-size: 9.5pt; color: #334155; margin: 3px 0;
    list-style: none; padding-left: 14px; position: relative;
  }
  .exams-list li::before {
    content: "→"; position: absolute; left: 0; top: 0;
    color: #1565A8; font-weight: 700;
  }

  /* ════════════════ THEORY BOX ════════════════ */
  .theory-box {
    background: #F0F7FF;
    border: 1px solid #BFDBFE;
    border-radius: 8px;
    padding: 14px 18px;
    font-size: 9pt; color: #1E40AF;
    line-height: 1.7;
    margin-top: 4px;
  }

  /* ════════════════ SIGNATURE ════════════════ */
  .sig-area {
    margin: 36px 32px 0 32px;
    text-align: center;
    page-break-inside: avoid;
  }
  .sig-inner {
    display: inline-block;
    min-width: 260px; text-align: center;
  }
  .sig-img {
    max-height: 52px; max-width: 180px; object-fit: contain;
  }
  .stamp-img {
    max-height: 52px; max-width: 160px; object-fit: contain;
    margin-top: 4px;
  }
  .sig-divider {
    width: 100%; height: 1.5px;
    background: #0B3D6B;
    margin: 8px 0 6px;
  }
  .sig-name { font-size: 11pt; font-weight: 700; color: #0B3D6B; }
  .sig-crm { font-size: 9pt; color: #1565A8; font-weight: 600; }
  .sig-spec { font-size: 8.5pt; color: #64748B; }

  /* ════════════════ FOOTER ════════════════ */
  .footer-bar {
    margin: 28px 32px 0 32px;
    padding-top: 12px;
    border-top: 1px solid #E2E8F0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .footer-l {
    font-size: 7pt; color: #94A3B8; line-height: 1.8;
  }
  .footer-l strong { color: #64748B; }
  .footer-r {
    text-align: right;
    font-size: 6.5pt; color: #94A3B8;
  }
  .hash-mono {
    font-family: 'Courier New', monospace;
    font-size: 5.5pt; color: #94A3B8;
    background: #F8FAFC;
    padding: 2px 8px; border-radius: 4px;
    margin-top: 3px; display: inline-block;
    border: 1px solid #E2E8F0;
    word-break: break-all;
  }

  .bottom-accent {
    height: 3px;
    background: linear-gradient(90deg, #0B3D6B 0%, #1565A8 35%, #C7944A 65%, #D4A84B 100%);
    margin-top: 16px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Gold accent bar -->
  <div class="top-accent"></div>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${logoHtml || `<div class="logo-mark"><span>M</span></div>`}
      <div>
        <div class="brand-name">${clinicName || 'MindMed'}</div>
        <div class="brand-sub">${clinicName ? 'Powered by MindMed AI' : 'Laudos Médicos Inteligentes'}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-name">Dr(a). ${doctorName}</div>
      ${doctorCrm ? `<div class="doc-crm">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</div>` : ''}
      ${doctorSpecialty ? `<div class="doc-detail">${doctorSpecialty}</div>` : ''}
      ${doctorPhone ? `<div class="doc-detail">${doctorPhone}</div>` : ''}
      ${doctorAddress ? `<div class="doc-detail" style="max-width:200px;">${doctorAddress}</div>` : ''}
    </div>
  </div>
  <div class="header-line"></div>

  <!-- Patient card -->
  <div class="patient-card">
    <div class="patient-card-header">
      <div class="icon-user">P</div>
      <span>Identificação do Paciente</span>
    </div>
    <div class="patient-card-body">
      <div class="patient-grid">
        <div class="pf"><span class="lbl">Paciente:</span><span class="val">${sections.identificacao?.nome || 'Não informado'}</span></div>
        <div class="pf"><span class="lbl">Idade:</span><span class="val">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</span></div>
        <div class="pf"><span class="lbl">Sexo:</span><span class="val">${sections.identificacao?.sexo || 'N/I'}</span></div>
        <div class="pf"><span class="lbl">Data da Consulta:</span><span class="val">${dateShort}</span></div>
      </div>
    </div>
  </div>

  <!-- Document title -->
  <div class="doc-title">
    <h2>Laudo Médico</h2>
    <div class="title-accent"></div>
  </div>

  <!-- Clinical sections -->
  <div class="sections-wrapper">

    ${sections.queixa || sections.hda ? `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:#0B3D6B;">01</div>
        <h2 class="section-title">Anamnese</h2>
        <div class="section-line"></div>
      </div>
      <div class="section-body">
        ${sections.queixa ? `<strong style="color:#0B3D6B;">Queixa Principal:</strong> ${formatContent(sections.queixa)}<br><br>` : ''}
        ${sections.hda ? `<strong style="color:#0B3D6B;">História da Doença Atual:</strong><br>${formatContent(sections.hda)}` : ''}
      </div>
    </div>` : ''}

    ${buildSection('02', 'Exame Físico', sections.exame_fisico || '', '#1565A8')}

    ${sections.hipoteses?.principal || sections.hipoteses?.diferencial ? `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:#0B3D6B;">03</div>
        <h2 class="section-title">Hipótese Diagnóstica</h2>
        <div class="section-line"></div>
      </div>
      <div class="dx-group" style="padding-left:36px;">
        ${sections.hipoteses?.principal ? `
        <div class="dx-card main">
          <div class="dx-label">Hipótese Principal</div>
          <div class="dx-body">${sections.hipoteses.principal}</div>
        </div>` : ''}
        ${sections.hipoteses?.diferencial ? `
        <div class="dx-card diff">
          <div class="dx-label">Diagnóstico Diferencial</div>
          <div class="dx-body" style="font-weight:500;color:#334155;">${sections.hipoteses.diferencial}</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    ${sections.cid10 && sections.cid10.length > 0 ? `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:#C7944A;">C</div>
        <h2 class="section-title">Classificação CID-10</h2>
        <div class="section-line"></div>
      </div>
      <div class="cid-row">
        ${sections.cid10.map(c => `<span class="cid-chip">${c}</span>`).join('')}
      </div>
    </div>` : ''}

    ${redFlags && redFlags.length > 0 ? `
    <div class="alert-box">
      <h3>⚠ Sinais de Alerta</h3>
      <ul>${redFlags.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>` : ''}

    ${complementaryExams && complementaryExams.length > 0 ? `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:#1565A8;">04</div>
        <h2 class="section-title">Exames Complementares</h2>
        <div class="section-line"></div>
      </div>
      <div class="exams-list">
        <ul>${complementaryExams.map(e => `<li>${e}</li>`).join('')}</ul>
      </div>
    </div>` : ''}

    ${buildSection('05', 'Conduta', sections.conduta || '', '#0B3D6B')}

    ${sections.embasamento_teorico ? `
    <div class="section">
      <div class="section-title-row">
        <div class="section-num" style="background:#64748B;">R</div>
        <h2 class="section-title">Embasamento Teórico</h2>
        <div class="section-line"></div>
      </div>
      <div class="theory-box">${formatContent(sections.embasamento_teorico)}</div>
    </div>` : ''}

  </div>

  <!-- Signature -->
  <div class="sig-area">
    <div class="sig-inner">
      ${signatureHtml}
      ${stampHtml}
      <div class="sig-divider"></div>
      <div class="sig-name">Dr(a). ${doctorName}</div>
      ${doctorCrm ? `<div class="sig-crm">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</div>` : ''}
      ${doctorSpecialty ? `<div class="sig-spec">${doctorSpecialty}</div>` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-bar">
    <div class="footer-l">
      <p><strong>Emitido via MindMed AI</strong> — Laudos Médicos Inteligentes</p>
      <p>Documento protegido pela LGPD (Lei nº 13.709/2018)</p>
      <p>Gerado em ${dateFormatted} às ${timeFormatted}</p>
    </div>
    <div class="footer-r">
      <p>Verificação Digital</p>
      <div class="hash-mono">${hash.substring(0, 32)}…</div>
    </div>
  </div>

  <div class="bottom-accent"></div>

</div>
</body>
</html>`.trim();
}
