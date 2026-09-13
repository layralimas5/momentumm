-- Momentumm — assinaturas, eventos de cobrança e cancelamento.
--
-- Não existe provedor de pagamento integrado ainda. Estas tabelas são o
-- CONTRATO que o webhook vai preencher com `service_role`: o painel lê daqui
-- e mostra vazio, honestamente, enquanto o provedor não chega. Nada de
-- número inventado.
--
-- O que NUNCA entra aqui: número de cartão, bandeira completa, CVV, token de
-- pagamento. Isso fica no provedor. `provider_subscription_id` é o suficiente
-- pra abrir a assinatura lá.
--
-- `profiles.plan` passa a ser DERIVADO da assinatura por trigger: o webhook
-- escreve a assinatura, e o plano segue. Continua valendo a regra da 0013 —
-- entitlement não mora em coluna que o dono edita — e o trigger de guarda
-- reconhece a sincronização pelo flag de sessão que só ele liga.

do $$ begin
  create type public.subscription_interval as enum ('mensal', 'anual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trial', 'ativa', 'cancelada', 'vencida', 'inadimplente');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  provider                 text not null check (provider ~ '^[a-z_]{2,30}$'),
  provider_subscription_id text not null,
  plan                     public.plan_tier not null default 'pro',
  interval                 public.subscription_interval not null,
  status                   public.subscription_status not null,
  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  trial_ends_at            timestamptz,
  started_at               timestamptz not null default now(),
  current_period_end       timestamptz,
  canceled_at              timestamptz,
  ended_at                 timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint subscriptions_provider_unique unique (provider, provider_subscription_id)
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_idx on public.subscriptions (status, current_period_end);

