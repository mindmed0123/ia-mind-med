CREATE UNIQUE INDEX IF NOT EXISTS laudos_um_demo_por_conta ON public.laudos (user_id) WHERE is_demo;
REVOKE EXECUTE ON FUNCTION public.criar_laudo_demonstracao(text) FROM authenticated;
COMMENT ON FUNCTION public.criar_laudo_demonstracao(text) IS 'DEPRECATED: replaced by edge function criar-laudo-demo';