-- Momentumm — contato de quem responde o quiz.
--
-- O quiz já guardava respostas e diagnóstico numa sessão anônima (0038). O
-- que faltava era poder FALAR com quem respondeu: até aqui, quem montava o
-- plano inteiro e não criava conta sumia sem deixar endereço.
--
-- O contato fica na própria sessão, não numa tabela nova: é a mesma pessoa,
-- e separar em duas tabelas só criaria uma junção pra reconstruir o que já
-- estava junto. A sessão continua sendo escrita por quem tem o id, e o
-- contato só pode ser gravado UMA vez por sessão (`lead_saved_at`), pra o id
-- no navegador de alguém não virar formulário de escrita livre.
--
-- LGPD: são dados pessoais de verdade (nome, e-mail, telefone, idade). O
-- consentimento é registrado com hora (`lead_consent_at`), a finalidade é
-- declarada na tela ("receber o plano e o contato do Momentumm"), a política
-- de privacidade é linkada ali mesmo, e a limpeza dos 90 dias da 0038
-- continua valendo: sessão sem dono morre, e o contato vai junto.

alter table public.quiz_sessions
  add column if not exists lead_name       text,
  add column if not exists lead_email      text,
  add column if not exists lead_phone      text,
  add column if not exists lead_age        smallint,
  add column if not exists lead_consent_at timestamptz,
  add column if not exists lead_saved_at   timestamptz;

do $$ begin
  alter table public.quiz_sessions
    add constraint quiz_sessions_lead_name_len
    check (lead_name is null or char_length(lead_name) between 2 and 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.quiz_sessions
    add constraint quiz_sessions_lead_email_form
    check (lead_email is null or lead_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$');
exception when duplicate_object then null; end $$;

-- Só dígitos, já normalizado no cliente: 10 ou 11 com DDD, até 15 com país.
do $$ begin
  alter table public.quiz_sessions
    add constraint quiz_sessions_lead_phone_form
    check (lead_phone is null or lead_phone ~ '^[0-9]{10,15}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.quiz_sessions
    add constraint quiz_sessions_lead_age_range
    check (lead_age is null or lead_age between 13 and 120);
exception when duplicate_object then null; end $$;

comment on column public.quiz_sessions.lead_email is
  'Contato deixado no quiz, antes de existir conta. Dado pessoal: só sai pelo painel, pra quem tem papel de contato.';

create index if not exists quiz_sessions_lead_idx
  on public.quiz_sessions (entered_at desc)
  where lead_email is not null;

-- O evento novo entra na lista fechada de nomes do funil.
create or replace function public.quiz_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'quiz_viewed', 'quiz_started', 'quiz_question_answered', 'quiz_completed',
    'quiz_abandoned', 'lead_captured', 'diagnosis_viewed', 'plan_preview_viewed',
    'signup_started', 'signup_completed', 'plan_activated',
    'first_action_completed', 'trial_started', 'checkout_started',
    'subscription_completed'
  ];
$$;

-- ---------------------------------------------------------------------------
-- gravar o contato
-- ---------------------------------------------------------------------------

/*
  Uma vez por sessão. Nome e e-mail são obrigatórios; telefone e idade vêm
  como vierem. A validação de forma está nas constraints acima: aqui só
  normaliza (corta, baixa a caixa do e-mail, tira o que não é dígito do
  telefone) e recusa o que ficou vazio.
*/
create or replace function public.quiz_save_lead(
  p_session uuid,
  p_name text,
  p_email text,
  p_phone text default null,
  p_age integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.quiz_sessions%rowtype;
  v_name  text := nullif(btrim(left(coalesce(p_name, ''), 60)), '');
  v_email text := nullif(lower(btrim(left(coalesce(p_email, ''), 160))), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_age   smallint := case when p_age between 13 and 120 then p_age::smallint else null end;
begin
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'nome obrigatório' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][a-z]{2,}$' then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{10,15}$' then
    v_phone := null;
  end if;

  s := public.quiz_session_for_write(p_session);
  if s.id is null then
    raise exception 'sessão não encontrada' using errcode = '22023';
  end if;
  -- Já tem contato: a segunda tentativa não sobrescreve nem estoura.
  if s.lead_saved_at is not null then
    return false;
  end if;

  update public.quiz_sessions
     set lead_name = v_name,
         lead_email = v_email,
         lead_phone = v_phone,
         lead_age = v_age,
         lead_consent_at = now(),
         lead_saved_at = now(),
         updated_at = now()
   where id = p_session;

  return true;
end;
$$;

revoke all on function public.quiz_save_lead(uuid, text, text, text, integer) from public;
grant execute on function public.quiz_save_lead(uuid, text, text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ler no painel
-- ---------------------------------------------------------------------------

/*
  A lista de quem deixou contato, do mais novo pro mais velho.

  `p_pending` é o filtro que interessa no dia a dia: quem respondeu e NÃO
  virou conta. É essa gente que a lista existe pra alcançar.

  Papel de contato só: `analyst` enxerga o funil agregado (0038) e não
  precisa de nome e telefone de ninguém.
*/
create or replace function public.admin_quiz_leads(
  p_from date,
  p_to date,
  p_pending boolean default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  if p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  return (
    with filtered as (
      select q.*
        from public.quiz_sessions q
       where q.lead_email is not null
         and q.entered_at >= from_ts and q.entered_at < to_ts
         and (p_pending is null or (q.user_id is null) = p_pending)
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'pending', (select count(*) from filtered where user_id is null),
      'page', page,
      'page_size', size,
      'items', coalesce((
        select jsonb_agg(page_rows.item)
          from (
            select jsonb_build_object(
                     'id', f.id,
                     'name', f.lead_name,
                     'email', f.lead_email,
                     'phone', f.lead_phone,
                     'age', f.lead_age,
                     'goal', left(coalesce(f.answers ->> 'goal', ''), 120),
                     'area', coalesce(f.answers -> 'areas' ->> 0, ''),
                     'status', f.status::text,
                     'step', f.current_step,
                     'source', coalesce(f.utm_source, 'direto'),
                     'has_account', f.user_id is not null,
                     'entered_at', f.entered_at,
                     'consent_at', f.lead_consent_at
                   ) as item
              from filtered f
             order by f.entered_at desc
             limit size offset (page - 1) * size
          ) page_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_quiz_leads(date, date, boolean, integer, integer) from public, anon;
grant execute on function public.admin_quiz_leads(date, date, boolean, integer, integer) to authenticated;
