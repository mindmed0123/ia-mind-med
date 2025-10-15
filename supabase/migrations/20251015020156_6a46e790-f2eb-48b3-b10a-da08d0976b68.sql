-- Adicionar constraint única em subscriptions.user_id
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_unique ON public.subscriptions(user_id);

-- Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Criar tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Políticas RLS para user_roles
CREATE POLICY "Usuários podem ver seus próprios roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem inserir roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem atualizar roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Apenas admins podem deletar roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Buscar o user_id do email pedrolsuassuna@gmail.com e configurar
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar o user_id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'pedrolsuassuna@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Inserir role admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Atualizar ou criar subscription PRO
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      status,
      payment_provider,
      current_period_start,
      current_period_end,
      remaining_starter_credits,
      quota_used
    )
    VALUES (
      v_user_id,
      'PRO',
      'ACTIVE',
      'manual',
      NOW(),
      NOW() + INTERVAL '365 days',
      0,
      0
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      plan = 'PRO',
      status = 'ACTIVE',
      remaining_starter_credits = 0,
      quota_used = 0,
      current_period_end = NOW() + INTERVAL '365 days',
      updated_at = NOW();
  END IF;
END $$;

-- Políticas RLS adicionais para admins verem tudo
CREATE POLICY "Admins podem ver todos os laudos"
ON public.laudos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem ver todos os receituários"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem ver todos os perfis"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem ver todas as assinaturas"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));