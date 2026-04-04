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

    // Rate limiting
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

    const { data: laudo, error: laudoError } = await supabase
      .from('laudos')
      .select('*')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (laudoError || !laudo) throw new Error('Laudo não encontrado');

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Build sections
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

    if (!sections.hipoteses?.principal && !laudo.report_markdown) {
      throw new Error('Laudo incompleto: gere o laudo antes de exportar o PDF');
    }

    // Hash
    const contentForHash = JSON.stringify({
      id: laudo.id, sections, user_id: user.id,
      timestamp: new Date().toISOString()
    });
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contentForHash));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const verifyToken = btoa(JSON.stringify({
      id: laudo.id, hash, exp: Date.now() + (90 * 24 * 60 * 60 * 1000)
    }));

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateShort = now.toLocaleDateString('pt-BR');

    const redFlags = laudo.red_flags as string[] | null;
    const complementaryExams = laudo.complementary_exams as string[] | null;

    const html = generateContentHtml(sections, dateShort, redFlags, complementaryExams);

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

    await adminClient.from('laudos').update({
      pdf_hash: hash, pdf_verify_token: verifyToken
    }).eq('id', laudo.id);

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
 * Premium Hospital-Grade Content HTML
 * Clean grid, consistent spacing, institutional typography
 */
