import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('transcribe-audio: Starting request');
    
    const authHeader = req.headers.get('Authorization');
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

    const { audio_url, audio_path, laudo_id, mode = 'complete' } = await req.json();

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

    const OPENAI_API_KEY = Deno.env.get('API_keys') || Deno.env.get('API_key') || Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('Chave da OpenAI não configurada');
    }

    // Baixar áudio (preferir storage path)
    let audioBlob: Blob;
    let fileName = 'audio.webm';

    if (audio_path) {
      const { data: blob, error: downloadError } = await supabase
        .storage
        .from('audio-files')
        .download(audio_path);

      if (downloadError || !blob) {
        console.error('Erro ao baixar do storage:', downloadError);
        throw new Error('Falha ao baixar áudio do storage');
      }

      audioBlob = blob as Blob;
      const ext = (audio_path.split('.').pop() || 'webm').toLowerCase();
      fileName = `audio.${ext}`;
    } else if (audio_url) {
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        throw new Error('Falha ao baixar áudio via URL');
      }
      audioBlob = await audioResponse.blob();

      // Determine file extension based on URL
      if (audio_url.includes('.opus')) fileName = 'audio.opus';
      else if (audio_url.includes('.mp3')) fileName = 'audio.mp3';
      else if (audio_url.includes('.wav')) fileName = 'audio.wav';
      else if (audio_url.includes('.m4a')) fileName = 'audio.m4a';
      else if (audio_url.includes('.ogg')) fileName = 'audio.ogg';
    } else {
      throw new Error('Nenhuma fonte de áudio fornecida');
    }

    // Prepare form data for OpenAI
    const formData = new FormData();
    formData.append('file', audioBlob, fileName);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json'); // Get timestamps
    formData.append('language', 'pt');

    const startTime = Date.now();

    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const latencyMs = Date.now() - startTime;

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('OpenAI transcription error:', transcribeResponse.status, errorText);
      
      await supabase
        .from('laudos')
        .update({ 
          transcript_status: 'error',
          audio_processing_status: 'error' 
        })
        .eq('id', laudo_id)
        .eq('user_id', user.id);

      throw new Error(`Erro na transcrição: ${transcribeResponse.status}`);
    }

    const transcriptionData = await transcribeResponse.json();
    
    // Process segments with timestamps
    const segments = transcriptionData.segments?.map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.95,
    })) || [];

    const fullTranscript = {
      text: transcriptionData.text,
      language: transcriptionData.language,
      duration: transcriptionData.duration,
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
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
