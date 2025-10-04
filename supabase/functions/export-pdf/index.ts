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
    @page { size: A4; margin: 2cm; }
    body { 
      font-family: 'Inter', 'Roboto', sans-serif; 
      font-size: 11pt; 
      line-height: 1.6;
      color: #1a1a1a;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 { 
      color: #2563eb; 
      font-size: 24pt;
      margin: 0 0 8px 0;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 10pt;
    }
    .info-box {
      background: #f1f5f9;
      padding: 12px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .section {
      margin: 24px 0;
      page-break-inside: avoid;
    }
    .section h2 {
      color: #1e40af;
      font-size: 14pt;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 12px;
    }
    .section h3 {
      color: #475569;
      font-size: 12pt;
      margin: 12px 0 8px 0;
    }
    .highlight {
      background: #fef3c7;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #64748b;
    }
    .signature-box {
      margin-top: 40px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 300px;
      margin: 40px auto 8px;
    }
    .qr-section {
      margin-top: 24px;
      text-align: center;
      font-size: 8pt;
      color: #64748b;
    }
    ul { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MindMed</h1>
    <div class="subtitle">Laudo Médico Gerado por Inteligência Artificial</div>
  </div>

  <div class="info-box">
    <strong>Médico:</strong> ${profile?.full_name || 'Não informado'} ${profile?.crm ? `- CRM ${profile.crm}` : ''}<br>
    <strong>Especialidade:</strong> ${profile?.specialty || 'Não informada'}<br>
    <strong>Data de emissão:</strong> ${new Date().toLocaleString('pt-BR')}<br>
    <strong>ID do Laudo:</strong> ${laudo.id}<br>
    <strong>Paciente:</strong> ${sections.identificacao?.nome || 'N/I'} - ${sections.identificacao?.sexo || 'N/I'} - ${sections.identificacao?.idade || 'N/I'} anos
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
      <h3>A) Principal (Mais Provável)</h3>
      <p class="highlight">${sections.hipoteses.principal}</p>
    ` : ''}
    ${sections.hipoteses?.diferencial ? `
      <h3>B) Diferencial (Menos Provável)</h3>
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
    <h2>CID-10</h2>
    <p>${sections.cid10.join(', ')}</p>
  </div>
  ` : ''}

  <div class="signature-box">
    <div class="signature-line"></div>
    <p><strong>${profile?.full_name || 'Médico Responsável'}</strong><br>
    ${profile?.crm ? `CRM ${profile.crm}` : ''}</p>
  </div>

  <div class="footer">
    <p><strong>Emitido por MindMed</strong> - Sistema de Laudos Médicos com IA</p>
    <p>Este documento foi gerado automaticamente e contém informações protegidas pela LGPD.</p>
    <p><strong>Hash de verificação:</strong> ${hash.substring(0, 16)}...</p>
    
    <div class="qr-section">
      <p>Verificação de autenticidade: Escaneie o QR Code abaixo ou acesse:</p>
      <p style="word-break: break-all; font-size: 7pt;">${verifyUrl}</p>
      <p style="margin-top: 8px;">📱 [QR Code seria gerado aqui]</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}