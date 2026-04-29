import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  CLINICAL_WHISPER_PROMPT_PT_BR,
  processWhisperSegments,
  transcriptFromSegments,
} from "../_shared/clinical-transcription.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured logger - never logs PHI/PII
function log(correlationId: string, step: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), fn: 'transcribe-audio', cid: correlationId, step, ...data };
  console.log(JSON.stringify(entry));
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  let currentLaudoId: string | null = null;
  let currentUserId: string | null = null;
  let currentAuthHeader: string | null = null;

  try {
    log(correlationId, 'start');
    
    const authHeader = req.headers.get('Authorization');
    currentAuthHeader = authHeader;
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado: header ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwtMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!jwtMatch) {
      return new Response(JSON.stringify({ error: 'Formato de autorização inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const jwt = jwtMatch[1];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    currentUserId = user.id;
    log(correlationId, 'auth_ok', { uid: user.id.substring(0, 8) });

    const { audio_url, audio_path, laudo_id, mode = 'fast' } = await req.json();
    currentLaudoId = laudo_id;

    if ((!audio_url && !audio_path) || !laudo_id) {
      return new Response(JSON.stringify({ error: 'Forneça audio_path (preferido) ou audio_url e o laudo_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== IDEMPOTENCY CHECK =====
    const { data: existingLaudo } = await supabase
      .from('laudos')
      .select('transcript_status, patient_data, clinical_context, specialty, generation_mode')
      .eq('id', laudo_id)
      .eq('user_id', user.id)
      .single();

    if (existingLaudo?.transcript_status === 'completed') {
      log(correlationId, 'idempotent_skip', { laudo_id });
      return new Response(JSON.stringify({
        success: true,
        idempotent: true,
        message: 'Transcrição já concluída.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== RATE LIMITING =====
    // Max 3 transcriptions per user per minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount } = await supabase
      .from('laudos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('audio_processing_status', ['processing', 'completed'])
      .gte('updated_at', oneMinuteAgo);

    if (recentCount !== null && recentCount >= 3) {
      log(correlationId, 'rate_limited', { count: recentCount });
      return new Response(JSON.stringify({
        error: 'Limite de transcrições atingido. Aguarde 1 minuto.',
        retry_after: 60,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // Update status to processing
    await supabase
      .from('laudos')
      .update({ 
        transcript_status: 'processing',
        audio_processing_status: 'processing' 
      })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key não configurada');
    }

    // Download audio
    let audioBlob: Blob;
    let fileName = 'audio.webm';
    let mimeType = 'audio/webm';

    if (audio_path) {
      const { data: blob, error: downloadError } = await supabase
        .storage
        .from('audio-files')
        .download(audio_path);

      if (downloadError || !blob) {
        throw new Error('Falha ao baixar áudio do storage');
      }

      const ext = (audio_path.split('.').pop() || 'webm').toLowerCase();
      fileName = `audio.${ext}`;
      
      const mimeMap: Record<string, string> = {
        'webm': 'audio/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'm4a': 'audio/mp4', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
      };
      mimeType = mimeMap[ext] || 'audio/webm';
      audioBlob = new Blob([blob], { type: mimeType });
      log(correlationId, 'audio_downloaded', { ext, size: blob.size });
    } else if (audio_url) {
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        throw new Error('Falha ao baixar áudio via URL');
      }
      const originalBlob = await audioResponse.blob();

      let ext = 'webm';
      if (audio_url.match(/\.(mp3)(\?.*)?$/i)) ext = 'mp3';
      else if (audio_url.match(/\.(wav)(\?.*)?$/i)) ext = 'wav';
      else if (audio_url.match(/\.(m4a)(\?.*)?$/i)) ext = 'm4a';
      else if (audio_url.match(/\.(ogg|oga)(\?.*)?$/i)) ext = 'ogg';
      else if (audio_url.match(/\.(flac)(\?.*)?$/i)) ext = 'flac';
      else if (audio_url.match(/\.(mp4)(\?.*)?$/i)) ext = 'mp4';

      const mimeMap: Record<string, string> = {
        'webm': 'audio/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'm4a': 'audio/mp4', 'ogg': 'audio/ogg', 'flac': 'audio/flac', 'mp4': 'audio/mp4',
      };
      const contentType = audioResponse.headers.get('content-type') || '';
      mimeType = contentType && contentType.startsWith('audio/') ? contentType : (mimeMap[ext] || 'audio/webm');
      fileName = `audio.${ext}`;

      const allowedMimes = new Set(['audio/webm','audio/ogg','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/flac']);
      if (!allowedMimes.has(mimeType)) {
        return new Response(JSON.stringify({ error: 'Formato de áudio não suportado. Use webm, ogg, mp3, wav, m4a, flac ou mp4.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      audioBlob = new Blob([originalBlob], { type: mimeType });
      log(correlationId, 'audio_fetched_url', { ext, size: originalBlob.size });
    } else {
      throw new Error('Nenhuma fonte de áudio fornecida');
    }

    // Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, fileName);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    // Greedy decoding for clinical reproducibility
    formData.append('temperature', '0');
    // Clinical priming for PT-BR medical vocabulary (meds, anatomy, CID-10, vitals)
    formData.append('prompt', CLINICAL_WHISPER_PROMPT_PT_BR);

    const startTime = Date.now();

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort('timeout'), 120000);
    let transcribeResponse: Response;
    try {
      transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: formData,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
    log(correlationId, 'whisper_response', { status: transcribeResponse.status, latency_ms: latencyMs });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      log(correlationId, 'whisper_error', { status: transcribeResponse.status });
      
      await supabase
        .from('laudos')
        .update({ transcript_status: 'error', audio_processing_status: 'error' })
        .eq('id', laudo_id)
        .eq('user_id', user.id);

      let clientStatus = transcribeResponse.status;
      let message = 'Erro na transcrição do áudio';
      try {
        const parsed = JSON.parse(errorText);
        const err = parsed?.error;
        if (err?.code === 'insufficient_quota' || err?.type === 'insufficient_quota') {
          clientStatus = 402;
          message = 'Créditos insuficientes na API de transcrição.';
        } else if (err?.message) {
          message = err.message;
        }
      } catch (_) { /* ignore parse errors */ }

      return new Response(JSON.stringify({ error: message, provider_status: transcribeResponse.status }), {
        status: clientStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcriptionData = await transcribeResponse.json();
    // Apply hallucination filter + clinical normalization. We rebuild the
    // text from cleaned segments so the saved transcript matches what we
    // actually consider valid speech.
    const segments = processWhisperSegments(transcriptionData.segments || [], 0);
    const transcriptText = transcriptFromSegments(segments) ||
      (transcriptionData.text || "").trim();

    if (!transcriptText) {
      throw new Error('Transcrição vazia retornada pela API');
    }

    log(correlationId, 'segments_processed', {
      raw: transcriptionData.segments?.length || 0,
      kept: segments.length,
      dropped: (transcriptionData.segments?.length || 0) - segments.length,
    });

    const fullTranscript = {
      text: transcriptText,
      language: transcriptionData.language || 'pt',
      duration: transcriptionData.duration || 0,
      segments,
    };

    const { error: updateError } = await supabase
      .from('laudos')
      .update({
        transcript: fullTranscript,
        transcript_segments: segments,
        transcript_status: 'completed',
        audio_processing_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', laudo_id)
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error('Erro ao salvar transcrição');
    }

    const patientData = asObject(existingLaudo?.patient_data);
    const clinicalContext = asObject(existingLaudo?.clinical_context);
    const generationMode = typeof existingLaudo?.generation_mode === 'string' ? existingLaudo.generation_mode : mode;

    const generatePayload = {
      patient: {
        iniciais: typeof patientData.iniciais === 'string' ? patientData.iniciais : 'N/I',
        sexo: typeof patientData.sexo === 'string' ? patientData.sexo : 'Não informado',
        idade: Number(patientData.idade) || 0,
      },
      specialty:
        (typeof clinicalContext.specialty === 'string' && clinicalContext.specialty) ||
        (typeof patientData.especialidade === 'string' && patientData.especialidade) ||
        (typeof existingLaudo?.specialty === 'string' && existingLaudo.specialty) ||
        'Não especificada',
      chief_complaint:
        (typeof patientData.queixa_principal === 'string' && patientData.queixa_principal) ||
        (typeof clinicalContext.chief_complaint === 'string' && clinicalContext.chief_complaint) ||
        'Não informada',
      transcript: transcriptText,
      vitals: asObject(patientData.sinais_vitais).PA || Object.keys(asObject(clinicalContext.vitals)).length
        ? { ...asObject(clinicalContext.vitals), ...asObject(patientData.sinais_vitais) }
        : {},
      meds: asArray(patientData.medicacoes).length ? asArray(patientData.medicacoes) : asArray(clinicalContext.meds),
      allergies: asArray(patientData.alergias).length ? asArray(patientData.alergias) : asArray(clinicalContext.allergies),
      exam_findings: typeof clinicalContext.exam_findings === 'string' ? clinicalContext.exam_findings : '',
      contexto_clinico:
        (typeof patientData.contexto_clinico === 'string' && patientData.contexto_clinico) ||
        (typeof clinicalContext.contexto_clinico === 'string' && clinicalContext.contexto_clinico) ||
        '',
      historico:
        (typeof patientData.historico === 'string' && patientData.historico) ||
        (typeof clinicalContext.historico === 'string' && clinicalContext.historico) ||
        '',
      laudo_id,
      mode: generationMode,
      template_specialty: typeof existingLaudo?.specialty === 'string' ? existingLaudo.specialty : undefined,
    };

    const generateUrl = `${supabaseUrl}/functions/v1/generate-laudo`;
    const generatePromise = fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(generatePayload),
    })
      .then(async (response) => {
        const body = await response.text();
        log(correlationId, 'generate_dispatch_response', {
          laudo_id,
          status: response.status,
          ok: response.ok,
          body_preview: body.slice(0, 180),
        });
      })
      .catch((dispatchError) => {
        log(correlationId, 'generate_dispatch_error', {
          laudo_id,
          message: dispatchError instanceof Error ? dispatchError.message : 'unknown',
        });
      });

    const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
    if (waitUntil) {
      waitUntil(generatePromise);
    }

    log(correlationId, 'complete', {
      laudo_id,
      duration: transcriptionData.duration,
      segments: segments.length,
      latency_ms: latencyMs,
    });

    return new Response(JSON.stringify({
      success: true,
      transcript: fullTranscript,
      metadata: {
        duration: transcriptionData.duration,
        segments: segments.length,
        latency_ms: latencyMs,
        correlation_id: correlationId,
          generation_dispatched: true,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log(correlationId, 'error', {
      message: error instanceof Error ? error.message : 'unknown',
      laudo_id: currentLaudoId,
    });

    // Ensure laudo doesn't stay stuck in "processing"
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: currentAuthHeader ? { headers: { Authorization: currentAuthHeader } } : undefined,
      });
      if (currentLaudoId && currentUserId) {
        await supabase
          .from('laudos')
          .update({
            transcript_status: 'error',
            audio_processing_status: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentLaudoId)
          .eq('user_id', currentUserId);
      }
    } catch (updateErr) {
      log(correlationId, 'error_status_update_fail');
    }

    return new Response(JSON.stringify({ 
      error: 'Erro ao processar transcrição. Tente novamente.',
      error_id: correlationId,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});