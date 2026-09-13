-- Momentumm — eventos de produto e central de erros.
--
-- Duas tabelas que o painel lê e que o app só ESCREVE, por função:
--
--   product_events   o que aconteceu (evento + recurso + metadados fechados),
--                    nunca o que a pessoa escreveu
--   app_errors       erro agrupado por assinatura, com a pessoa afetada
--                    reduzida a um hash
--
-- Nenhuma das duas tem política de leitura pra usuário. O painel lê por
-- funções agregadas (0028). A ausência de política é a proteção.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- eventos de produto
-- ---------------------------------------------------------------------------

create table if not exists public.product_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null check (name ~ '^[a-z_]{3,40}$'),
  feature    text check (feature is null or feature ~ '^[a-z_]{3,40}$'),
  plan       public.plan_tier not null default 'free',
  metadata   jsonb not null default '{}'::jsonb,
  day        date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  constraint product_events_metadata_size check (pg_column_size(metadata) <= 512)
);

comment on table public.product_events is
  'Eventos de uso. Metadados fechados por chave. Proibido texto escrito pela pessoa.';

create index if not exists product_events_user_created_idx on public.product_events (user_id, created_at desc);
create index if not exists product_events_name_created_idx on public.product_events (name, created_at desc);
create index if not exists product_events_feature_day_idx on public.product_events (feature, day) where feature is not null;
create index if not exists product_events_day_idx on public.product_events (day);

alter table public.product_events enable row level security;

/*
  O que pode ser registrado, e com quais chaves.

  A lista é a documentação: um evento fora dela é recusado no banco, não só
  no TypeScript. Metadados aceitam só chaves conhecidas e valores curtos —
  é o que impede "metadata.note = <o texto da ação>" de entrar por um
  atalho de seis meses depois.
*/
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
    'plan_limit_hit'
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
    'circulo', 'desafios', 'foco', 'insights', 'perfil', 'configuracoes'
  ];
$$;

create or replace function public.product_event_metadata_keys()
returns text[]
language sql
immutable
as $$
  select array['kind', 'mode', 'template', 'source', 'count', 'duration_ms', 'result', 'limit'];
$$;

create or replace function public.track_event(
  p_name text,
  p_feature text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean jsonb := '{}'::jsonb;
  entry record;
  current_plan public.plan_tier;
begin
  if auth.uid() is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  if not (p_name = any (public.product_event_names())) then
    raise exception 'evento desconhecido' using errcode = '22023';
  end if;
  if p_feature is not null and not (p_feature = any (public.product_feature_names())) then
    raise exception 'recurso desconhecido' using errcode = '22023';
  end if;

  -- Só chaves conhecidas, só escalares curtos.
  for entry in select key, value from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) loop
    if entry.key = any (public.product_event_metadata_keys())
       and jsonb_typeof(entry.value) in ('string', 'number', 'boolean')
       and char_length(entry.value::text) <= 40 then
      clean := clean || jsonb_build_object(entry.key, entry.value);
    end if;
  end loop;

  -- Ritmo: 120 eventos por hora por conta. Acima disso é script, não uso.
  if (select count(*) from public.product_events e
       where e.user_id = auth.uid() and e.created_at > now() - interval '1 hour') >= 120 then
    return;
  end if;

  select p.plan into current_plan from public.profiles p where p.id = auth.uid();

  insert into public.product_events (user_id, name, feature, plan, metadata)
  values (auth.uid(), p_name, p_feature, coalesce(current_plan, 'free'), clean);
end;
$$;

revoke all on function public.track_event(text, text, jsonb) from public;
revoke all on function public.track_event(text, text, jsonb) from anon;
grant execute on function public.track_event(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- central de erros
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.error_severity as enum ('baixa', 'media', 'alta', 'critica');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.error_status as enum ('novo', 'analisando', 'resolvido', 'ignorado');
exception when duplicate_object then null;
end $$;

create table if not exists public.app_errors (
  id             uuid primary key default gen_random_uuid(),
  fingerprint    text not null unique,
  code           text not null check (code ~ '^[a-z0-9_.-]{2,60}$'),
  module         text not null check (module ~ '^[a-z_]{2,40}$'),
  environment    text not null check (environment in ('producao', 'preview', 'desenvolvimento')),
  app_version    text not null check (char_length(app_version) between 1 and 40),
  severity       public.error_severity not null default 'media',
  status         public.error_status not null default 'novo',
  message        text not null check (char_length(message) <= 200),
  occurrences    integer not null default 0,
  affected_users integer not null default 0,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users (id) on delete set null
);

comment on column public.app_errors.message is
  'Mensagem técnica já sanitizada: sem e-mail, token, chave, prompt ou texto pessoal.';

create index if not exists app_errors_status_last_seen_idx on public.app_errors (status, last_seen_at desc);
create index if not exists app_errors_module_idx on public.app_errors (module, last_seen_at desc);

create table if not exists public.app_error_occurrences (
  id         bigint generated always as identity primary key,
  error_id   uuid not null references public.app_errors (id) on delete cascade,
  user_hash  text,
  created_at timestamptz not null default now()
);

create index if not exists app_error_occurrences_error_idx on public.app_error_occurrences (error_id, created_at desc);
create index if not exists app_error_occurrences_created_idx on public.app_error_occurrences (created_at desc);

alter table public.app_errors enable row level security;
alter table public.app_error_occurrences enable row level security;

/*
  Sanitização no banco, além da do cliente.

  Remove e-mail, `Bearer …`, JWT, chave de API e qualquer sequência longa
  que pareça segredo. O cliente já faz isso antes de enviar; aqui é a
  garantia de que uma versão velha do app não grava o que não deve.
*/
create or replace function public.sanitize_error_message(p_message text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(p_message, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
          'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [token]', 'g'),
        'eyJ[A-Za-z0-9._-]{20,}', '[jwt]', 'g'),
      '(sk-ant-|sb_secret_|sbp_)[A-Za-z0-9_-]+', '[chave]', 'g'),
    200
  );
