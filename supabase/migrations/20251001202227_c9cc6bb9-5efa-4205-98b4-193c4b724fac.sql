-- Adicionar campos para suporte a transcrição e modo streaming
ALTER TABLE public.laudos
ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS transcript_segments jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generation_mode text DEFAULT 'complete',
ADD COLUMN IF NOT EXISTS last_update_type text;

-- Criar índice para buscar laudos em processamento
CREATE INDEX IF NOT EXISTS idx_laudos_transcript_status 
ON public.laudos(transcript_status) 
WHERE transcript_status IN ('processing', 'pending');

-- Criar índice para buscar laudos por status de áudio
CREATE INDEX IF NOT EXISTS idx_laudos_audio_status 
ON public.laudos(audio_processing_status) 
WHERE audio_processing_status IN ('processing', 'pending');

COMMENT ON COLUMN public.laudos.transcript_status IS 'Status da transcrição: pending, processing, completed, error';
COMMENT ON COLUMN public.laudos.transcript_segments IS 'Segmentos de transcrição com timestamps: [{text, start, end, confidence}]';
COMMENT ON COLUMN public.laudos.generation_mode IS 'Modo de geração: complete, delta, streaming';
COMMENT ON COLUMN public.laudos.last_update_type IS 'Último tipo de atualização: transcript_delta, patient_data, manual';