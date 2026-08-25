create table if not exists public.fundadores_config (
  id boolean primary key default true,
  vagas_totais integer not null default 100,
  constraint fundadores_config_singleton check (id)
);

GRANT SELECT ON public.fundadores_config TO anon;
GRANT SELECT ON public.fundadores_config TO authenticated;
GRANT ALL ON public.fundadores_config TO service_role;

alter table public.fundadores_config enable row level security;

drop policy if exists "leitura publica" on public.fundadores_config;
create policy "leitura publica" on public.fundadores_config for select using (true);

insert into public.fundadores_config (id) values (true) on conflict do nothing;

alter table public.subscriptions add column if not exists plan_origem text;

create index if not exists idx_subscriptions_plan_origem on public.subscriptions (plan_origem) where plan_origem is not null;