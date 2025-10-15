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

    // Buscar perfil do médico
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, crm, specialty')
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

    // Gerar PDF usando puppeteer (simplificado - em produção usar biblioteca apropriada)
    // Por enquanto, retornar HTML para o frontend converter
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
    // Log full error for ops/debugging
    const errorId = crypto.randomUUID();
    console.error('Error ID:', errorId, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error to client
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 2.5cm; }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      font-family: 'Segoe UI', 'Arial', sans-serif; 
      font-size: 11pt; 
      line-height: 1.8;
      color: #1f2937;
    }
    .header {
      text-align: center;
      padding-bottom: 24px;
      margin-bottom: 32px;
      border-bottom: 3px solid #3b82f6;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      padding: 24px;
      border-radius: 8px;
    }
    .header h1 { 
      color: #1e40af; 
      font-size: 28pt;
      margin: 0 0 12px 0;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 11pt;
      font-weight: 500;
    }
    .info-box {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 5px solid #3b82f6;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .info-box p {
      margin: 8px 0;
      display: flex;
      align-items: baseline;
    }
    .info-box strong {
      color: #1e40af;
      min-width: 140px;
      font-weight: 600;
    }
    .section {
      margin: 32px 0;
      page-break-inside: avoid;
    }
    .section h2 {
      color: #1e3a8a;
      font-size: 16pt;
      font-weight: 700;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section h2::before {
      content: '▸';
      color: #3b82f6;
      font-size: 20pt;
    }
    .section h3 {
      color: #475569;
      font-size: 13pt;
      font-weight: 600;
      margin: 16px 0 10px 0;
      padding-left: 12px;
      border-left: 3px solid #93c5fd;
    }
    .section p {
      text-align: justify;
      margin: 8px 0;
      padding-left: 12px;
    }
    .highlight {
      background: linear-gradient(120deg, #fef3c7 0%, #fde68a 100%);
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
      font-weight: 500;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #e2e8f0;
      font-size: 9pt;
      color: #64748b;
    }
    .signature-box {
      margin-top: 48px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-line {
      border-top: 2px solid #1e3a8a;
      width: 350px;
      margin: 48px auto 12px;
    }
    .signature-box p {
      color: #1e40af;
      font-weight: 600;
      margin: 4px 0;
    }
    .qr-section {
      margin-top: 32px;
      text-align: center;
      font-size: 8pt;
      color: #64748b;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    ul { 
      margin: 12px 0; 
      padding-left: 32px; 
    }
    li { 
      margin: 8px 0;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #dbeafe;
      color: #1e40af;
      border-radius: 16px;
      font-size: 9pt;
      font-weight: 600;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 MindMed</h1>
    <div class="subtitle">Laudo Médico com Inteligência Artificial</div>
  </div>

  <div class="info-box">
    <p><strong>Médico Responsável:</strong> ${profile?.full_name || 'Não informado'} ${profile?.crm ? `- CRM ${profile.crm}` : ''}</p>
    <p><strong>Especialidade:</strong> ${profile?.specialty || 'Não informada'}</p>
    <p><strong>Data de Emissão:</strong> ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</p>
    <p><strong>ID do Laudo:</strong> <code style="background:#e0e7ff;padding:2px 8px;border-radius:4px;font-size:9pt;">${laudo.id}</code></p>
    <p><strong>Paciente:</strong> ${sections.identificacao?.nome || 'N/I'} | ${sections.identificacao?.sexo || 'N/I'} | ${sections.identificacao?.idade || 'N/I'} anos</p>
  </div>

  ${sections.queixa ? `
  <div class="section">
    <h2>Queixa Principal</h2>
    <p>${sections.queixa}</p>
  </div>
  ` : ''}

  ${sections.hda ? `
  <div class="section">
    <h2>História da Doença Atual (HDA)</h2>
    <p>${sections.hda}</p>
  </div>
  ` : ''}

  ${sections.exame_fisico ? `
  <div class="section">
    <h2>Exame Físico / Achados Relevantes</h2>
    <p>${sections.exame_fisico}</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>Hipóteses Diagnósticas</h2>
    ${sections.hipoteses?.principal ? `
      <h3>A) Hipótese Principal (Mais Provável)</h3>
      <div class="highlight">${sections.hipoteses.principal}</div>
    ` : ''}
    ${sections.hipoteses?.diferencial ? `
      <h3>B) Diagnóstico Diferencial (Menos Provável)</h3>
      <p>${sections.hipoteses.diferencial}</p>
    ` : ''}
  </div>

  ${sections.conduta ? `
  <div class="section">
    <h2>Conduta / Plano Terapêutico</h2>
    <p>${sections.conduta}</p>
  </div>
  ` : ''}

  ${sections.cid10 && sections.cid10.length > 0 ? `
  <div class="section">
    <h2>Classificação CID-10</h2>
    <p>${sections.cid10.map(c => `<span class="badge">${c}</span>`).join(' ')}</p>
  </div>
  ` : ''}

  <div class="signature-box">
    <div class="signature-line"></div>
    <p>${profile?.full_name || 'Médico Responsável'}</p>
    ${profile?.crm ? `<p style="font-size:10pt;color:#64748b;">CRM ${profile.crm}</p>` : ''}
  </div>

  <div class="footer">
    <p style="font-weight:600;margin-bottom:8px;">📄 Documento Gerado por MindMed - Sistema de Laudos Médicos com IA</p>
    <p style="margin-bottom:4px;">Este documento foi gerado automaticamente e contém informações protegidas pela LGPD (Lei Geral de Proteção de Dados).</p>
    <p style="margin-bottom:8px;">Qualquer reprodução ou uso não autorizado é proibido.</p>
    <p style="font-family:monospace;font-size:7pt;"><strong>Hash de Verificação:</strong> ${hash.substring(0, 32)}...</p>
    
    <div class="qr-section">
      <p style="font-weight:600;margin-bottom:8px;color:#1e40af;">🔐 Verificação de Autenticidade</p>
      <p style="margin-bottom:4px;">Escaneie o QR Code ou acesse o link para verificar a autenticidade deste documento:</p>
      <p style="word-break:break-all;font-size:7pt;background:#fff;padding:8px;border-radius:4px;margin-top:8px;">${verifyUrl}</p>
      <p style="margin-top:12px;font-size:16pt;">📱 [QR Code seria gerado aqui]</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}