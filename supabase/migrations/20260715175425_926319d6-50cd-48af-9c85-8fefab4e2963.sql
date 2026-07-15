
CREATE TABLE public.farmaceuticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email_farmacovigilancia text NOT NULL,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.farmaceuticas TO authenticated;
GRANT ALL ON public.farmaceuticas TO service_role;

ALTER TABLE public.farmaceuticas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active farmaceuticas"
  ON public.farmaceuticas FOR SELECT
  TO authenticated
  USING (ativo = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert farmaceuticas"
  ON public.farmaceuticas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update farmaceuticas"
  ON public.farmaceuticas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete farmaceuticas"
  ON public.farmaceuticas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_farmaceuticas_updated_at
  BEFORE UPDATE ON public.farmaceuticas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.farmaceuticas (nome, email_farmacovigilancia, telefone) VALUES
  ('Eurofarma', 'farmacovigilancia@eurofarma.com.br', '0800 704 3876'),
  ('EMS', 'farmacovigilancia@ems.com.br', '0800 191914'),
  ('Aché', 'farmacovigilancia@ache.com.br', '0800 701 6900'),
  ('Hypera Pharma', 'farmacovigilancia@hypera.com.br', '0800 011 3355'),
  ('Medley', 'farmacovigilancia@medley.com.br', '0800 703 3033'),
  ('Neo Química', 'farmacovigilancia@neoquimica.com.br', '0800 940 0404'),
  ('Cimed', 'farmacovigilancia@cimed.ind.br', '0800 728 0011'),
  ('Sandoz', 'farmacovigilancia.br@sandoz.com', '0800 703 8000'),
  ('Cristália', 'farmacovigilancia@cristalia.com.br', '0800 701 7127'),
  ('União Química', 'farmacovigilancia@uniaoquimica.com.br', '0800 11 1559');
