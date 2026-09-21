-- Momentumm — lembrete no celular pra quem não abriu o app no dia.
--
-- Duas tabelas e uma função de leitura pro servidor:
--
--   `user_presence`       quando a pessoa abriu o app pela última vez e em
--                         que fuso. Uma linha por conta, escrita só por
--                         `touch_my_presence()`, que o app chama ao abrir e
--                         ao voltar pra aba. "Não acessou hoje" é decidido
--                         no fuso da pessoa, não no do servidor.
--   `push_subscriptions`  os aparelhos que aceitaram receber aviso (Web
--                         Push: endpoint + chaves). Uma pessoa pode ter mais
--                         de um; o dono cria e apaga os seus pela RLS.
--
--   `push_reminders_due(p_hour)`  o que a Edge Function `push-reminders`
--                         lê a cada hora: as assinaturas de quem está na
--                         hora certa do próprio fuso, não abriu o app hoje
--                         e ainda não recebeu lembrete hoje. Só service_role.
--
-- O envio em si (VAPID, criptografia da mensagem) fica na função de borda.
-- O agendador é o `pg_cron` chamando a função de borda por `pg_net`, com o
-- token guardado no Vault (ver o bloco no fim e o README das funções).

-- ---------------------------------------------------------------------------
-- presença: a última abertura, no fuso da pessoa
-- ---------------------------------------------------------------------------

create table if not exists public.user_presence (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  last_active_at timestamptz not null default now(),
  timezone       text not null default 'America/Sao_Paulo',
  updated_at     timestamptz not null default now(),
  constraint user_presence_timezone_format check (timezone ~ '^[A-Za-z_]+(/[A-Za-z_+-]+){0,2}$')
);

comment on table public.user_presence is
  'Última abertura do app por conta, com o fuso do aparelho. Só touch_my_presence() escreve.';

alter table public.user_presence enable row level security;

drop policy if exists "dono lê a própria presença" on public.user_presence;
create policy "dono lê a própria presença"
  on public.user_presence for select
  to authenticated
  using (auth.uid() = user_id);

-- Sem política de escrita: o app passa pela função abaixo.

create or replace function public.touch_my_presence(p_timezone text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
  tz text := coalesce(nullif(trim(p_timezone), ''), 'America/Sao_Paulo');
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  -- Fuso desconhecido não pode derrubar a abertura do app: cai no padrão.
  begin
    perform now() at time zone tz;
  exception when others then
    tz := 'America/Sao_Paulo';
  end;

  insert into public.user_presence (user_id, last_active_at, timezone, updated_at)
  values (quem, now(), tz, now())
  on conflict (user_id) do update
    set last_active_at = excluded.last_active_at,
        timezone = excluded.timezone,
        updated_at = now();
end;
$$;

revoke all on function public.touch_my_presence(text) from public;
revoke all on function public.touch_my_presence(text) from anon;
grant execute on function public.touch_my_presence(text) to authenticated;

-- ---------------------------------------------------------------------------
-- assinaturas de push: os aparelhos que aceitaram o aviso
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_reminded_on date,
  failed_at        timestamptz,
  constraint push_subscriptions_endpoint_https check (endpoint ~ '^https://'),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) <= 2048),
  constraint push_subscriptions_keys_length check (char_length(p256dh) <= 256 and char_length(auth) <= 128),
  constraint push_subscriptions_agent_length check (user_agent is null or char_length(user_agent) <= 300)
);

comment on table public.push_subscriptions is
  'Aparelhos inscritos no Web Push. O dono cria e apaga; o servidor marca envio e falha.';

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "dono lê as próprias assinaturas de push" on public.push_subscriptions;
create policy "dono lê as próprias assinaturas de push"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono cria assinatura de push" on public.push_subscriptions;
create policy "dono cria assinatura de push"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "dono atualiza assinatura de push" on public.push_subscriptions;
create policy "dono atualiza assinatura de push"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dono apaga assinatura de push" on public.push_subscriptions;
create policy "dono apaga assinatura de push"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- o que está na hora de avisar
-- ---------------------------------------------------------------------------

