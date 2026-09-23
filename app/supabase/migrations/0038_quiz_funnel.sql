-- Momentumm — funil de aquisição pelo quiz (`/criar-meu-plano`).
--
-- O quiz é respondido ANTES de existir conta, então nada aqui passa por
-- `product_events` (que exige `auth.uid()`). A unidade é a SESSÃO ANÔNIMA:
-- um uuid gerado no navegador, que funciona como portador. Quem tem o id
-- escreve na sessão enquanto ela não tem dono; depois do cadastro a sessão
-- é vinculada ao usuário e só ele (ou o service role) toca nela.
--
-- Nenhuma das duas tabelas tem política. Toda escrita passa por função
-- `security definer` com validação de forma, teto de eventos por sessão e
-- teto de tamanho. A leitura é só do painel, agregada (`admin_quiz_funnel`).
--
-- Nada de texto livre além do objetivo escrito pela pessoa (`answers.goal`),
-- que é o próprio conteúdo do plano dela e fica junto da sessão até virar
-- objetivo de verdade. Sessão abandonada é apagada em 90 dias.

-- ---------------------------------------------------------------------------
-- sessões
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.quiz_status as enum ('iniciado', 'concluido', 'abandonado', 'vinculado', 'ativado');
exception when duplicate_object then null; end $$;

create table if not exists public.quiz_sessions (
  id            uuid primary key,
  user_id       uuid references auth.users (id) on delete set null,
  status        public.quiz_status not null default 'iniciado',
  current_step  smallint not null default 0 check (current_step between 0 and 12),
  answers       jsonb not null default '{}'::jsonb,
  diagnosis     jsonb not null default '{}'::jsonb,
  utm_source    text check (utm_source is null or utm_source ~ '^[a-z0-9_.-]{1,60}$'),
  utm_medium    text check (utm_medium is null or utm_medium ~ '^[a-z0-9_.-]{1,60}$'),
  utm_campaign  text check (utm_campaign is null or utm_campaign ~ '^[a-z0-9_.-]{1,60}$'),
  utm_content   text check (utm_content is null or utm_content ~ '^[a-z0-9_.-]{1,60}$'),
  theme         text check (theme is null or theme ~ '^[a-z_]{1,30}$'),
  entered_at    timestamptz not null default now(),
  completed_at  timestamptz,
  abandoned_at  timestamptz,
  linked_at     timestamptz,
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint quiz_sessions_answers_size check (pg_column_size(answers) <= 2048),
  constraint quiz_sessions_diagnosis_size check (pg_column_size(diagnosis) <= 2048)
);

comment on table public.quiz_sessions is
  'Sessão anônima do quiz de entrada. O id é gerado no navegador e é o portador até o cadastro.';

create index if not exists quiz_sessions_user_idx on public.quiz_sessions (user_id) where user_id is not null;
create index if not exists quiz_sessions_entered_idx on public.quiz_sessions (entered_at desc);
create index if not exists quiz_sessions_status_idx on public.quiz_sessions (status);

alter table public.quiz_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------

create table if not exists public.quiz_events (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.quiz_sessions (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (name ~ '^[a-z_]{3,40}$'),
  step        smallint check (step is null or step between 0 and 12),
  metadata    jsonb not null default '{}'::jsonb,
  day         date not null default (now() at time zone 'utc')::date,
  created_at  timestamptz not null default now(),
  constraint quiz_events_metadata_size check (pg_column_size(metadata) <= 256)
);

comment on table public.quiz_events is
  'Eventos do funil de aquisição, por sessão do quiz. Lista fechada de nomes.';

create index if not exists quiz_events_session_idx on public.quiz_events (session_id, created_at);
create index if not exists quiz_events_name_day_idx on public.quiz_events (name, day);

alter table public.quiz_events enable row level security;

create or replace function public.quiz_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'quiz_viewed', 'quiz_started', 'quiz_question_answered', 'quiz_completed',
    'quiz_abandoned', 'diagnosis_viewed', 'plan_preview_viewed',
    'signup_started', 'signup_completed', 'plan_activated',
    'first_action_completed', 'trial_started', 'checkout_started',
    'subscription_completed'
  ];