do $$ begin
  create type public.subscription_event_type as enum (
    'criada', 'trial_iniciado', 'trial_convertido', 'renovada', 'upgrade', 'downgrade',
    'pagamento_falhou', 'reembolso', 'cancelada', 'vencida', 'reativada'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.subscription_events (
  id              bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            public.subscription_event_type not null,
  amount_cents    integer check (amount_cents is null or amount_cents >= 0),
  from_interval   public.subscription_interval,
  to_interval     public.subscription_interval,
  metadata        jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  constraint subscription_events_metadata_size check (pg_column_size(metadata) <= 512)
);

comment on column public.subscription_events.metadata is
  'Código de erro do provedor, id do reembolso. Nunca dado de cartão.';

create index if not exists subscription_events_occurred_idx on public.subscription_events (occurred_at desc);
create index if not exists subscription_events_type_idx on public.subscription_events (type, occurred_at desc);

alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

/* A pessoa vê a própria assinatura. Escrita: só service_role (webhook), que passa por cima da RLS. */
drop policy if exists "dono lê a própria assinatura" on public.subscriptions;
create policy "dono lê a própria assinatura"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono lê os eventos da própria assinatura" on public.subscription_events;
create policy "dono lê os eventos da própria assinatura"
  on public.subscription_events for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- o plano segue a assinatura
-- ---------------------------------------------------------------------------

/*
  Uma assinatura `trial` ou `ativa` faz a conta ser PRO. Cancelada mantém o
  PRO até o fim do período pago (`current_period_end`); vencida e
  inadimplente derrubam pro gratuito. O trigger de guarda (0013) só deixa o
  plano mudar com service_role ou admin; a sincronização liga um flag de
  transação pra se identificar, e o flag só nasce aqui dentro.
*/
create or replace function public.plan_for_subscription_state(
  p_status public.subscription_status,
  p_period_end timestamptz
)
returns public.plan_tier
language sql
stable
as $$
  select case
    when p_status in ('trial', 'ativa') then 'pro'::public.plan_tier
    when p_status = 'cancelada' and p_period_end is not null and p_period_end > now() then 'pro'
    else 'free'
  end;
$$;

create or replace function public.sync_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_plan public.plan_tier;
begin
  select public.plan_for_subscription_state(s.status, s.current_period_end)
    into next_plan
    from public.subscriptions s
   where s.user_id = new.user_id
   order by (s.status in ('trial', 'ativa')) desc, s.current_period_end desc nulls last
   limit 1;

  perform set_config('momentumm.plan_sync', '1', true);
  update public.profiles set plan = coalesce(next_plan, 'free') where id = new.user_id;
  perform set_config('momentumm.plan_sync', '', true);

  return new;
end;
$$;

drop trigger if exists subscriptions_sync_plan on public.subscriptions;
create trigger subscriptions_sync_plan
  after insert or update of status, current_period_end on public.subscriptions
  for each row execute function public.sync_plan_from_subscription();

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
       and coalesce(current_setting('momentumm.plan_sync', true), '') <> '1'
       and not public.is_admin() then
      raise exception 'o plano da conta não é editável por aqui' using errcode = '42501';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'o dono do perfil não pode ser alterado' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancelamento pedido pela pessoa
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.cancel_reason as enum (
    'preco', 'nao_uso', 'faltam_recursos', 'problemas_tecnicos', 'outro_app', 'temporario', 'outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cancellation_status as enum ('solicitado', 'processado', 'retido');
exception when duplicate_object then null; end $$;

create table if not exists public.cancellation_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  plan                public.plan_tier not null,
  interval            public.subscription_interval,
  reason              public.cancel_reason not null,
  comment             text check (comment is null or char_length(comment) <= 500),
  comment_expires_at  timestamptz not null default now() + interval '90 days',
  tenure_days         integer not null default 0,
  -- Recursos usados nos 30 dias anteriores: só os nomes, do evento de uso.
  features_used       text[] not null default '{}',
  status              public.cancellation_status not null default 'solicitado',
  retention_attempted boolean not null default false,
  access_until        timestamptz,
  created_at          timestamptz not null default now()
);

comment on column public.cancellation_requests.comment is
  'Comentário livre da pessoa. Só owner e admin leem; apagado após 90 dias.';

create index if not exists cancellation_requests_created_idx on public.cancellation_requests (created_at desc);

alter table public.cancellation_requests enable row level security;

drop policy if exists "dono lê o próprio pedido de cancelamento" on public.cancellation_requests;
create policy "dono lê o próprio pedido de cancelamento"
  on public.cancellation_requests for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.request_cancellation(p_reason public.cancel_reason, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan public.plan_tier;
  sub public.subscriptions%rowtype;
  created_id uuid;
  tenure integer;
begin
  if auth.uid() is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  select p.plan into current_plan from public.profiles p where p.id = auth.uid();
  if current_plan is distinct from 'pro' then
    raise exception 'não há assinatura PRO pra cancelar' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.cancellation_requests c
     where c.user_id = auth.uid() and c.status = 'solicitado'
  ) then
    raise exception 'já existe um pedido de cancelamento em andamento' using errcode = '22023';
  end if;

  select * into sub from public.subscriptions s
   where s.user_id = auth.uid() and s.status in ('trial', 'ativa')
   order by s.created_at desc limit 1;

  tenure := coalesce(
    (extract(epoch from now() - sub.started_at) / 86400)::integer,
    (select (extract(epoch from now() - u.created_at) / 86400)::integer from auth.users u where u.id = auth.uid()),
    0
  );

  insert into public.cancellation_requests (
    user_id, subscription_id, plan, interval, reason, comment, tenure_days, features_used, access_until
  ) values (
    auth.uid(), sub.id, current_plan, sub.interval, p_reason,
    nullif(btrim(coalesce(p_comment, '')), ''), tenure,
    coalesce((
      select array_agg(distinct e.feature) from public.product_events e
       where e.user_id = auth.uid() and e.feature is not null
         and e.created_at > now() - interval '30 days'
    ), '{}'),
    sub.current_period_end
  )
  returning id into created_id;

  perform public.track_event('cancellation_requested', null, jsonb_build_object('kind', p_reason::text));

  return jsonb_build_object('id', created_id, 'access_until', sub.current_period_end);
end;
$$;

revoke all on function public.request_cancellation(public.cancel_reason, text) from public;
revoke all on function public.request_cancellation(public.cancel_reason, text) from anon;
grant execute on function public.request_cancellation(public.cancel_reason, text) to authenticated;

/* Retenção limitada: o comentário livre some depois do prazo. */
create or replace function public.purge_expired_cancellation_comments()
returns integer
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.cancellation_requests
       set comment = null
     where comment is not null and comment_expires_at <= now()
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.purge_expired_cancellation_comments() from public;
revoke all on function public.purge_expired_cancellation_comments() from anon;
revoke all on function public.purge_expired_cancellation_comments() from authenticated;
grant execute on function public.purge_expired_cancellation_comments() to service_role;
