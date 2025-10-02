import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentLaudoId: string | null = null;
  let currentUserId: string | null = null;
  let currentAuthHeader: string | null = null;

  try {
    console.log('transcribe-audio: Starting request');
    
    const authHeader = req.headers.get('Authorization');
    currentAuthHeader = authHeader;
    console.log('transcribe-audio: Has auth header:', !!authHeader);
    
    if (!authHeader) {
      console.error('transcribe-audio: Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Não autorizado: header ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT from "Bearer <token>"
    const jwtMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!jwtMatch) {
      console.error('transcribe-audio: Invalid Authorization header format');
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

    console.log('transcribe-audio: Getting user with JWT');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError) {
      console.error('transcribe-audio: Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Erro ao autenticar: ' + userError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user) {
      console.error('transcribe-audio: No user found');
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('transcribe-audio: User authenticated:', user.id);

    currentUserId = user.id;

    const { audio_url, audio_path, laudo_id, mode = 'fast' } = await req.json();

    currentLaudoId = laudo_id;

    if ((!audio_url && !audio_path) || !laudo_id) {
      return new Response(JSON.stringify({ error: 'Forneça audio_path (preferido) ou audio_url e o laudo_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('Lovable AI não configurada');
    }

    // Baixar áudio (preferir storage path)
    let audioBlob: Blob;
    let fileName = 'audio.webm';
    let mimeType = 'audio/webm';

    if (audio_path) {
      const { data: blob, error: downloadError } = await supabase
        .storage
        .from('audio-files')
        .download(audio_path);

      if (downloadError || !blob) {
        console.error('Erro ao baixar do storage:', downloadError);
        throw new Error('Falha ao baixar áudio do storage');
      }

      const ext = (audio_path.split('.').pop() || 'webm').toLowerCase();
      fileName = `audio.${ext}`;
      
      // Map extensions to MIME types
      const mimeMap: Record<string, string> = {
        'webm': 'audio/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
      };
      mimeType = mimeMap[ext] || 'audio/webm';
      
      // Create new blob with correct MIME type
      audioBlob = new Blob([blob], { type: mimeType });
      console.log(`Audio downloaded: ${fileName}, type: ${mimeType}`);
    } else if (audio_url) {
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        throw new Error('Falha ao baixar áudio via URL');
      }
      const originalBlob = await audioResponse.blob();

      // Infer extension and MIME type
      const contentType = audioResponse.headers.get('content-type') || '';
      let ext = 'webm';
      if (audio_url.match(/\.(mp3)(\?.*)?$/i)) ext = 'mp3';
      else if (audio_url.match(/\.(wav)(\?.*)?$/i)) ext = 'wav';
      else if (audio_url.match(/\.(m4a)(\?.*)?$/i)) ext = 'm4a';
      else if (audio_url.match(/\.(ogg|oga)(\?.*)?$/i)) ext = 'ogg';
      else if (audio_url.match(/\.(flac)(\?.*)?$/i)) ext = 'flac';
      else if (audio_url.match(/\.(mp4)(\?.*)?$/i)) ext = 'mp4';
      else if (audio_url.match(/\.(webm)(\?.*)?$/i)) ext = 'webm';

      const mimeMap: Record<string, string> = {
        'webm': 'audio/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'mp4': 'audio/mp4',
      };
      mimeType = contentType && contentType.startsWith('audio/') ? contentType : (mimeMap[ext] || 'audio/webm');
      fileName = `audio.${ext}`;

      const allowedMimes = new Set(['audio/webm','audio/ogg','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/flac']);
      if (!allowedMimes.has(mimeType)) {
        return new Response(JSON.stringify({ error: 'Formato de áudio não suportado. Use webm, ogg, mp3, wav, m4a, flac ou mp4.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Normalize blob with correct MIME
      audioBlob = new Blob([originalBlob], { type: mimeType });
      console.log(`Audio fetched from URL: ${fileName}, type: ${mimeType}`);
    } else {
      throw new Error('Nenhuma fonte de áudio fornecida');
    }

    // Convert audio to base64 for Gemini (efficient encoding)
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = encodeBase64(new Uint8Array(arrayBuffer));

    const startTime = Date.now();

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort('timeout'), 120000);
    let transcribeResponse: Response;
    try {
      transcribeResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcreva este áudio em português brasileiro. Retorne APENAS a transcrição do texto falado, sem comentários adicionais. Inclua pontuação adequada.'
                },
                {
                  type: 'input_audio',
                  input_audio: {
                    data: base64Audio,
                    format: mimeType.split('/')[1] || 'mp3'
                  }
                }
              ]
            }
          ]
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('Lovable AI transcription error:', transcribeResponse.status, errorText);
      
      await supabase
        .from('laudos')
        .update({ 
          transcript_status: 'error',
          audio_processing_status: 'error' 
        })
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
      } catch (_) {
        // ignore parse errors
      }

      return new Response(JSON.stringify({ error: message, provider_status: transcribeResponse.status }), {
        status: clientStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcriptionData = await transcribeResponse.json();
    const transcriptText = transcriptionData.choices?.[0]?.message?.content || '';
    
    if (!transcriptText) {
      throw new Error('Transcrição vazia retornada pela IA');
    }

    // Split text into approximate segments (since Gemini doesn't provide timestamps)
    const words = transcriptText.split(' ');
    const segmentSize = 20; // words per segment
    const segments = [];
    for (let i = 0; i < words.length; i += segmentSize) {
      const segmentWords = words.slice(i, i + segmentSize);
      segments.push({
        text: segmentWords.join(' '),
        start: i * 0.5, // approximate timing
        end: (i + segmentWords.length) * 0.5,
        confidence: 0.85,
      });
    }

    const fullTranscript = {
      text: transcriptText,
      language: 'pt',
      duration: words.length * 0.5,
      segments,
    };

    // Update laudo with transcription
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
      console.error('Erro ao atualizar laudo com transcrição:', updateError);
      throw new Error('Erro ao salvar transcrição');
    }

    console.log('Transcrição concluída:', {
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
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função transcribe-audio:', error);

    // Garantir que o laudo não fique travado em "processing"
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
      console.error('Falha ao marcar laudo como erro após exceção:', updateErr);
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