$$;

/* Hash estável e sem volta: agrupa "usuários afetados" sem guardar quem. */
create or replace function public.error_user_hash(p_user uuid)
returns text
language sql
immutable
as $$
  select case
    when p_user is null then null
    else encode(extensions.digest(p_user::text || ':momentumm-errors-v1', 'sha256'), 'hex')
  end;
$$;

create or replace function public.report_error(
  p_code text,
  p_module text,
  p_message text,
  p_environment text,
  p_app_version text,
  p_severity public.error_severity default 'media'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_message text := public.sanitize_error_message(p_message);
  key text;
  found_id uuid;
  hash text := public.error_user_hash(auth.uid());
  is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if auth.uid() is null and not is_service then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  -- Ritmo por conta: 60 relatos por hora.
  if auth.uid() is not null and (
    select count(*) from public.app_error_occurrences o
     where o.user_hash = hash and o.created_at > now() - interval '1 hour'
  ) >= 60 then
    return;
  end if;

  key := encode(extensions.digest(
    p_environment || '|' || p_module || '|' || p_code || '|' || left(clean_message, 80), 'sha256'
  ), 'hex');

  insert into public.app_errors (fingerprint, code, module, environment, app_version, severity, message)
  values (key, p_code, p_module, p_environment, p_app_version, p_severity, clean_message)
  on conflict (fingerprint) do update
    set occurrences = public.app_errors.occurrences,
        last_seen_at = now(),
        app_version = excluded.app_version,
        -- Erro resolvido que volta a acontecer reabre.
        status = case when public.app_errors.status = 'resolvido' then 'novo' else public.app_errors.status end,
        severity = greatest(public.app_errors.severity, excluded.severity)
  returning id into found_id;

  insert into public.app_error_occurrences (error_id, user_hash) values (found_id, hash);

  update public.app_errors e
     set occurrences = (select count(*) from public.app_error_occurrences o where o.error_id = e.id),
         affected_users = (select count(distinct o.user_hash) from public.app_error_occurrences o
                            where o.error_id = e.id and o.user_hash is not null)
   where e.id = found_id;
end;
$$;

revoke all on function public.report_error(text, text, text, text, text, public.error_severity) from public;
revoke all on function public.report_error(text, text, text, text, text, public.error_severity) from anon;
grant execute on function public.report_error(text, text, text, text, text, public.error_severity) to authenticated;
grant execute on function public.report_error(text, text, text, text, text, public.error_severity) to service_role;

-- ---------------------------------------------------------------------------
-- ai_calls: o que faltava pra medir a IA sem ler conteúdo
-- ---------------------------------------------------------------------------

alter table public.ai_calls
  add column if not exists status text not null default 'ok'
    check (status in ('ok', 'erro', 'limite', 'bloqueado')),
  add column if not exists error_code text check (error_code is null or char_length(error_code) <= 40),
  add column if not exists duration_ms integer check (duration_ms is null or duration_ms >= 0);

create index if not exists ai_calls_created_idx on public.ai_calls (created_at desc);
create index if not exists ai_calls_kind_idx on public.ai_calls (kind, created_at desc);

/* A franquia conta só o que o modelo respondeu. Tentativa barrada não gasta. */
create or replace function public.ai_calls_this_month(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.ai_calls
   where user_id = p_user
     and status = 'ok'
     and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.ai_calls_this_month(uuid) from public;
revoke all on function public.ai_calls_this_month(uuid) from anon;
revoke all on function public.ai_calls_this_month(uuid) from authenticated;
grant execute on function public.ai_calls_this_month(uuid) to service_role;

/*
  O mesmo pra hoje, pra função da IA. `ai_calls_today` (0016) exige que
  `p_user = auth.uid()`, e com service role `auth.uid()` é nulo: a contagem
  saía zero e o teto diário nunca disparava.
*/
create or replace function public.ai_calls_today_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.ai_calls
   where user_id = p_user
     and status = 'ok'
     and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.ai_calls_today_for(uuid) from public;
revoke all on function public.ai_calls_today_for(uuid) from anon;
revoke all on function public.ai_calls_today_for(uuid) from authenticated;
grant execute on function public.ai_calls_today_for(uuid) to service_role;

/* Bloqueio temporário por abuso. Só o painel grava; só a função da IA lê. */
create table if not exists public.ai_blocks (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  until      timestamptz not null,
  reason     text not null check (char_length(reason) between 5 and 280),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ai_blocks enable row level security;

create or replace function public.ai_block_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ai_blocks b where b.user_id = p_user and b.until > now());
$$;

revoke all on function public.ai_block_active(uuid) from public;
revoke all on function public.ai_block_active(uuid) from anon;
revoke all on function public.ai_block_active(uuid) from authenticated;
grant execute on function public.ai_block_active(uuid) to service_role;
