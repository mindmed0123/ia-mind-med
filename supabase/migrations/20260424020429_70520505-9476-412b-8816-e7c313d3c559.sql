-- Add scientific_basis column to laudos for PubMed-grounded references
ALTER TABLE public.laudos
  ADD COLUMN IF NOT EXISTS scientific_basis jsonb DEFAULT NULL;

COMMENT ON COLUMN public.laudos.scientific_basis IS
  'Embasamento científico do laudo: { summary, justification, articles: [{pmid,title,authors,journal,year,url,abstract}], guidelines: [{name,source,url}] }';