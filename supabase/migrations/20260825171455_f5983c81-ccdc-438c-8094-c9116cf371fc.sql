create or replace function public.fundador_vagas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totais', coalesce((select vagas_totais from public.fundadores_config limit 1), 100),
    'ocupadas', (
      select count(*) from public.subscriptions
      where plan_origem = 'mindmed_fundador'
        and status in ('ACTIVE','TRIALING')
    )
  );
$$;

revoke all on function public.fundador_vagas() from public;
grant execute on function public.fundador_vagas() to anon, authenticated, service_role;