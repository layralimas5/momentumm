-- Momentumm — cobrança pelo Asaas.
--
-- A 0026 criou o contrato (`subscriptions`, `subscription_events`) e deixou
-- o provedor em aberto. Este arquivo liga o Asaas nele, com três tabelas de
-- apoio que só a service role toca:
--
--   `billing_customers`      quem é a pessoa no Asaas (o `cus_...`)
--   `billing_checkouts`      cada sessão de checkout aberta, pra reconciliar
--   `billing_webhook_events` cada evento recebido, pela chave do Asaas —
--                            entrega é "pelo menos uma vez", e a chave
--                            primária é o que impede processar duas vezes
--
-- Nenhuma delas tem política de RLS: com RLS ligada e sem política, o que a
-- API pública consegue é nada, e é isso que se quer. Quem lê e grava são as
-- Edge Functions `asaas-billing` (com o JWT da pessoa pra saber quem é, e
-- service role pra escrever) e `asaas-webhook` (só service role, autenticada
-- pelo token do webhook).
--
-- O que NUNCA entra aqui: número de cartão, CPF, endereço. Isso o checkout
-- do Asaas coleta e guarda lá.

create table if not exists public.billing_customers (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  provider             text not null default 'asaas' check (provider ~ '^[a-z_]{2,30}$'),
  provider_customer_id text not null,
  created_at           timestamptz not null default now(),
  constraint billing_customers_provider_unique unique (provider, provider_customer_id)
);

do $$ begin
  create type public.billing_checkout_status as enum ('aberto', 'pago', 'cancelado', 'expirado');
exception when duplicate_object then null; end $$;

create table if not exists public.billing_checkouts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  provider             text not null default 'asaas' check (provider ~ '^[a-z_]{2,30}$'),
  provider_checkout_id text not null,
  interval             public.subscription_interval not null,
  amount_cents         integer not null check (amount_cents > 0),
  status               public.billing_checkout_status not null default 'aberto',
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  constraint billing_checkouts_provider_unique unique (provider, provider_checkout_id)
);

create index if not exists billing_checkouts_user_idx on public.billing_checkouts (user_id, created_at desc);

create table if not exists public.billing_webhook_events (
  provider     text not null check (provider ~ '^[a-z_]{2,30}$'),
  event_id     text not null,
  event        text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  outcome      text,
  payload      jsonb not null,
  primary key (provider, event_id),
  constraint billing_webhook_events_payload_size check (pg_column_size(payload) <= 16384)
);

comment on table public.billing_webhook_events is
  'Cada evento recebido do provedor, pela chave dele. Idempotência e reprocessamento. Payload sem dado de cartão por construção: o provedor não manda.';

create index if not exists billing_webhook_events_received_idx on public.billing_webhook_events (received_at desc);

alter table public.billing_customers enable row level security;
alter table public.billing_checkouts enable row level security;
alter table public.billing_webhook_events enable row level security;

-- Sem política de propósito. Ver o cabeçalho.

-- ---------------------------------------------------------------------------
-- o webhook precisa achar a pessoa pelo e-mail quando nenhum outro vínculo
-- existe (checkout pago antes de o evento de checkout chegar, por exemplo).
-- Só service_role chama; `auth.users` não é exposta pela API.
-- ---------------------------------------------------------------------------

create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke all on function public.user_id_by_email(text) from public;
revoke all on function public.user_id_by_email(text) from anon;
revoke all on function public.user_id_by_email(text) from authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- o pedido de cancelamento passa a ser concluído pela função de cobrança,
-- que cancela no Asaas e marca aqui. `processado` já existia no enum.
-- ---------------------------------------------------------------------------

create or replace function public.mark_cancellation_processed(p_user_id uuid, p_access_until timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.cancellation_requests
       set status = 'processado', access_until = coalesce(p_access_until, access_until)
     where user_id = p_user_id and status = 'solicitado'
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.mark_cancellation_processed(uuid, timestamptz) from public;
revoke all on function public.mark_cancellation_processed(uuid, timestamptz) from anon;
revoke all on function public.mark_cancellation_processed(uuid, timestamptz) from authenticated;
grant execute on function public.mark_cancellation_processed(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- eventos de uso da cobrança. A lista fechada mora aqui E em
-- `domain/analytics/product-events.ts`; o teste compara a última definição.
-- ---------------------------------------------------------------------------

create or replace function public.product_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'session_start', 'feature_view', 'onboarding_completed',
    'objective_created', 'task_created', 'task_completed', 'habit_logged',
    'review_completed', 'momentum_viewed', 'ai_call', 'recovery_started',
    'share_exported', 'record_created', 'cancellation_requested', 'support_opened',
    'plan_limit_hit', 'checkout_started', 'subscription_canceled'
  ];
$$;

create or replace function public.product_feature_names()
returns text[]
language sql
immutable
as $$
  select array[
    'hoje', 'objetivos', 'habitos', 'plano', 'progresso', 'review',
    'momentum_score', 'ai', 'retomada', 'compartilhamento',
    'registro_texto', 'registro_foto', 'registro_voz',
    'circulo', 'desafios', 'foco', 'insights', 'perfil', 'configuracoes',
    'assinatura'
  ];
$$;