$$;

-- ---------------------------------------------------------------------------
-- quem pode tocar numa sessão
-- ---------------------------------------------------------------------------

/*
  Sem dono: quem tem o id escreve (é o navegador que a criou). Com dono: só o
  dono. O service role passa sempre. Devolve a linha travada pra a função
  chamadora atualizar sem corrida.
*/
create or replace function public.quiz_session_for_write(p_session uuid)
returns public.quiz_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.quiz_sessions%rowtype;
begin
  select * into s from public.quiz_sessions where id = p_session for update;
  if s.id is null then
    return s;
  end if;
  if s.user_id is not null
     and s.user_id is distinct from auth.uid()
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'sessão de outra pessoa' using errcode = '42501';
  end if;
  return s;
end;
$$;

revoke all on function public.quiz_session_for_write(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- registrar evento (cria a sessão na primeira vez)
-- ---------------------------------------------------------------------------

create or replace function public.quiz_track(
  p_session uuid,
  p_name text,
  p_step integer default null,
  p_attribution jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.quiz_sessions%rowtype;
  attr jsonb := coalesce(p_attribution, '{}'::jsonb);
begin
  if p_session is null then
    raise exception 'sessão obrigatória' using errcode = '22023';
  end if;
  if not (p_name = any (public.quiz_event_names())) then
    raise exception 'evento desconhecido' using errcode = '22023';
  end if;

  s := public.quiz_session_for_write(p_session);

  if s.id is null then
    -- Só o próprio navegador cria a sessão, e só com o primeiro evento.
    insert into public.quiz_sessions (id, user_id, utm_source, utm_medium, utm_campaign, utm_content, theme)
    values (
      p_session,
      auth.uid(),
      nullif(left(attr ->> 'source', 60), ''),
      nullif(left(attr ->> 'medium', 60), ''),
      nullif(left(attr ->> 'campaign', 60), ''),
      nullif(left(attr ->> 'content', 60), ''),
      nullif(left(attr ->> 'theme', 30), '')
    )
    on conflict (id) do nothing;
  end if;

  -- Ritmo: 60 eventos por sessão. O quiz inteiro produz uns 15.
  if (select count(*) from public.quiz_events e where e.session_id = p_session) >= 60 then
    return;
  end if;

  insert into public.quiz_events (session_id, user_id, name, step)
  values (p_session, coalesce(s.user_id, auth.uid()), p_name, p_step);

  update public.quiz_sessions
     set status = case
           when p_name = 'quiz_completed' and status = 'iniciado' then 'concluido'::public.quiz_status
           when p_name = 'quiz_abandoned' and status = 'iniciado' then 'abandonado'::public.quiz_status
           else status
         end,
         completed_at = case when p_name = 'quiz_completed' then coalesce(completed_at, now()) else completed_at end,
         abandoned_at = case when p_name = 'quiz_abandoned' then coalesce(abandoned_at, now()) else abandoned_at end,
         current_step = coalesce(p_step, current_step),
         updated_at = now()
   where id = p_session;
end;
$$;

revoke all on function public.quiz_track(uuid, text, integer, jsonb) from public;
grant execute on function public.quiz_track(uuid, text, integer, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- guardar respostas e diagnóstico
-- ---------------------------------------------------------------------------

create or replace function public.quiz_save(
  p_session uuid,
  p_answers jsonb,
  p_diagnosis jsonb default null,
  p_step integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.quiz_sessions%rowtype;
begin
  s := public.quiz_session_for_write(p_session);
  if s.id is null then
    raise exception 'sessão não encontrada' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'respostas inválidas' using errcode = '22023';
  end if;

  update public.quiz_sessions
     set answers = coalesce(p_answers, answers),
         diagnosis = coalesce(p_diagnosis, diagnosis),
         current_step = coalesce(p_step, current_step),
         updated_at = now()
   where id = p_session;
end;
$$;

revoke all on function public.quiz_save(uuid, jsonb, jsonb, integer) from public;
grant execute on function public.quiz_save(uuid, jsonb, jsonb, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- vincular à conta e marcar o plano como ativado
-- ---------------------------------------------------------------------------

/*
  Depois do cadastro. A sessão precisa estar sem dono (ou já ser da pessoa):
  é o que impede alguém de vincular a sessão de outra pessoa só por ter o
  id. A partir daqui os eventos da sessão carregam o user_id.
*/
create or replace function public.quiz_link_to_me(p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  s public.quiz_sessions%rowtype;
begin
  if me is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  s := public.quiz_session_for_write(p_session);
  if s.id is null then
    return false;
  end if;

  update public.quiz_sessions
     set user_id = me,
         status = case when status in ('iniciado', 'concluido', 'abandonado') then 'vinculado'::public.quiz_status else status end,
         linked_at = coalesce(linked_at, now()),
         updated_at = now()
   where id = p_session;

  update public.quiz_events set user_id = me where session_id = p_session and user_id is null;

  return true;
end;
$$;

revoke all on function public.quiz_link_to_me(uuid) from public, anon;
grant execute on function public.quiz_link_to_me(uuid) to authenticated;

create or replace function public.quiz_mark_activated(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  update public.quiz_sessions
     set status = 'ativado',
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = p_session and user_id = me;
end;
$$;

revoke all on function public.quiz_mark_activated(uuid) from public, anon;
grant execute on function public.quiz_mark_activated(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- o funil, pro painel
-- ---------------------------------------------------------------------------

/*
  Cada etapa conta SESSÕES distintas que registraram o evento no período,
  não eventos: uma pessoa que viu a prévia três vezes é uma pessoa. O
  abandono sai por passo, pra o painel dizer onde o quiz perde gente.
*/
create or replace function public.admin_quiz_funnel(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  if p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'stages', coalesce((
      select jsonb_object_agg(n.name, coalesce(c.sessions, 0))
        from unnest(public.quiz_event_names()) as n(name)
        left join (
          select e.name, count(distinct e.session_id) as sessions
            from public.quiz_events e
           where e.created_at >= from_ts and e.created_at < to_ts
           group by e.name
        ) c on c.name = n.name
    ), '{}'::jsonb),
    'abandoned_by_step', coalesce((
      select jsonb_object_agg(a.step::text, a.n)
        from (
          select coalesce(e.step, -1) as step, count(distinct e.session_id) as n
            from public.quiz_events e
           where e.name = 'quiz_abandoned'
             and e.created_at >= from_ts and e.created_at < to_ts
           group by coalesce(e.step, -1)
        ) a
    ), '{}'::jsonb),
    'by_source', coalesce((
      select jsonb_object_agg(coalesce(s.utm_source, 'direto'), s.n)
        from (
          select q.utm_source, count(*) as n
            from public.quiz_sessions q
           where q.entered_at >= from_ts and q.entered_at < to_ts
           group by q.utm_source
        ) s
    ), '{}'::jsonb),
    'by_theme', coalesce((
      select jsonb_object_agg(coalesce(s.theme, 'padrao'), s.n)
        from (
          select q.theme, count(*) as n
            from public.quiz_sessions q
           where q.entered_at >= from_ts and q.entered_at < to_ts
           group by q.theme
        ) s
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_quiz_funnel(date, date) from public, anon;
grant execute on function public.admin_quiz_funnel(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- limpeza: sessão sem dono não vive pra sempre
-- ---------------------------------------------------------------------------

create or replace function public.purge_stale_quiz_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  with gone as (
    delete from public.quiz_sessions
     where user_id is null and updated_at < now() - interval '90 days'
    returning id
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke all on function public.purge_stale_quiz_sessions() from public, anon, authenticated;
grant execute on function public.purge_stale_quiz_sessions() to service_role;

do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'momentumm-purge-quiz-sessions';
  perform cron.schedule('momentumm-purge-quiz-sessions', '30 4 * * *', 'select public.purge_stale_quiz_sessions()');
exception when others then
  raise notice 'pg_cron indisponível (%): rodar purge_stale_quiz_sessions() à mão.', sqlerrm;
end $$;