function generateContentHtml(
  sections: PdfSection,
  dateShort: string,
  redFlags: string[] | null,
  complementaryExams: string[] | null,
): string {
  const fmt = (text: string) => text ? text.replace(/\n/g, '<br>') : '';

  let sectionNum = 1;
  const nextNum = () => String(sectionNum++).padStart(2, '0');

  const anamnese = sections.queixa || sections.hda;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
    font-size: 9.5pt;
    line-height: 1.65;
    color: #1E293B;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .content-wrapper {
    width: 100%;
    padding: 0;
  }

  .section-block {
    page-break-inside: avoid;
    margin-bottom: 16px;
  }

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

  /* ── Section Header ── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #E2E8F0;
  }

  .section-number {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: linear-gradient(135deg, #0B3D6B, #1565A8);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    line-height: 28px;
    flex-shrink: 0;
  }

  .section-label {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 11pt;
    font-weight: 700;
    color: #0B3D6B;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }

  .section-body {
    font-size: 9.5pt;
    line-height: 1.75;
    color: #334155;
    text-align: justify;
    padding: 4px 0 0 38px;
  }

  .subsection-label {
    font-weight: 600;
    color: #0B3D6B;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
</style>
</head>
<body>
<div class="content-wrapper">

  <!-- ═══════════ PATIENT IDENTIFICATION CARD ═══════════ -->
  <div class="section-block" style="margin-bottom: 20px;">
    <table style="border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
      <tr>
        <td colspan="4" style="background: linear-gradient(135deg, #0B3D6B 0%, #1565A8 100%); padding: 8px 18px;">
          <span style="color: #fff; font-family: 'Merriweather', serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px;">Identificação do Paciente</span>
        </td>
      </tr>
      <tr>
        <td style="width: 15%; padding: 10px 18px; background: #F8FAFC; border-right: 1px solid #E2E8F0; border-top: 1px solid #E2E8F0;">
          <div style="color: #94A3B8; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Paciente</div>
          <div style="color: #0F172A; font-size: 10pt; font-weight: 600;">${sections.identificacao?.nome || 'Não informado'}</div>
        </td>
        <td style="width: 15%; padding: 10px 18px; background: #F8FAFC; border-right: 1px solid #E2E8F0; border-top: 1px solid #E2E8F0;">
          <div style="color: #94A3B8; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Idade</div>
          <div style="color: #0F172A; font-size: 10pt; font-weight: 600;">${sections.identificacao?.idade || 'N/I'}${sections.identificacao?.idade && sections.identificacao.idade !== 'N/I' ? ' anos' : ''}</div>
        </td>
        <td style="width: 15%; padding: 10px 18px; background: #F8FAFC; border-right: 1px solid #E2E8F0; border-top: 1px solid #E2E8F0;">
          <div style="color: #94A3B8; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Sexo</div>
          <div style="color: #0F172A; font-size: 10pt; font-weight: 600;">${sections.identificacao?.sexo || 'N/I'}</div>
        </td>
        <td style="width: 15%; padding: 10px 18px; background: #F8FAFC; border-top: 1px solid #E2E8F0;">
          <div style="color: #94A3B8; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Data</div>
          <div style="color: #0F172A; font-size: 10pt; font-weight: 600;">${dateShort}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══════════ DOCUMENT TITLE ═══════════ -->
  <div class="section-block" style="text-align: center; padding: 16px 0 20px 0; margin-bottom: 20px;">
    <div style="font-family: 'Merriweather', Georgia, serif; font-size: 16pt; font-weight: 900; color: #0B3D6B; letter-spacing: 6px; text-transform: uppercase;">Laudo Médico</div>
    <div style="width: 60px; height: 3px; background: linear-gradient(90deg, #0B3D6B, #C7944A); margin: 10px auto 0 auto; border-radius: 2px;"></div>
  </div>

  <!-- ═══════════ ANAMNESE ═══════════ -->
  ${anamnese ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number">${nextNum()}</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 10px;">Anamnese</div>
        <div style="padding-top: 6px;">
          ${sections.queixa ? `
          <div style="margin-bottom: 12px;">
            <div class="subsection-label">Queixa Principal</div>
            <div style="font-size: 9.5pt; line-height: 1.75; color: #334155; text-align: justify;">${fmt(sections.queixa)}</div>
          </div>` : ''}
          ${sections.hda ? `
          <div>
            <div class="subsection-label">História da Doença Atual</div>
            <div style="font-size: 9.5pt; line-height: 1.75; color: #334155; text-align: justify;">${fmt(sections.hda)}</div>
          </div>` : ''}
        </div>
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ EXAME FÍSICO ═══════════ -->
  ${sections.exame_fisico ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number">${nextNum()}</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 10px;">Exame Físico</div>
        <div style="font-size: 9.5pt; line-height: 1.75; color: #334155; text-align: justify; padding-top: 6px;">${fmt(sections.exame_fisico)}</div>
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ HIPÓTESE DIAGNÓSTICA ═══════════ -->
  ${(sections.hipoteses?.principal || sections.hipoteses?.diferencial) ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number">${nextNum()}</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 12px;">Hipótese Diagnóstica</div>
        
        ${sections.hipoteses?.principal ? `
        <div style="border: 2px solid #0B3D6B; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
          <div style="background: linear-gradient(135deg, #0B3D6B, #1565A8); padding: 6px 16px;">
            <span style="color: #C7944A; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Hipótese Principal</span>
          </div>
          <div style="padding: 12px 16px; font-size: 10pt; font-weight: 600; color: #0F172A; line-height: 1.6; background: #FAFCFF;">${fmt(sections.hipoteses.principal)}</div>
        </div>` : ''}

        ${sections.hipoteses?.diferencial ? `
        <div style="border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden;">
          <div style="background: #F1F5F9; padding: 6px 16px; border-bottom: 1px solid #E2E8F0;">
            <span style="color: #64748B; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Diagnóstico Diferencial</span>
          </div>
          <div style="padding: 12px 16px; font-size: 9.5pt; font-weight: 500; color: #475569; line-height: 1.6;">${fmt(sections.hipoteses.diferencial)}</div>
        </div>` : ''}
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ CID-10 ═══════════ -->
  ${sections.cid10 && sections.cid10.length > 0 ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number" style="background: linear-gradient(135deg, #C7944A, #D4A84B); font-size: 9px;">CID</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 10px;">Classificação CID-10</div>
        <div style="padding-top: 6px;">
          ${sections.cid10.map(c => `<span style="display: inline-block; padding: 4px 14px; background: linear-gradient(135deg, #0B3D6B, #1565A8); color: #fff; border-radius: 20px; font-size: 8pt; font-weight: 600; letter-spacing: 0.8px; margin: 3px 6px 3px 0;">${c}</span>`).join('')}
        </div>
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ RED FLAGS ═══════════ -->
  ${redFlags && redFlags.length > 0 ? `
  <div class="section-block">
    <div style="background: #FFF5F5; border: 1px solid #FECACA; border-left: 4px solid #DC2626; border-radius: 8px; padding: 14px 18px;">
      <div style="font-family: 'Merriweather', serif; font-size: 9pt; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">⚠ Sinais de Alerta</div>
      ${redFlags.map(f => `<div style="font-size: 9pt; color: #7F1D1D; padding: 4px 0 4px 16px; line-height: 1.6; border-bottom: 1px solid #FEE2E2;">▸ ${f}</div>`).join('')}
    </div>
  </div>` : ''}

  <!-- ═══════════ EXAMES COMPLEMENTARES ═══════════ -->
  ${(complementaryExams && complementaryExams.length > 0) ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number">${nextNum()}</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 10px;">Exames Complementares</div>
        <div style="padding-top: 6px;">
          ${complementaryExams.map(e => `<div style="font-size: 9.5pt; color: #334155; padding: 5px 0 5px 16px; line-height: 1.5; border-bottom: 1px solid #F1F5F9;">
            <span style="color: #1565A8; font-weight: 600;">→</span> ${e}
          </div>`).join('')}
        </div>
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ CONDUTA ═══════════ -->
  ${sections.conduta ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number" style="background: linear-gradient(135deg, #0B3D6B, #0F4C81);">${nextNum()}</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #0B3D6B; margin-bottom: 10px;">Conduta</div>
        <div style="font-size: 10pt; line-height: 1.8; color: #1E293B; text-align: justify; padding: 8px 0; font-weight: 500;">${fmt(sections.conduta)}</div>
      </td>
    </tr></table>
  </div>` : ''}

  <!-- ═══════════ EMBASAMENTO TEÓRICO ═══════════ -->
  ${sections.embasamento_teorico ? `
  <div class="section-block">
    <table><tr>
      <td style="width: 38px; vertical-align: top; padding-top: 1px;">
        <div class="section-number" style="background: #64748B; font-size: 9px;">REF</div>
      </td>
      <td style="vertical-align: top;">
        <div style="font-family: 'Merriweather', serif; font-size: 11pt; font-weight: 700; color: #0B3D6B; text-transform: uppercase; letter-spacing: 1.2px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; margin-bottom: 10px;">Embasamento Teórico</div>
        <div style="border: 1px solid #BFDBFE; background: linear-gradient(135deg, #F0F7FF, #EFF6FF); border-radius: 8px; padding: 12px 16px; font-size: 9pt; color: #1E40AF; line-height: 1.75; margin-top: 6px;">${fmt(sections.embasamento_teorico)}</div>
      </td>
    </tr></table>
  </div>` : ''}

</div>
</body>
</html>`.trim();
}