-- Uma linha por aparelho a avisar. A hora é comparada no fuso da pessoa,
-- então a função pode rodar a cada hora em UTC e cada fuso recebe às 19h
-- locais (ou na hora que a chamada pedir). Quem abriu o app hoje (no fuso
-- dela) fica de fora, e quem já recebeu hoje também.
create or replace function public.push_reminders_due(p_hour integer default 19)
returns table (
  subscription_id uuid,
  user_id         uuid,
  endpoint        text,
  p256dh          text,
  auth            text,
  first_name      text,
  days_away       integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.user_id,
    s.endpoint,
    s.p256dh,
    s.auth,
    split_part(p.name, ' ', 1),
    greatest(
      0,
      (
        (now() at time zone pr.timezone)::date
        - (pr.last_active_at at time zone pr.timezone)::date
      )
    )::integer
  from public.push_subscriptions s
  join public.user_presence pr on pr.user_id = s.user_id
  join public.profiles p on p.id = s.user_id
  where s.failed_at is null
    and extract(hour from (now() at time zone pr.timezone)) = p_hour
    and (pr.last_active_at at time zone pr.timezone)::date < (now() at time zone pr.timezone)::date
    and (
      s.last_reminded_on is null
      or s.last_reminded_on < (now() at time zone pr.timezone)::date
    );
$$;

revoke all on function public.push_reminders_due(integer) from public;
revoke all on function public.push_reminders_due(integer) from anon;
revoke all on function public.push_reminders_due(integer) from authenticated;
grant execute on function public.push_reminders_due(integer) to service_role;

-- "Lembrado hoje" é no fuso da pessoa. Gravar a data do servidor faria
-- quem está a oeste de UTC (19h local já é o dia seguinte em UTC) pular um
-- dia de lembrete.
create or replace function public.mark_push_reminded(p_subscription_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions s
  set last_reminded_on = (now() at time zone pr.timezone)::date,
      failed_at = null
  from public.user_presence pr
  where s.id = p_subscription_id
    and pr.user_id = s.user_id;
$$;

revoke all on function public.mark_push_reminded(uuid) from public;
revoke all on function public.mark_push_reminded(uuid) from anon;
revoke all on function public.mark_push_reminded(uuid) from authenticated;
grant execute on function public.mark_push_reminded(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- eventos de uso: ligar e desligar o lembrete
-- ---------------------------------------------------------------------------

-- A mesma lista de `PRODUCT_EVENTS` no app (domain/analytics/product-events).
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
    'plan_limit_hit', 'checkout_started', 'subscription_canceled',
    'trial_started', 'trial_ended', 'reminder_enabled', 'reminder_disabled'
  ];
$$;

-- ---------------------------------------------------------------------------
-- agendador: toda hora, no minuto 5, chama a função de borda
-- ---------------------------------------------------------------------------
--
-- Pré-requisitos, uma vez, no SQL editor do projeto:
--
--   select vault.create_secret('<mesmo valor de PUSH_REMINDER_TOKEN>', 'push_reminder_token');
--
-- O token é o mesmo que a função de borda recebe por
-- `supabase secrets set PUSH_REMINDER_TOKEN=...`. Sem o segredo no Vault o
-- job existe mas não chama nada, e o aviso abaixo diz o motivo.

create or replace function public.call_push_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
  base_url text := 'https://hsgjlxetdopomeibdbho.supabase.co';
begin
  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'push_reminder_token'
  limit 1;

  if token is null then
    raise notice 'push_reminder_token ausente no Vault: lembrete não enviado.';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-token', token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.call_push_reminders() from public;
revoke all on function public.call_push_reminders() from anon;
revoke all on function public.call_push_reminders() from authenticated;

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'momentumm-push-reminders';
  perform cron.schedule('momentumm-push-reminders', '5 * * * *', 'select public.call_push_reminders()');
exception when others then
  raise notice 'pg_cron/pg_net indisponível (%): agendar a função push-reminders pelo painel do Supabase.', sqlerrm;
end $$;
