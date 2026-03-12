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

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateShort = now.toLocaleDateString('pt-BR');

    const redFlags = laudo.red_flags as string[] | null;
    const complementaryExams = laudo.complementary_exams as string[] | null;

    // Generate content-only HTML (no header/footer - those are drawn by jsPDF)
    const html = generateContentHtml(sections, dateShort, redFlags, complementaryExams);

    // Build structured metadata for jsPDF header/footer rendering
    const pdfMeta = {
      doctorName: profile?.full_name || 'Médico Responsável',
      doctorCrm: profile?.crm || '',
      doctorCrmUf: profile?.crm_uf || '',
      doctorSpecialty: profile?.specialty || '',
      clinicName: profile?.clinic_name || '',
      doctorPhone: profile?.phone || '',
      doctorAddress: profile?.address || '',
      hash,
      dateFormatted,
      timeFormatted,
    };

    const pdfData = {
      html,
      pdfMeta,
      fileName: `laudo-${laudo.id}-${Date.now()}.pdf`,
      hash,
      verifyToken,
    };

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

/**
 * Generates CONTENT-ONLY HTML for the PDF body.
 * Header and footer are rendered by jsPDF post-processing on the client.
 * Uses CSS page-break-inside:avoid on all section blocks.
 */
function generateContentHtml(
  sections: PdfSection,
  dateShort: string,
  redFlags: string[] | null,
  complementaryExams: string[] | null,
): string {
  const fmt = (text: string) => text ? text.replace(/\n/g, '<br>') : '';

  // Dynamic section numbering
  let sectionNum = 1;
  const nextNum = () => String(sectionNum++).padStart(2, '0');

  const anamnese = sections.queixa || sections.hda;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #1E293B;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* All content in a single flow container - no fixed positioning */
  .content-wrapper {
    width: 100%;
    padding: 0;
  }
  /* Every section block avoids page breaks inside */
  .section-block {
    page-break-inside: avoid;
    margin-bottom: 12px;
  }
  /* Word wrapping safety */
  td, th, div, span, p {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
  }
  /* Section title style */
  .section-title {
    font-size: 10pt;
    font-weight: 700;
    color: #0B3D6B;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #E2E8F0;
    padding-bottom: 5px;
    margin-bottom: 6px;
  }
  .section-body {
    font-size: 10pt;
    line-height: 1.7;
    color: #334155;
    text-align: justify;
    padding-top: 4px;
  }
  .badge-num {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    line-height: 24px;
    display: inline-block;
  }
</style>
</head>
<body>
<div class="content-wrapper">

  <!-- Patient identification card -->
  <div class="section-block">
    <table style="border:1px solid #E2E8F0;width:100%;">
      <tr>
        <td colspan="4" style="background:linear-gradient(135deg,#0B3D6B,#1565A8);padding:7px 16px;">
          <span style="color:#fff;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;">&#9679; Identificação do Paciente</span>
        </td>
      </tr>
      <tr>
        <td style="width:25%;padding:8px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:9pt;">
          <span style="color:#64748B;font-weight:600;">Paciente:</span>
        </td>
        <td style="width:25%;padding:8px 8px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:9pt;">
          <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.nome || 'Não informado'}</span>
        </td>
        <td style="width:25%;padding:8px 14px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:9pt;">
          <span style="color:#64748B;font-weight:600;">Idade:</span>
        </td>
        <td style="width:25%;padding:8px 8px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:9pt;">
          <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:5px 14px 8px;background:#F8FAFC;font-size:9pt;">
          <span style="color:#64748B;font-weight:600;">Sexo:</span>
        </td>
        <td style="padding:5px 8px 8px;background:#F8FAFC;font-size:9pt;">
          <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.sexo || 'N/I'}</span>
        </td>
        <td style="padding:5px 14px 8px;background:#F8FAFC;font-size:9pt;">
          <span style="color:#64748B;font-weight:600;">Data:</span>
        </td>
        <td style="padding:5px 8px 8px;background:#F8FAFC;font-size:9pt;">
          <span style="color:#0F172A;font-weight:500;">${dateShort}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Document title -->
  <div class="section-block" style="text-align:center;padding:10px 0 14px 0;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;margin-bottom:16px;">
    <div style="font-size:13pt;font-weight:700;color:#0B3D6B;letter-spacing:4px;text-transform:uppercase;">Laudo Médico</div>
    <div style="width:40px;height:3px;background:linear-gradient(90deg,#C7944A,#D4A84B);margin:8px auto 0 auto;"></div>
  </div>

  <!-- Clinical sections -->
  ${anamnese ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#0B3D6B;">${nextNum()}</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Anamnese</div>
          <div class="section-body">
            ${sections.queixa ? `<strong style="color:#0B3D6B;">Queixa Principal:</strong> ${fmt(sections.queixa)}<br><br>` : ''}
            ${sections.hda ? `<strong style="color:#0B3D6B;">História da Doença Atual:</strong><br>${fmt(sections.hda)}` : ''}
          </div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${sections.exame_fisico ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#1565A8;">${nextNum()}</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Exame Físico</div>
          <div class="section-body">${fmt(sections.exame_fisico)}</div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${(sections.hipoteses?.principal || sections.hipoteses?.diferencial) ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#0B3D6B;">${nextNum()}</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Hipótese Diagnóstica</div>
          <div style="padding-top:4px;">
            ${sections.hipoteses?.principal ? `
            <div style="border:2px solid #0B3D6B;margin-bottom:8px;">
              <div style="background:linear-gradient(135deg,#0B3D6B,#1565A8);padding:5px 14px;font-size:7pt;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1.5px;">Hipótese Principal</div>
              <div style="padding:10px 14px;font-size:10pt;font-weight:600;color:#0F172A;">${fmt(sections.hipoteses.principal)}</div>
            </div>` : ''}
            ${sections.hipoteses?.diferencial ? `
            <div style="border:1px solid #E2E8F0;margin-bottom:6px;">
              <div style="background:#F1F5F9;padding:5px 14px;font-size:7pt;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #E2E8F0;">Diagnóstico Diferencial</div>
              <div style="padding:10px 14px;font-size:10pt;font-weight:500;color:#334155;">${fmt(sections.hipoteses.diferencial)}</div>
            </div>` : ''}
          </div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${sections.cid10 && sections.cid10.length > 0 ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#C7944A;">C</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Classificação CID-10</div>
          <div style="padding-top:6px;">
            ${sections.cid10.map(c => `<span style="display:inline-block;padding:3px 12px;background:#0B3D6B;color:#fff;border-radius:16px;font-size:8pt;font-weight:600;letter-spacing:0.5px;margin:2px 4px 2px 0;">${c}</span>`).join('')}
          </div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${redFlags && redFlags.length > 0 ? `
  <div class="section-block">
    <div style="background:#FFF5F5;border:1px solid #FECACA;border-left:4px solid #DC2626;padding:10px 16px;">
      <div style="font-size:8.5pt;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">⚠ Sinais de Alerta</div>
      ${redFlags.map(f => `<div style="font-size:9pt;color:#7F1D1D;padding:2px 0 2px 14px;">▲ ${f}</div>`).join('')}
    </div>
  </div>` : ''}

  ${(complementaryExams && complementaryExams.length > 0) ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#1565A8;">${nextNum()}</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Exames Complementares</div>
          <div style="padding-top:4px;">
            ${complementaryExams.map(e => `<div style="font-size:9.5pt;color:#334155;padding:2px 0 2px 12px;">→ ${e}</div>`).join('')}
          </div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${sections.conduta ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#0B3D6B;">${nextNum()}</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Conduta</div>
          <div class="section-body">${fmt(sections.conduta)}</div>
        </td>
      </tr>
    </table>
  </div>` : ''}

  ${sections.embasamento_teorico ? `
  <div class="section-block">
    <table>
      <tr>
        <td style="width:32px;vertical-align:top;padding-top:2px;">
          <div class="badge-num" style="background:#64748B;">R</div>
        </td>
        <td style="padding-left:8px;vertical-align:top;">
          <div class="section-title">Embasamento Teórico</div>
          <div style="padding-top:6px;">
            <div style="border:1px solid #BFDBFE;background:#F0F7FF;padding:10px 14px;font-size:9pt;color:#1E40AF;line-height:1.7;">${fmt(sections.embasamento_teorico)}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>` : ''}

</div>
</body>
</html>`.trim();
}
