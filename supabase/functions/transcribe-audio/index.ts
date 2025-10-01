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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { audio_url, laudo_id, mode = 'complete' } = await req.json();

    if (!audio_url || !laudo_id) {
      return new Response(JSON.stringify({ error: 'audio_url e laudo_id são obrigatórios' }), {
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

    const OPENAI_API_KEY = Deno.env.get('API_keys');
    if (!OPENAI_API_KEY) {
      throw new Error('API_keys não configurada');
    }

    // Download audio from storage
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error('Falha ao baixar áudio');
    }

    const audioBlob = await audioResponse.blob();
    
    // Prepare form data for OpenAI
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
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
