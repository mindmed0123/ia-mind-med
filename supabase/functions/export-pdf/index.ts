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
  const doctorName = profile?.full_name || 'Médico Responsável';
  const doctorCrm = profile?.crm || '';
  const doctorCrmUf = profile?.crm_uf || '';
  const doctorSpecialty = profile?.specialty || '';
  const clinicName = profile?.clinic_name || '';
  const doctorPhone = profile?.phone || '';
  const doctorAddress = profile?.address || '';

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateShort = now.toLocaleDateString('pt-BR');

  const redFlags = laudo.red_flags as string[] | null;
  const complementaryExams = laudo.complementary_exams as string[] | null;

  const fmt = (text: string) => text ? text.replace(/\n/g, '<br>') : '';

  const sectionHtml = (num: string, title: string, content: string, color = '#0B3D6B') => {
    if (!content) return '';
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="30" valign="top">
          <div style="width:26px;height:26px;background:${color};border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${num}</div>
        </td>
        <td style="padding-left:10px;" valign="top">
          <div style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:8px;">${title}</div>
          <div style="font-size:10pt;line-height:1.75;color:#334155;text-align:justify;">${fmt(content)}</div>
        </td>
      </tr>
    </table>`;
  };

  // Build section numbering dynamically
  let sectionNum = 1;
  const nextNum = () => String(sectionNum++).padStart(2, '0');

  const anamnese = sections.queixa || sections.hda;
  const anamneseNum = anamnese ? nextNum() : '';
  const examNum = sections.exame_fisico ? nextNum() : '';
  const hipNum = (sections.hipoteses?.principal || sections.hipoteses?.diferencial) ? nextNum() : '';
  const examsCompNum = (complementaryExams && complementaryExams.length > 0) ? nextNum() : '';
  const condutaNum = sections.conduta ? nextNum() : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Merriweather:wght@700;900&display=swap');
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: 10pt; line-height: 1.65; color: #1E293B; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { width: 210mm; min-height: 297mm; padding: 0; position: relative; }
  td, th, div, span, p { word-wrap: break-word; overflow-wrap: break-word; }
</style>
</head>
<body>
<div class="page">

  <!-- Gold accent bar -->
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:5px;background:linear-gradient(90deg,#0B3D6B 0%,#1565A8 35%,#C7944A 65%,#D4A84B 100%);font-size:0;line-height:0;">&nbsp;</td></tr></table>

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 32px 16px 32px;">
    <tr>
      <td width="50%" valign="middle">
        <table cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="padding-right:14px;">
            <table cellpadding="0" cellspacing="0"><tr><td style="width:46px;height:46px;background:linear-gradient(145deg,#0B3D6B,#1565A8);border-radius:12px;text-align:center;line-height:46px;font-size:0;">
              <span style="color:#fff;font-weight:800;font-size:22px;font-family:'Merriweather',serif;">M</span>
            </td></tr></table>
          </td>
          <td valign="middle">
            <table cellpadding="0" cellspacing="0"><tr><td style="font-family:'Merriweather',serif;font-size:18pt;font-weight:900;color:#0B3D6B;line-height:1.1;">${clinicName || 'MindMed'}</td></tr>
            <tr><td style="font-size:7pt;color:#94A3B8;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;padding-top:2px;">${clinicName ? 'Powered by MindMed AI' : 'Laudos Médicos Inteligentes'}</td></tr></table>
          </td>
        </tr></table>
      </td>
      <td width="50%" align="right" valign="middle" style="text-align:right;font-size:8.5pt;color:#475569;line-height:1.65;">
        <table cellpadding="0" cellspacing="0" align="right">
          <tr><td style="text-align:right;font-size:12pt;font-weight:700;color:#0B3D6B;">Dr(a). ${doctorName}</td></tr>
          ${doctorCrm ? `<tr><td style="text-align:right;font-weight:600;color:#1565A8;font-size:9pt;">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</td></tr>` : ''}
          ${doctorSpecialty ? `<tr><td style="text-align:right;font-size:8pt;color:#64748B;">${doctorSpecialty}</td></tr>` : ''}
          ${doctorPhone ? `<tr><td style="text-align:right;font-size:8pt;color:#64748B;">${doctorPhone}</td></tr>` : ''}
          ${doctorAddress ? `<tr><td style="text-align:right;font-size:8pt;color:#64748B;max-width:200px;">${doctorAddress}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>

  <!-- Header line -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;"><tr><td style="height:2px;background:linear-gradient(90deg,#0B3D6B,#CBD5E1 70%,transparent);font-size:0;line-height:0;">&nbsp;</td></tr></table>

  <!-- Patient card -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:18px 32px 0 32px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;">
        <tr>
          <td colspan="4" style="background:linear-gradient(135deg,#0B3D6B,#1565A8);padding:8px 20px;">
            <span style="color:#fff;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:2px;">&#9679; Identificação do Paciente</span>
          </td>
        </tr>
        <tr>
          <td width="25%" style="padding:10px 20px;background:#F8FAFC;font-size:9.5pt;border-top:1px solid #E2E8F0;">
            <span style="color:#64748B;font-weight:600;">Paciente:</span>
          </td>
          <td width="25%" style="padding:10px 4px;background:#F8FAFC;font-size:9.5pt;border-top:1px solid #E2E8F0;">
            <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.nome || 'Não informado'}</span>
          </td>
          <td width="25%" style="padding:10px 20px;background:#F8FAFC;font-size:9.5pt;border-top:1px solid #E2E8F0;">
            <span style="color:#64748B;font-weight:600;">Idade:</span>
          </td>
          <td width="25%" style="padding:10px 4px;background:#F8FAFC;font-size:9.5pt;border-top:1px solid #E2E8F0;">
            <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 20px 10px;background:#F8FAFC;font-size:9.5pt;">
            <span style="color:#64748B;font-weight:600;">Sexo:</span>
          </td>
          <td style="padding:6px 4px 10px;background:#F8FAFC;font-size:9.5pt;">
            <span style="color:#0F172A;font-weight:500;">${sections.identificacao?.sexo || 'N/I'}</span>
          </td>
          <td style="padding:6px 20px 10px;background:#F8FAFC;font-size:9.5pt;">
            <span style="color:#64748B;font-weight:600;">Data da Consulta:</span>
          </td>
          <td style="padding:6px 4px 10px;background:#F8FAFC;font-size:9.5pt;">
            <span style="color:#0F172A;font-weight:500;">${dateShort}</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

  <!-- Document title -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:22px 32px 20px 32px;">
    <tr><td style="text-align:center;padding:12px 0;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;">
      <table cellpadding="0" cellspacing="0" align="center">
        <tr><td style="font-family:'Merriweather',serif;font-size:13pt;font-weight:700;color:#0B3D6B;letter-spacing:4px;text-transform:uppercase;text-align:center;">Laudo Médico</td></tr>
        <tr><td style="text-align:center;padding-top:8px;"><table cellpadding="0" cellspacing="0" align="center"><tr><td style="width:40px;height:3px;background:linear-gradient(90deg,#C7944A,#D4A84B);font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Clinical sections wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;">
    <tr><td>

    ${anamnese ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#0B3D6B;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${anamneseNum}</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Anamnese</td></tr>
            <tr><td style="font-size:10pt;line-height:1.75;color:#334155;text-align:justify;padding-top:8px;">
              ${sections.queixa ? `<strong style="color:#0B3D6B;">Queixa Principal:</strong> ${fmt(sections.queixa)}<br><br>` : ''}
              ${sections.hda ? `<strong style="color:#0B3D6B;">História da Doença Atual:</strong><br>${fmt(sections.hda)}` : ''}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${sections.exame_fisico ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#1565A8;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${examNum}</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Exame Físico</td></tr>
            <tr><td style="font-size:10pt;line-height:1.75;color:#334155;text-align:justify;padding-top:8px;">${fmt(sections.exame_fisico)}</td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${(sections.hipoteses?.principal || sections.hipoteses?.diferencial) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#0B3D6B;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${hipNum}</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Hipótese Diagnóstica</td></tr>
            <tr><td style="padding-top:8px;">

              ${sections.hipoteses?.principal ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:2px solid #0B3D6B;">
                <tr><td style="background:linear-gradient(135deg,#0B3D6B,#1565A8);padding:6px 16px;font-size:7pt;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1.5px;">Hipótese Principal</td></tr>
                <tr><td style="padding:12px 16px;font-size:10.5pt;font-weight:600;color:#0F172A;background:#fff;">${fmt(sections.hipoteses.principal)}</td></tr>
              </table>` : ''}

              ${sections.hipoteses?.diferencial ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:1px solid #E2E8F0;">
                <tr><td style="background:#F1F5F9;padding:6px 16px;font-size:7pt;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #E2E8F0;">Diagnóstico Diferencial</td></tr>
                <tr><td style="padding:12px 16px;font-size:10.5pt;font-weight:500;color:#334155;background:#fff;">${fmt(sections.hipoteses.diferencial)}</td></tr>
              </table>` : ''}

            </td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${sections.cid10 && sections.cid10.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#C7944A;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">C</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Classificação CID-10</td></tr>
            <tr><td style="padding-top:8px;">
              ${sections.cid10.map(c => `<span style="display:inline-block;padding:3px 14px;background:#0B3D6B;color:#fff;border-radius:20px;font-size:8pt;font-weight:600;letter-spacing:0.5px;margin:2px 4px 2px 0;">${c}</span>`).join('')}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${redFlags && redFlags.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFF5F5;border:1px solid #FECACA;border-left:4px solid #DC2626;padding:12px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:8.5pt;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">⚠ Sinais de Alerta</td></tr>
            ${redFlags.map(f => `<tr><td style="font-size:9pt;color:#7F1D1D;padding:3px 0 3px 16px;">▲ ${f}</td></tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${(complementaryExams && complementaryExams.length > 0) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#1565A8;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${examsCompNum}</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Exames Complementares</td></tr>
            ${complementaryExams.map(e => `<tr><td style="font-size:9.5pt;color:#334155;padding:3px 0 3px 14px;">→ ${e}</td></tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${sections.conduta ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#0B3D6B;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${condutaNum}</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Conduta</td></tr>
            <tr><td style="font-size:10pt;line-height:1.75;color:#334155;text-align:justify;padding-top:8px;">${fmt(sections.conduta)}</td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    ${sections.embasamento_teorico ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-top:2px;">
          <table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#64748B;border-radius:6px;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:26px;">R</td></tr></table>
        </td>
        <td valign="top" style="padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:10pt;font-weight:700;color:#0B3D6B;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;">Embasamento Teórico</td></tr>
            <tr><td style="padding-top:8px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #BFDBFE;background:#F0F7FF;">
                <tr><td style="padding:14px 18px;font-size:9pt;color:#1E40AF;line-height:1.7;">${fmt(sections.embasamento_teorico)}</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>` : ''}

    </td></tr>
  </table>

  <!-- Signature -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 32px 0 32px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="min-width:260px;">
        <tr><td style="border-bottom:2px solid #0B3D6B;padding-bottom:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="text-align:center;font-size:11pt;font-weight:700;color:#0B3D6B;padding-top:6px;">Dr(a). ${doctorName}</td></tr>
        ${doctorCrm ? `<tr><td style="text-align:center;font-size:9pt;color:#1565A8;font-weight:600;">CRM ${doctorCrm}${doctorCrmUf ? '/' + doctorCrmUf : ''}</td></tr>` : ''}
        ${doctorSpecialty ? `<tr><td style="text-align:center;font-size:8.5pt;color:#64748B;">${doctorSpecialty}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 32px 0 32px;">
    <tr><td colspan="2" style="border-top:1px solid #E2E8F0;padding-top:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td width="60%" valign="bottom" style="font-size:7pt;color:#94A3B8;line-height:1.8;">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="font-size:7pt;color:#64748B;font-weight:700;">Emitido via MindMed AI <span style="font-weight:400;color:#94A3B8;">— Laudos Médicos Inteligentes</span></td></tr>
          <tr><td style="font-size:7pt;color:#94A3B8;">Documento protegido pela LGPD (Lei nº 13.709/2018)</td></tr>
          <tr><td style="font-size:7pt;color:#94A3B8;">Gerado em ${dateFormatted} às ${timeFormatted}</td></tr>
        </table>
      </td>
      <td width="40%" align="right" valign="bottom" style="text-align:right;">
        <table cellpadding="0" cellspacing="0" align="right">
          <tr><td style="font-size:6.5pt;color:#94A3B8;text-align:right;">Verificação Digital</td></tr>
          <tr><td style="text-align:right;padding-top:3px;">
            <table cellpadding="0" cellspacing="0" align="right"><tr><td style="font-family:'Courier New',monospace;font-size:5.5pt;color:#94A3B8;background:#F8FAFC;padding:2px 8px;border:1px solid #E2E8F0;">${hash.substring(0, 32)}...</td></tr></table>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Bottom accent -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding-top:16px;"><tr><td style="height:3px;background:linear-gradient(90deg,#0B3D6B 0%,#1565A8 35%,#C7944A 65%,#D4A84B 100%);font-size:0;line-height:0;">&nbsp;</td></tr></table>

</div>
</body>
</html>`.trim();
}
