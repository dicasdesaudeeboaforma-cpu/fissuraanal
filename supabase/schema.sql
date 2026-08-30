-- =====================================================
--  Fissura Anal — Guia de Cuidado
--  Esquema Supabase: controle de acesso pago por 6 meses
-- =====================================================
--  Rode este arquivo no SQL Editor do Supabase
--  (Dashboard > SQL Editor > New query > Run).
-- =====================================================

-- ---------- Tabela de acessos ----------
create table if not exists public.acessos (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  email              text        not null,
  nome               text,
  hotmart_transacao  text        unique,
  status             text        not null default 'ativo'
                     check (status in ('ativo', 'reembolsado', 'chargeback', 'cancelado')),
  liberado_em        timestamptz not null default now(),
  expira_em          timestamptz not null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

comment on table public.acessos is 'Licença de acesso ao guia. Criada/renovada pelo webhook da Hotmart.';

-- ---------- Índices ----------
create index if not exists acessos_email_idx on public.acessos (lower(email));
create index if not exists acessos_expira_idx on public.acessos (expira_em);

-- ---------- RLS: cada pessoa só enxerga a própria linha ----------
alter table public.acessos enable row level security;

drop policy if exists "acesso proprio - select" on public.acessos;
create policy "acesso proprio - select"
  on public.acessos
  for select
  using (auth.uid() = user_id);

-- Nenhuma policy de insert/update/delete para usuários finais:
-- só a Edge Function (service_role) escreve nesta tabela.

-- ---------- Função utilitária: o meu acesso está válido? ----------
create or replace function public.meu_acesso_valido()
returns table (valido boolean, status text, expira_em timestamptz, dias_restantes integer)
language sql
security definer
set search_path = public
as $$
  select
    (a.status = 'ativo' and a.expira_em > now())                         as valido,
    a.status,
    a.expira_em,
    greatest(0, ceil(extract(epoch from (a.expira_em - now())) / 86400))::int as dias_restantes
  from public.acessos a
  where a.user_id = auth.uid();
$$;

grant execute on function public.meu_acesso_valido() to authenticated;

-- ---------- Trigger para manter atualizado_em ----------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists touch_acessos on public.acessos;
create trigger touch_acessos
  before update on public.acessos
  for each row execute function public.tg_touch_atualizado_em();
