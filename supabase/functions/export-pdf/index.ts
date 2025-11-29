import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Não autorizado');

    const { laudo_id } = await req.json();
    if (!laudo_id) throw new Error('ID do laudo não fornecido');

    console.log('Exportando PDF para laudo:', laudo_id);

    // Buscar laudo
    const { data: laudo, error: laudoError } = await supabase
      .from('laudos')
      .select('*')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (laudoError || !laudo) throw new Error('Laudo não encontrado');

    // Buscar perfil do médico completo
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const sections = laudo.sections as PdfSection || {};
    
    // Validação
    if (!sections.hipoteses?.principal || !sections.conduta) {
      throw new Error('Laudo incompleto: necessário hipótese principal e conduta');
    }

    // Gerar hash do conteúdo
    const contentForHash = JSON.stringify({
      id: laudo.id,
      sections,
      user_id: user.id,
      timestamp: new Date().toISOString()
    });
    
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(contentForHash)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Gerar token de verificação (expira em 90 dias)
    const verifyToken = btoa(JSON.stringify({
      id: laudo.id,
      hash,
      exp: Date.now() + (90 * 24 * 60 * 60 * 1000)
    }));

    // Criar HTML para PDF
    const html = generatePdfHtml(laudo, sections, profile, hash, verifyToken);

    const pdfData = {
      html,
      fileName: `laudo-${laudo.id}-${Date.now()}.pdf`,
      hash,
      verifyToken
    };

    // Atualizar laudo com hash e token
    await supabase
      .from('laudos')
      .update({
        pdf_hash: hash,
        pdf_verify_token: verifyToken
      })
      .eq('id', laudo.id);

    // Registrar auditoria
    await supabase.rpc('log_audit_action', {
      p_entity: 'REPORT',
      p_entity_id: laudo.id,
      p_action: 'EXPORT',
      p_diff: { hash, timestamp: new Date().toISOString() }
    });

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
      error: 'Erro ao processar exportação',
      error_id: errorId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generatePdfHtml(
  laudo: any,
  sections: PdfSection,
  profile: any,
  hash: string,
  verifyToken: string
): string {
  const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '');
  const verifyUrl = `${baseUrl}/functions/v1/verify-pdf/${laudo.id}?token=${verifyToken}`;
  
  const logoHtml = profile?.logo_url 
    ? `<img src="${profile.logo_url}" alt="Logo" style="max-height: 80px; max-width: 200px; object-fit: contain;" />`
    : '';
    
  const signatureHtml = profile?.signature_image_url
    ? `<img src="${profile.signature_image_url}" alt="Assinatura" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px;" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 1.5cm 2cm; }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      font-family: 'Segoe UI', 'Arial', sans-serif; 
      font-size: 10pt; 
      line-height: 1.6;
      color: #1a1a2e;
      background: #fff;
    }
    
    /* Header com Logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    .header-left {
      flex: 1;
    }
    .header-right {
      text-align: right;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }
    .brand h1 { 
      color: #1e40af; 
      font-size: 24pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      color: #64748b;
      font-size: 9pt;
      margin-top: 2px;
    }
    
    /* Título do Documento */
    .document-title {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
      text-align: center;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    
    /* Grid de Informações */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .info-card {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .info-card h3 {
      color: #1e40af;
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #3b82f6;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      margin: 6px 0;
      font-size: 9pt;
    }
    .info-label {
      color: #64748b;
      min-width: 100px;
      font-weight: 500;
    }
    .info-value {
      color: #1e293b;
      font-weight: 600;
    }
    
    /* Seções do Laudo */
    .section {
      margin: 20px 0;
      page-break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .section-icon {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
    .section h2 {
      color: #1e3a8a;
      font-size: 12pt;
      font-weight: 700;
      margin: 0;
    }
    .section-content {
      background: #fafbfc;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
      font-size: 10pt;
      line-height: 1.7;
    }
    .section-content p {
      margin: 0;
      text-align: justify;
    }
    
    /* Destaque para Diagnóstico */
    .highlight-section {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left-color: #f59e0b;
    }
    .highlight-section h3 {
      color: #92400e;
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .highlight-main {
      background: white;
      padding: 12px;
      border-radius: 6px;
      font-weight: 600;
      color: #1e3a8a;
      margin-bottom: 12px;
      border: 1px solid #fbbf24;
    }
    
    /* CID Tags */
    .cid-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .cid-tag {
      display: inline-block;
      padding: 4px 12px;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      color: white;
      border-radius: 20px;
      font-size: 8pt;
      font-weight: 600;
    }
    
    /* Embasamento Teórico */
    .embasamento-section {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-left-color: #10b981;
    }
    .embasamento-section h3 {
      color: #065f46;
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    /* Assinatura */
    .signature-area {
      margin-top: 40px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-box {
      display: inline-block;
      min-width: 300px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .signature-line {
      border-top: 2px solid #1e3a8a;
      width: 100%;
      margin: 12px 0;
    }
    .signature-name {
      color: #1e3a8a;
      font-weight: 700;
      font-size: 11pt;
      margin: 4px 0;
    }
    .signature-info {
      color: #64748b;
      font-size: 9pt;
    }
    
    /* Rodapé */
    .footer {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #64748b;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }
    .footer-info p {
      margin: 4px 0;
    }
    .verify-box {
      background: #f1f5f9;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    .verify-box p {
      margin: 4px 0;
      font-size: 7pt;
    }
    .hash-code {
      font-family: monospace;
      font-size: 6pt;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      word-break: break-all;
      margin-top: 8px;
    }
    
    /* Watermark */
    .watermark {
      position: fixed;
      bottom: 10px;
      right: 10px;
      font-size: 7pt;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="brand">
        <div class="brand-icon">🏥</div>
        <div>
          <h1>MindMed</h1>
          <div class="brand-subtitle">Laudos Médicos com Inteligência Artificial</div>
        </div>
      </div>
    </div>
    <div class="header-right">
      ${logoHtml}
    </div>
  </div>

  <div class="document-title">📋 Laudo Médico</div>

  <div class="info-grid">
    <div class="info-card">
      <h3>👤 Dados do Paciente</h3>
      <div class="info-row">
        <span class="info-label">Nome:</span>
        <span class="info-value">${sections.identificacao?.nome || 'Não informado'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Idade:</span>
        <span class="info-value">${sections.identificacao?.idade || 'N/I'} anos</span>
      </div>
      <div class="info-row">
        <span class="info-label">Sexo:</span>
        <span class="info-value">${sections.identificacao?.sexo || 'N/I'}</span>
      </div>
    </div>
    
    <div class="info-card">
      <h3>🩺 Médico Responsável</h3>
      <div class="info-row">
        <span class="info-label">Nome:</span>
        <span class="info-value">${profile?.full_name || 'Não informado'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">CRM:</span>
        <span class="info-value">${profile?.crm || 'N/I'}${profile?.crm_uf ? ' - ' + profile.crm_uf : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Especialidade:</span>
        <span class="info-value">${profile?.specialty || 'N/I'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data:</span>
        <span class="info-value">${new Date().toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  </div>

  ${sections.queixa ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">💬</div>
      <h2>Queixa Principal</h2>
    </div>
    <div class="section-content">
      <p>${sections.queixa}</p>
    </div>
  </div>
  ` : ''}

  ${sections.hda ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">📝</div>
      <h2>História da Doença Atual</h2>
    </div>
    <div class="section-content">
      <p>${sections.hda}</p>
    </div>
  </div>
  ` : ''}

  ${sections.exame_fisico ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">🔬</div>
      <h2>Exame Físico / Achados</h2>
    </div>
    <div class="section-content">
      <p>${sections.exame_fisico}</p>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-header">
      <div class="section-icon">🎯</div>
      <h2>Hipóteses Diagnósticas</h2>
    </div>
    <div class="section-content highlight-section">
      ${sections.hipoteses?.principal ? `
        <h3>🔸 Hipótese Principal</h3>
        <div class="highlight-main">${sections.hipoteses.principal}</div>
      ` : ''}
      ${sections.hipoteses?.diferencial ? `
        <h3>🔹 Diagnóstico Diferencial</h3>
        <p>${sections.hipoteses.diferencial}</p>
      ` : ''}
    </div>
  </div>

  ${sections.conduta ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">💊</div>
      <h2>Conduta / Plano Terapêutico</h2>
    </div>
    <div class="section-content">
      <p>${sections.conduta}</p>
    </div>
  </div>
  ` : ''}

  ${sections.cid10 && sections.cid10.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">🏷️</div>
      <h2>Classificação CID-10</h2>
    </div>
    <div class="cid-container">
      ${sections.cid10.map(c => `<span class="cid-tag">${c}</span>`).join('')}
    </div>
  </div>
  ` : ''}

  ${sections.embasamento_teorico ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">📚</div>
      <h2>Embasamento Teórico</h2>
    </div>
    <div class="section-content embasamento-section">
      <p>${sections.embasamento_teorico}</p>
    </div>
  </div>
  ` : ''}

  <div class="signature-area">
    <div class="signature-box">
      ${signatureHtml}
      <div class="signature-line"></div>
      <p class="signature-name">${profile?.full_name || 'Médico Responsável'}</p>
      ${profile?.crm ? `<p class="signature-info">CRM ${profile.crm}${profile?.crm_uf ? '/' + profile.crm_uf : ''}</p>` : ''}
      ${profile?.specialty ? `<p class="signature-info">${profile.specialty}</p>` : ''}
    </div>
  </div>

  <div class="footer">
    <div class="footer-grid">
      <div class="footer-info">
        <p><strong>📄 Documento Gerado por MindMed</strong></p>
        <p>Sistema de Laudos Médicos com Inteligência Artificial</p>
        <p>Este documento contém informações protegidas pela LGPD.</p>
        <p>ID: <code>${laudo.id}</code></p>
      </div>
      <div class="verify-box">
        <p><strong>🔐 Verificação</strong></p>
        <p>📱 [QR Code seria gerado aqui]</p>
        <div class="hash-code">${hash.substring(0, 24)}...</div>
      </div>
    </div>
  </div>

  <div class="watermark">MindMed © ${new Date().getFullYear()}</div>
</body>
</html>
  `.trim();
}
