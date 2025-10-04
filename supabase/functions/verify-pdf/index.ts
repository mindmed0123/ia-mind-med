import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const laudoId = pathParts[pathParts.length - 1];
    const token = url.searchParams.get('token');

    if (!laudoId || !token) {
      throw new Error('ID do laudo e token são obrigatórios');
    }

    console.log('Verificando PDF:', { laudoId, token: token.substring(0, 20) });

    // Decodificar token
    let tokenData;
    try {
      tokenData = JSON.parse(atob(token));
    } catch {
      throw new Error('Token inválido');
    }

    // Verificar expiração
    if (Date.now() > tokenData.exp) {
      throw new Error('Token expirado');
    }

    // Verificar se o ID do token corresponde ao ID da URL
    if (tokenData.id !== laudoId) {
      throw new Error('Token não corresponde ao laudo');
    }

    // Buscar laudo (sem autenticação - endpoint público)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: laudo, error } = await supabase
      .from('laudos')
      .select('id, title, status, pdf_hash, pdf_verify_token, created_at, finalized_at, user_id')
      .eq('id', laudoId)
      .single();

    if (error || !laudo) {
      throw new Error('Laudo não encontrado');
    }

    // Verificar token armazenado
    if (laudo.pdf_verify_token !== token) {
      throw new Error('Token não corresponde ao registrado');
    }

    // Verificar hash
    const hashMatch = laudo.pdf_hash === tokenData.hash;

    // Buscar informações do médico (sem dados sensíveis)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, crm, specialty')
      .eq('id', laudo.user_id)
      .single();

    const verification = {
      valid: hashMatch && laudo.status === 'completed',
      laudo_id: laudo.id,
      title: laudo.title,
      status: laudo.status,
      hash: laudo.pdf_hash?.substring(0, 16) + '...',
      hash_match: hashMatch,
      created_at: laudo.created_at,
      finalized_at: laudo.finalized_at,
      medico: {
        nome: profile?.full_name || 'Não disponível',
        crm: profile?.crm || 'Não disponível',
        especialidade: profile?.specialty || 'Não disponível'
      },
      emitido_por: 'MindMed - Sistema de Laudos Médicos'
    };

    console.log('Verificação concluída:', verification.valid);

    // Retornar HTML de verificação amigável
    const html = generateVerificationHtml(verification);

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('Erro na verificação:', error);
    
    const errorHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro na Verificação</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #fee;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { color: #dc2626; margin-top: 0; }
    .error { color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Erro na Verificação</h1>
    <p class="error"><strong>Motivo:</strong> ${error instanceof Error ? error.message : 'Erro desconhecido'}</p>
    <p>O documento não pôde ser verificado. Entre em contato com o emissor.</p>
  </div>
</body>
</html>
    `;
    
    return new Response(errorHtml, {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});

function generateVerificationHtml(verification: any): string {
  const statusColor = verification.valid ? '#059669' : '#dc2626';
  const statusIcon = verification.valid ? '✅' : '❌';
  const statusText = verification.valid ? 'Documento Válido' : 'Documento Inválido';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificação de Laudo - MindMed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      max-width: 600px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: ${statusColor};
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .status-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .content {
      padding: 30px;
    }
    .info-grid {
      display: grid;
      gap: 16px;
      margin: 20px 0;
    }
    .info-item {
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 3px solid ${statusColor};
    }
    .info-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 15px;
      color: #1e293b;
      font-weight: 500;
    }
    .footer {
      background: #f1f5f9;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-error { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-icon">${statusIcon}</div>
      <h1>${statusText}</h1>
      <p>MindMed - Sistema de Laudos Médicos</p>
    </div>
    
    <div class="content">
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">ID do Laudo</div>
          <div class="info-value">${verification.laudo_id}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value">
            <span class="badge ${verification.valid ? 'badge-success' : 'badge-error'}">
              ${verification.status}
            </span>
          </div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Hash de Verificação</div>
          <div class="info-value" style="font-family: monospace; font-size: 13px;">
            ${verification.hash}
          </div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Médico Responsável</div>
          <div class="info-value">
            ${verification.medico.nome}<br>
            <span style="font-size: 13px; color: #64748b;">
              ${verification.medico.crm} | ${verification.medico.especialidade}
            </span>
          </div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Data de Emissão</div>
          <div class="info-value">
            ${new Date(verification.finalized_at || verification.created_at).toLocaleString('pt-BR')}
          </div>
        </div>
      </div>
      
      ${verification.valid ? `
        <div style="background: #d1fae5; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <p style="color: #065f46; font-weight: 600; margin-bottom: 8px;">
            ✓ Documento Autêntico
          </p>
          <p style="color: #047857; font-size: 14px;">
            Este laudo foi verificado e está em conformidade com os registros do sistema MindMed.
            O hash do documento corresponde ao registrado na base de dados.
          </p>
        </div>
      ` : `
        <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin-top: 20px;">
          <p style="color: #991b1b; font-weight: 600; margin-bottom: 8px;">
            ⚠ Documento Inválido
          </p>
          <p style="color: #b91c1c; font-size: 14px;">
            Este documento pode ter sido alterado ou não está finalizado.
            Entre em contato com o emissor para maiores informações.
          </p>
        </div>
      `}
    </div>
    
    <div class="footer">
      <p><strong>${verification.emitido_por}</strong></p>
      <p style="margin-top: 8px; font-size: 12px;">
        Esta verificação foi gerada em ${new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}