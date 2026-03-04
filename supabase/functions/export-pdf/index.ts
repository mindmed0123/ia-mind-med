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
    // ===== AUTH (same pattern as generate-laudo) =====
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

    // Buscar perfil do médico - use service role to ensure we get it
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
    ? `<img src="${profile.logo_url}" alt="Logo" style="max-height: 80px; max-width: 200px; object-fit: contain;" />`
    : '';
    
  const signatureHtml = profile?.signature_image_url
    ? `<img src="${profile.signature_image_url}" alt="Assinatura" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px;" />`
    : '';

  const doctorName = profile?.full_name || 'Médico Responsável';
  const doctorCrm = profile?.crm || '';
  const doctorCrmUf = profile?.crm_uf || '';
  const doctorSpecialty = profile?.specialty || '';
  const clinicName = profile?.clinic_name || '';
  const doctorPhone = profile?.phone || '';
  const doctorEmail = profile?.email_public || '';
  const doctorAddress = profile?.address || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 1.5cm 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', 'Arial', sans-serif; 
      font-size: 10pt; line-height: 1.6; color: #1a1a2e; background: #fff;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 16px; margin-bottom: 20px; border-bottom: 3px solid #2563eb;
    }
    .header-left { flex: 1; }
    .header-right { text-align: right; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .brand-icon {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      color: white; font-size: 20px;
    }
    .brand h1 { color: #1e40af; font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-subtitle { color: #64748b; font-size: 9pt; margin-top: 2px; }
    .doctor-header {
      background: #f0f4ff; padding: 12px 16px; border-radius: 8px;
      margin-bottom: 20px; border: 1px solid #dbeafe;
    }
    .doctor-header-grid { display: flex; justify-content: space-between; align-items: center; }
    .doctor-info h2 { color: #1e40af; font-size: 14pt; font-weight: 700; margin: 0 0 4px 0; }
    .doctor-info p { color: #475569; font-size: 9pt; margin: 2px 0; }
    .doctor-info .specialty-badge {
      display: inline-block; background: #2563eb; color: white;
      padding: 2px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; margin-top: 4px;
    }
    .doctor-contact { text-align: right; font-size: 8pt; color: #64748b; }
    .doctor-contact p { margin: 2px 0; }
    .document-title {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white; text-align: center; padding: 12px 20px; border-radius: 8px;
      margin-bottom: 20px; font-size: 14pt; font-weight: 700;
      letter-spacing: 1px; text-transform: uppercase;
    }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-card { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .info-card h3 {
      color: #1e40af; font-size: 10pt; font-weight: 700; margin-bottom: 10px;
      padding-bottom: 6px; border-bottom: 2px solid #3b82f6;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .info-row { display: flex; margin: 6px 0; font-size: 9pt; }
    .info-label { color: #64748b; min-width: 100px; font-weight: 500; }
    .info-value { color: #1e293b; font-weight: 600; }
    .section { margin: 20px 0; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .section-icon {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      color: white; font-size: 14px;
    }
    .section h2 { color: #1e3a8a; font-size: 12pt; font-weight: 700; margin: 0; }
    .section-content {
      background: #fafbfc; padding: 16px; border-radius: 8px;
      border-left: 4px solid #3b82f6; font-size: 10pt; line-height: 1.7;
    }
    .section-content p { margin: 0; text-align: justify; }
    .highlight-section { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left-color: #f59e0b; }
    .highlight-section h3 { color: #92400e; font-size: 9pt; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }
    .highlight-main {
      background: white; padding: 12px; border-radius: 6px;
      font-weight: 600; color: #1e3a8a; margin-bottom: 12px; border: 1px solid #fbbf24;
    }
    .cid-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .cid-tag {
      display: inline-block; padding: 4px 12px;
      background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
      color: white; border-radius: 20px; font-size: 8pt; font-weight: 600;
    }
    .embasamento-section { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-left-color: #10b981; }
    .embasamento-section h3 { color: #065f46; font-size: 9pt; font-weight: 700; margin-bottom: 8px; }
    .signature-area { margin-top: 40px; text-align: center; page-break-inside: avoid; }
    .signature-box {
      display: inline-block; min-width: 300px; padding: 20px;
      background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
    }
    .signature-line { border-top: 2px solid #1e3a8a; width: 100%; margin: 12px 0; }
    .signature-name { color: #1e3a8a; font-weight: 700; font-size: 11pt; margin: 4px 0; }
    .signature-info { color: #64748b; font-size: 9pt; }
    .footer {
      margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0;
      font-size: 8pt; color: #64748b;
    }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
    .footer-info p { margin: 4px 0; }
    .verify-box {
      background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center;
    }
    .verify-box p { margin: 4px 0; font-size: 7pt; }
    .hash-code {
      font-family: monospace; font-size: 6pt; background: white;
      padding: 4px 8px; border-radius: 4px; word-break: break-all; margin-top: 8px;
    }
    .watermark { position: fixed; bottom: 10px; right: 10px; font-size: 7pt; color: #cbd5e1; }
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

  <div class="doctor-header">
    <div class="doctor-header-grid">
      <div class="doctor-info">
        <h2>Dr(a). ${doctorName}</h2>
        ${doctorCrm ? `<p><strong>CRM:</strong> ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</p>` : ''}
        ${doctorSpecialty ? `<span class="specialty-badge">${doctorSpecialty}</span>` : ''}
        ${clinicName ? `<p style="margin-top: 6px;">${clinicName}</p>` : ''}
      </div>
      <div class="doctor-contact">
        ${doctorPhone ? `<p>📞 ${doctorPhone}</p>` : ''}
        ${doctorEmail ? `<p>✉ ${doctorEmail}</p>` : ''}
        ${doctorAddress ? `<p>📍 ${doctorAddress}</p>` : ''}
      </div>
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
        <span class="info-value">${doctorName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">CRM:</span>
        <span class="info-value">${doctorCrm || 'N/I'}${doctorCrmUf ? ' - ' + doctorCrmUf : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Especialidade:</span>
        <span class="info-value">${doctorSpecialty || 'N/I'}</span>
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
    <div class="section-content"><p>${sections.queixa}</p></div>
  </div>` : ''}

  ${sections.hda ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">📝</div>
      <h2>História da Doença Atual</h2>
    </div>
    <div class="section-content"><p>${sections.hda}</p></div>
  </div>` : ''}

  ${sections.exame_fisico ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">🔬</div>
      <h2>Exame Físico / Achados</h2>
    </div>
    <div class="section-content"><p>${sections.exame_fisico}</p></div>
  </div>` : ''}

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
    <div class="section-content"><p>${sections.conduta}</p></div>
  </div>` : ''}

  ${sections.cid10 && sections.cid10.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">🏷️</div>
      <h2>Classificação CID-10</h2>
    </div>
    <div class="cid-container">
      ${sections.cid10.map(c => `<span class="cid-tag">${c}</span>`).join('')}
    </div>
  </div>` : ''}

  ${sections.embasamento_teorico ? `
  <div class="section">
    <div class="section-header">
      <div class="section-icon">📚</div>
      <h2>Embasamento Teórico</h2>
    </div>
    <div class="section-content embasamento-section"><p>${sections.embasamento_teorico}</p></div>
  </div>` : ''}

  <div class="signature-area">
    <div class="signature-box">
      ${signatureHtml}
      <div class="signature-line"></div>
      <p class="signature-name">Dr(a). ${doctorName}</p>
      ${doctorCrm ? `<p class="signature-info">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</p>` : ''}
      ${doctorSpecialty ? `<p class="signature-info">${doctorSpecialty}</p>` : ''}
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
