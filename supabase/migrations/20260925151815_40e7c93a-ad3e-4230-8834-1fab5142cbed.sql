ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS conselho text,
  ADD COLUMN IF NOT EXISTS registro_numero text,
  ADD COLUMN IF NOT EXISTS registro_uf text,
  ADD COLUMN IF NOT EXISTS especialidade text,
  ADD COLUMN IF NOT EXISTS especialidade_outra text,
  ADD COLUMN IF NOT EXISTS perfil_completo_em timestamptz;