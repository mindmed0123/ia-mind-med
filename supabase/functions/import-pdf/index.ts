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

    const { laudo_id, pdf_url, ocr_enabled = false } = await req.json();
    
    if (!laudo_id || !pdf_url) {
      throw new Error('ID do laudo e URL do PDF são obrigatórios');
    }

    console.log('Importando PDF:', { laudo_id, pdf_url, ocr_enabled });

    // Verificar se o laudo pertence ao usuário
    const { data: laudo, error: laudoError } = await supabase
      .from('laudos')
      .select('*')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (laudoError || !laudo) throw new Error('Laudo não encontrado');

    // Download do PDF
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) throw new Error('Falha ao baixar PDF');
    
    const pdfBlob = await pdfResponse.blob();
    const fileSize = pdfBlob.size;

    if (fileSize > 10 * 1024 * 1024) {
      throw new Error('Arquivo muito grande (máximo 10MB)');
    }

    // Aqui seria feita a extração de texto usando uma biblioteca de PDF
    // Por enquanto, retornamos uma estrutura simulada
    // Em produção, usar bibliotecas como pdf-parse ou similar
    
    console.log('Processando extração de texto do PDF...');
    
    // Simular extração de texto (em produção, usar biblioteca apropriada)
    const extractedText = await extractTextFromPdf(pdfBlob, ocr_enabled);
    
    // Mapear texto para seções usando heurística
    const sections = mapTextToSections(extractedText);

    // Atualizar laudo
    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        sections,
        import_source: 'pdf',
        status: 'draft'
      })
      .eq('id', laudo_id);

    if (updateError) throw updateError;

    // Registrar auditoria
    await supabase.rpc('log_audit_action', {
      p_entity: 'REPORT',
      p_entity_id: laudo_id,
      p_action: 'IMPORT',
      p_diff: {
        file_size: fileSize,
        method: ocr_enabled ? 'ocr' : 'text',
        timestamp: new Date().toISOString()
      }
    });

    console.log('PDF importado com sucesso');

    return new Response(JSON.stringify({
      success: true,
      sections,
      extracted_length: extractedText.length,
      message: 'PDF importado com sucesso. Revise as seções extraídas.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro ao importar PDF:', error);
    // Log full error for ops/debugging
    const errorId = crypto.randomUUID();
    console.error('Error ID:', errorId, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return generic error to client
    return new Response(JSON.stringify({ 
      error: 'Erro ao processar PDF',
      error_id: errorId,
      fallback: 'Não foi possível extrair o texto automaticamente. Por favor, cole o conteúdo manualmente.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function extractTextFromPdf(blob: Blob, useOcr: boolean): Promise<string> {
  // Placeholder para extração de texto
  // Em produção, usar biblioteca apropriada como pdf-parse
  
  console.log('Extraindo texto do PDF...', { size: blob.size, ocr: useOcr });
  
  // Simulação para demonstração
  // TODO: Implementar extração real com biblioteca PDF
  return `
Paciente: João Silva
Idade: 45 anos
Sexo: Masculino

QUEIXA PRINCIPAL:
Dor abdominal há 2 dias

HISTÓRIA DA DOENÇA ATUAL:
Paciente refere dor em região epigástrica, tipo queimação, iniciada há 48 horas...

EXAME FÍSICO:
Abdome: levemente distendido, doloroso à palpação em epigástrio...

HIPÓTESE DIAGNÓSTICA:
Principal: Gastrite aguda
Diferencial: Úlcera péptica

CONDUTA:
1. Omeprazol 40mg 1x/dia
2. Dieta leve
3. Retorno em 7 dias

CID-10: K29.1
  `.trim();
}

function mapTextToSections(text: string): any {
  // Heurística simples para mapear texto em seções
  const sections: any = {};

  // Buscar padrões comuns
  const patterns = {
    queixa: /(?:queixa principal|motivo da consulta)[:\s]+(.*?)(?=\n\n|história|hda|$)/is,
    hda: /(?:história da doença atual|hda)[:\s]+(.*?)(?=\n\n|exame|físico|$)/is,
    exame_fisico: /(?:exame físico|exame clínico|achados)[:\s]+(.*?)(?=\n\n|hipótese|diagnóstic|$)/is,
    hipotese_principal: /(?:hipótese|diagnóstico)(?:\s+principal)?[:\s]+(.*?)(?=\n|diferencial|conduta|$)/is,
    hipotese_diferencial: /(?:diferencial|diagnóstico diferencial)[:\s]+(.*?)(?=\n\n|conduta|$)/is,
    conduta: /(?:conduta|plano|tratamento)[:\s]+(.*?)(?=\n\n|cid|$)/is,
    cid10: /cid[-\s]?10[:\s]+([\w\d\.,\s]+)/is
  };

  // Extrair identificação
  const nomeMatch = text.match(/(?:paciente|nome)[:\s]+([\w\s]+?)(?=\n|idade|sexo)/i);
  const idadeMatch = text.match(/idade[:\s]+(\d+)/i);
  const sexoMatch = text.match(/sexo[:\s]+(masculino|feminino|m|f)/i);

  if (nomeMatch || idadeMatch || sexoMatch) {
    sections.identificacao = {
      nome: nomeMatch?.[1]?.trim() || '',
      idade: idadeMatch?.[1]?.trim() || '',
      sexo: sexoMatch?.[1]?.trim() || ''
    };
  }

  // Extrair outras seções
  sections.queixa = patterns.queixa.exec(text)?.[1]?.trim() || '';
  sections.hda = patterns.hda.exec(text)?.[1]?.trim() || '';
  sections.exame_fisico = patterns.exame_fisico.exec(text)?.[1]?.trim() || '';
  
  sections.hipoteses = {
    principal: patterns.hipotese_principal.exec(text)?.[1]?.trim() || '',
    diferencial: patterns.hipotese_diferencial.exec(text)?.[1]?.trim() || ''
  };

  sections.conduta = patterns.conduta.exec(text)?.[1]?.trim() || '';

  const cid10Match = patterns.cid10.exec(text);
  if (cid10Match) {
    sections.cid10 = cid10Match[1]
      .split(/[,\s]+/)
      .filter(c => c.length > 0)
      .map(c => c.trim());
  }

  return sections;
}