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
    ? `<img src="${profile.logo_url}" alt="Logo" style="max-height: 54px; max-width: 160px; object-fit: contain;" />`
    : '';
    
  const signatureHtml = profile?.signature_image_url
    ? `<img src="${profile.signature_image_url}" alt="Assinatura" style="max-height: 48px; max-width: 160px; object-fit: contain;" />`
    : '';

  const stampHtml = profile?.stamp_image_url
    ? `<img src="${profile.stamp_image_url}" alt="Carimbo" style="max-height: 54px; max-width: 160px; object-fit: contain; margin-top: 4px;" />`
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

  // Helper to render a clinical section
  const renderSection = (icon: string, title: string, content: string) => {
    if (!content) return '';
    return `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">${icon}</span>
        <h2>${title}</h2>
      </div>
      <div class="section-content">${content.replace(/\n/g, '<br>')}</div>
    </div>`;
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 0; }
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Source Sans 3', 'Segoe UI', Arial, sans-serif; 
      font-size: 10pt; 
      line-height: 1.6; 
      color: #1a1a2e; 
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 24mm 28mm 24mm;
    }

    /* ═══════════ HEADER ═══════════ */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      margin-bottom: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-logo-fallback {
      width: 44px; height: 44px;
      background: linear-gradient(145deg, #0d2137 0%, #1a4a7a 100%);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 20px; font-weight: 700;
      font-family: 'Playfair Display', serif;
      letter-spacing: -0.5px;
    }
    .header-brand h1 {
      font-family: 'Playfair Display', serif;
      font-size: 20pt; font-weight: 700; color: #0d2137;
      letter-spacing: -0.3px; line-height: 1.1;
    }
    .header-brand .tagline {
      font-size: 7pt; color: #6b7b8d; font-weight: 500;
      letter-spacing: 2px; text-transform: uppercase; margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #3a4a5c;
      line-height: 1.7;
    }
    .header-right .doctor-name {
      font-size: 11pt; font-weight: 700; color: #0d2137;
      margin-bottom: 2px;
    }
    .header-right .crm-line {
      font-weight: 600; color: #1a4a7a;
    }

    /* Divider line */
    .header-divider {
      height: 3px;
      background: linear-gradient(90deg, #0d2137 0%, #2a6cb6 40%, #d4dfe8 100%);
      border-radius: 2px;
      margin-bottom: 20px;
    }

    /* ═══════════ PATIENT BLOCK ═══════════ */
    .patient-block {
      background: #f4f7fa;
      border: 1px solid #d8e2ec;
      border-radius: 8px;
      padding: 14px 20px;
      margin-bottom: 22px;
    }
    .patient-block-title {
      font-size: 7pt; font-weight: 700; color: #6b7b8d;
      text-transform: uppercase; letter-spacing: 1.5px;
      margin-bottom: 10px;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 40px;
    }
    .patient-field {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 9.5pt;
    }
    .patient-field .label {
      color: #6b7b8d;
      font-weight: 600;
      min-width: 90px;
      flex-shrink: 0;
    }
    .patient-field .value {
      color: #0d2137;
      font-weight: 500;
    }

    /* ═══════════ DOCUMENT TITLE ═══════════ */
    .doc-title-bar {
      text-align: center;
      margin-bottom: 24px;
      padding: 10px 0;
      border-top: 1.5px solid #d8e2ec;
      border-bottom: 1.5px solid #d8e2ec;
    }
    .doc-title-bar h2 {
      font-family: 'Playfair Display', serif;
      font-size: 14pt;
      font-weight: 700;
      color: #0d2137;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    /* ═══════════ CLINICAL SECTIONS ═══════════ */
    .clinical-section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1.5px solid #e4ebf2;
    }
    .section-icon {
      width: 24px; height: 24px;
      background: #0d2137;
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 700;
      flex-shrink: 0;
      line-height: 24px;
      text-align: center;
    }
    .section-header h2 {
      font-size: 10pt; font-weight: 700; color: #0d2137;
      text-transform: uppercase; letter-spacing: 1px;
    }
    .section-content {
      padding: 10px 16px 10px 34px;
      font-size: 10pt;
      line-height: 1.7;
      color: #2c3e50;
      text-align: justify;
    }

    /* ═══════════ DIAGNOSIS CARDS ═══════════ */
    .diagnosis-group {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .diagnosis-card {
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .diagnosis-card.primary {
      border: 2px solid #1a4a7a;
    }
    .diagnosis-card.secondary {
      border: 1px solid #d8e2ec;
    }
    .diagnosis-label {
      padding: 6px 14px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .diagnosis-card.primary .diagnosis-label {
      background: linear-gradient(135deg, #0d2137 0%, #1a4a7a 100%);
      color: #fff;
    }
    .diagnosis-card.secondary .diagnosis-label {
      background: #f4f7fa;
      color: #6b7b8d;
      border-bottom: 1px solid #e4ebf2;
    }
    .diagnosis-value {
      padding: 12px 16px;
      font-size: 10.5pt;
      font-weight: 600;
      color: #0d2137;
      background: #fff;
    }

    /* ═══════════ CID-10 TAGS ═══════════ */
    .cid-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 0 0 34px;
    }
    .cid-tag {
      display: inline-block;
      padding: 3px 12px;
      background: #0d2137;
      color: #fff;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    /* ═══════════ RED FLAGS ═══════════ */
    .red-flags-block {
      background: #fef8f8;
      border: 1px solid #f5d0d0;
      border-left: 4px solid #c0392b;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .red-flags-block h3 {
      font-size: 8.5pt; font-weight: 700; color: #922b21;
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .red-flags-block li {
      font-size: 9.5pt; color: #641e16; margin: 4px 0;
      list-style: none; padding-left: 18px; position: relative;
    }
    .red-flags-block li::before {
      content: "▲";
      position: absolute; left: 0; top: 0;
      color: #c0392b; font-size: 7pt;
    }

    /* ═══════════ EXAMS LIST ═══════════ */
    .exams-block {
      padding: 10px 16px 10px 34px;
    }
    .exams-block li {
      font-size: 9.5pt; color: #2c3e50; margin: 4px 0;
      list-style: none; padding-left: 16px; position: relative;
    }
    .exams-block li::before {
      content: "●";
      position: absolute; left: 0; top: 0;
      color: #1a4a7a; font-size: 6pt; line-height: 18px;
    }

    /* ═══════════ EMBASAMENTO ═══════════ */
    .embasamento-block {
      background: #f0f6fc;
      border: 1px solid #c8ddf0;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 9pt;
      color: #1a3a5c;
      line-height: 1.65;
      margin-top: 4px;
    }

    /* ═══════════ SIGNATURE ═══════════ */
    .signature-area {
      margin-top: 40px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-inner {
      display: inline-block;
      min-width: 280px;
      text-align: center;
    }
    .signature-line {
      width: 100%;
      border-top: 1.5px solid #0d2137;
      margin: 10px 0 6px 0;
    }
    .signature-name {
      font-size: 11pt; font-weight: 700; color: #0d2137;
    }
    .signature-crm {
      font-size: 9pt; color: #3a4a5c; font-weight: 600;
    }
    .signature-specialty {
      font-size: 8.5pt; color: #6b7b8d; font-weight: 500;
    }

    /* ═══════════ FOOTER ═══════════ */
    .footer {
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1.5px solid #d8e2ec;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left {
      font-size: 7pt;
      color: #8e9aab;
      line-height: 1.8;
    }
    .footer-left strong { color: #6b7b8d; }
    .footer-right {
      text-align: right;
      font-size: 6.5pt;
      color: #8e9aab;
    }
    .hash-code {
      font-family: 'Courier New', monospace;
      font-size: 5.5pt;
      color: #8e9aab;
      background: #f4f7fa;
      padding: 2px 8px;
      border-radius: 3px;
      margin-top: 4px;
      display: inline-block;
      word-break: break-all;
      border: 1px solid #e4ebf2;
    }

    .watermark {
      position: fixed;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 6pt;
      color: #d0d8e0;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ═══ HEADER ═══ -->
    <div class="header">
      <div class="header-left">
        ${logoHtml || `<div class="header-logo-fallback">M</div>`}
        <div class="header-brand">
          <h1>${clinicName || 'MindMed'}</h1>
          <div class="tagline">${clinicName ? 'Powered by MindMed AI' : 'Laudos Médicos Inteligentes'}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="doctor-name">Dr(a). ${doctorName}</div>
        ${doctorCrm ? `<div class="crm-line">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</div>` : ''}
        ${doctorSpecialty ? `<div>${doctorSpecialty}</div>` : ''}
        ${doctorPhone ? `<div>${doctorPhone}</div>` : ''}
        ${doctorAddress ? `<div style="max-width: 200px; font-size: 7.5pt;">${doctorAddress}</div>` : ''}
      </div>
    </div>
    <div class="header-divider"></div>

    <!-- ═══ PATIENT ID ═══ -->
    <div class="patient-block">
      <div class="patient-block-title">Identificação do Paciente</div>
      <div class="patient-grid">
        <div class="patient-field">
          <span class="label">Paciente:</span>
          <span class="value">${sections.identificacao?.nome || 'Não informado'}</span>
        </div>
        <div class="patient-field">
          <span class="label">Idade:</span>
          <span class="value">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</span>
        </div>
        <div class="patient-field">
          <span class="label">Sexo:</span>
          <span class="value">${sections.identificacao?.sexo || 'N/I'}</span>
        </div>
        <div class="patient-field">
          <span class="label">Data da Consulta:</span>
          <span class="value">${dateShort}</span>
        </div>
      </div>
    </div>

    <!-- ═══ DOCUMENT TITLE ═══ -->
    <div class="doc-title-bar">
      <h2>Laudo Médico</h2>
    </div>

    <!-- ═══ ANAMNESE (Queixa + HDA) ═══ -->
    ${sections.queixa || sections.hda ? `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">A</span>
        <h2>Anamnese</h2>
      </div>
      <div class="section-content">
        ${sections.queixa ? `<strong>Queixa Principal:</strong> ${sections.queixa}<br><br>` : ''}
        ${sections.hda ? `<strong>História da Doença Atual:</strong><br>${sections.hda.replace(/\n/g, '<br>')}` : ''}
      </div>
    </div>` : ''}

    <!-- ═══ EXAME FÍSICO ═══ -->
    ${renderSection('E', 'Exame Físico', sections.exame_fisico || '')}

    <!-- ═══ HIPÓTESE DIAGNÓSTICA ═══ -->
    ${sections.hipoteses?.principal || sections.hipoteses?.diferencial ? `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">D</span>
        <h2>Hipótese Diagnóstica</h2>
      </div>
      <div class="diagnosis-group">
        ${sections.hipoteses?.principal ? `
        <div class="diagnosis-card primary">
          <div class="diagnosis-label">Hipótese Principal</div>
          <div class="diagnosis-value">${sections.hipoteses.principal}</div>
        </div>` : ''}
        ${sections.hipoteses?.diferencial ? `
        <div class="diagnosis-card secondary">
          <div class="diagnosis-label">Diagnóstico Diferencial</div>
          <div class="diagnosis-value">${sections.hipoteses.diferencial}</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- ═══ CID-10 ═══ -->
    ${sections.cid10 && sections.cid10.length > 0 ? `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">C</span>
        <h2>Classificação CID-10</h2>
      </div>
      <div class="cid-container">
        ${sections.cid10.map(c => `<span class="cid-tag">${c}</span>`).join('')}
      </div>
    </div>` : ''}

    <!-- ═══ RED FLAGS ═══ -->
    ${redFlags && redFlags.length > 0 ? `
    <div class="red-flags-block">
      <h3>⚠ Sinais de Alerta</h3>
      <ul>${redFlags.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>` : ''}

    <!-- ═══ EXAMES COMPLEMENTARES ═══ -->
    ${complementaryExams && complementaryExams.length > 0 ? `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">X</span>
        <h2>Exames Complementares</h2>
      </div>
      <div class="exams-block">
        <ul>${complementaryExams.map(e => `<li>${e}</li>`).join('')}</ul>
      </div>
    </div>` : ''}

    <!-- ═══ CONDUTA ═══ -->
    ${renderSection('P', 'Conduta', sections.conduta || '')}

    <!-- ═══ EMBASAMENTO TEÓRICO ═══ -->
    ${sections.embasamento_teorico ? `
    <div class="clinical-section">
      <div class="section-header">
        <span class="section-icon">R</span>
        <h2>Embasamento Teórico</h2>
      </div>
      <div class="embasamento-block">${sections.embasamento_teorico}</div>
    </div>` : ''}

    <!-- ═══ SIGNATURE ═══ -->
    <div class="signature-area">
      <div class="signature-inner">
        ${signatureHtml}
        ${stampHtml}
        <div class="signature-line"></div>
        <div class="signature-name">Dr(a). ${doctorName}</div>
        ${doctorCrm ? `<div class="signature-crm">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</div>` : ''}
        ${doctorSpecialty ? `<div class="signature-specialty">${doctorSpecialty}</div>` : ''}
      </div>
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div class="footer">
      <div class="footer-left">
        <p><strong>Emitido via MindMed AI</strong> — Laudos Médicos Inteligentes</p>
        <p>Documento protegido pela LGPD (Lei nº 13.709/2018)</p>
        <p>Gerado em ${dateFormatted} às ${timeFormatted}</p>
      </div>
      <div class="footer-right">
        <p>Verificação Digital</p>
        <div class="hash-code">${hash.substring(0, 32)}…</div>
      </div>
    </div>

  </div>
  <div class="watermark">MindMed © ${new Date().getFullYear()} — Documento gerado eletronicamente</div>
</body>
</html>
  `.trim();
}
