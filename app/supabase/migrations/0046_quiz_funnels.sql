-- Momentumm — mais de um funil de quiz.
--
-- Até aqui existia UM quiz, com sete perguntas escritas no código e um
-- diagnóstico que sabia de cor quais eram elas. Isso serve pro funil
-- principal e não serve pra mais nada: um quiz de carreira não pergunta o
-- mesmo que um de saúde.
--
-- O que muda: o quiz vira registro. Cada um tem slug, copy de entrada e
-- suas próprias perguntas, e a sessão passa a dizer de qual quiz ela é.
--
-- O que NÃO muda: o `/criar-meu-plano` continua exatamente como está. Ele
-- entra aqui como `built_in`, quer dizer, "as perguntas deste vivem no
-- código". Trocar o motor do funil que capta hoje é passo separado, com o
-- diagnóstico junto, e não vale arriscar no mesmo dia.
--
-- Sessão, eventos, contato e vínculo com a conta já eram genéricos: é por
-- isso que um quiz novo nasce medido e com os contatos na mesma lista.

-- ---------------------------------------------------------------------------
-- os quizzes
-- ---------------------------------------------------------------------------

do $$ begin
  /* O que o quiz faz quando termina. */
  create type public.quiz_purpose as enum (
    -- Gera plano no app: exige conta, e o diagnóstico é do motor do produto.
    'plano',
    -- Só capta contato: termina numa mensagem, sem conta e sem plano.
    'contato'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quiz_state as enum ('rascunho', 'publicado', 'arquivado');
exception when duplicate_object then null; end $$;

create table if not exists public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name          text not null check (char_length(name) between 2 and 80),
  purpose       public.quiz_purpose not null default 'contato',
  state         public.quiz_state not null default 'rascunho',
  /* A copy da abertura. Vazio usa o texto padrão da tela. */
  headline      text check (headline is null or char_length(headline) <= 120),
  subheadline   text check (subheadline is null or char_length(subheadline) <= 280),
  cta_label     text check (cta_label is null or char_length(cta_label) <= 40),
  /* O que a pessoa vê no fim, quando o quiz é só de captação. */
  outro         text check (outro is null or char_length(outro) <= 400),
  /*
    Perguntas no código, não no banco.
    Só o quiz original é assim, e ele continua assim até a migração do motor.
  */
  built_in      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null
);

comment on table public.quizzes is
  'Cada funil de entrada. O slug é a URL: /quiz/<slug>. O original (built_in) mora em /criar-meu-plano.';

create index if not exists quizzes_state_idx on public.quizzes (state) where state = 'publicado';

do $$ begin
  create type public.quiz_question_kind as enum ('unica', 'multipla', 'texto', 'escala');
exception when duplicate_object then null; end $$;

create table if not exists public.quiz_questions (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  position   smallint not null check (position between 1 and 20),
  /* A chave dessa resposta dentro de `quiz_sessions.answers`. */
  key        text not null check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  kind       public.quiz_question_kind not null default 'unica',
  title      text not null check (char_length(title) between 3 and 160),
  hint       text check (hint is null or char_length(hint) <= 200),
  required   boolean not null default true,
  /* [{"value":"manha","label":"De manhã"}]. Vazio em texto e escala. */
  options    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint quiz_questions_unique_key unique (quiz_id, key),
  constraint quiz_questions_unique_position unique (quiz_id, position) deferrable initially deferred,
  constraint quiz_questions_options_size check (pg_column_size(options) <= 2048),
  constraint quiz_questions_options_shape check (jsonb_typeof(options) = 'array')
);

create index if not exists quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

/* A sessão passa a dizer de qual quiz ela é. Nulo é o funil original. */
alter table public.quiz_sessions
  add column if not exists quiz_id uuid references public.quizzes (id) on delete set null;

create index if not exists quiz_sessions_quiz_idx on public.quiz_sessions (quiz_id, entered_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;

/*
  Sem política de leitura direta, igual ao resto do quiz.

  Quem está respondendo lê pela função `quiz_public`, que devolve só o que
  está publicado e só o que a tela precisa. Rascunho não vaza por engano, e
  ninguém lista os funis da empresa pela API.
*/

-- O funil original entra como registro, sem mexer em nada do que ele faz.
insert into public.quizzes (slug, name, purpose, state, built_in)
values ('criar-meu-plano', 'Plano em 7 perguntas', 'plano', 'publicado', true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- leitura pública: o quiz que a pessoa vai responder
-- ---------------------------------------------------------------------------

create or replace function public.quiz_public(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.quizzes;
begin
  select * into q from public.quizzes where slug = p_slug and state = 'publicado';
  if not found then
    raise exception 'quiz não encontrado' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', q.id,
    'slug', q.slug,
    'name', q.name,
    'purpose', q.purpose::text,
    'built_in', q.built_in,
    'headline', q.headline,
    'subheadline', q.subheadline,
    'cta_label', q.cta_label,
    'outro', q.outro,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', x.key, 'kind', x.kind::text, 'title', x.title,
        'hint', x.hint, 'required', x.required, 'options', x.options
      ) order by x.position)
        from public.quiz_questions x
       where x.quiz_id = q.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.quiz_public(text) from public;
grant execute on function public.quiz_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- abrir a sessão já amarrada ao quiz
-- ---------------------------------------------------------------------------

/*
  Função separada em vez de um parâmetro novo no `quiz_track`.

  Acrescentar parâmetro criaria uma segunda assinatura da função que o funil
  que está no ar chama a cada passo, e as duas juntas deixam o PostgREST sem
  saber qual escolher. O funil principal não pode piscar por causa disso.
*/
create or replace function public.quiz_start(
  p_session uuid,
  p_slug text,
  p_attribution jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  attr jsonb := coalesce(p_attribution, '{}'::jsonb);
begin
  select * into q from public.quizzes where slug = p_slug and state = 'publicado';
  if not found then
    raise exception 'quiz não encontrado' using errcode = 'P0002';
  end if;

  insert into public.quiz_sessions (id, quiz_id, utm_source, utm_medium, utm_campaign, utm_content, theme)
  values (
    p_session, q.id,
    nullif(lower(btrim(attr ->> 'utm_source')), ''),
    nullif(lower(btrim(attr ->> 'utm_medium')), ''),
    nullif(lower(btrim(attr ->> 'utm_campaign')), ''),
    nullif(lower(btrim(attr ->> 'utm_content')), ''),
    nullif(lower(btrim(attr ->> 'theme')), '')
  )
  on conflict (id) do nothing;

  insert into public.quiz_events (session_id, name, step)
  values (p_session, 'quiz_started', 0);
end;
$$;

revoke all on function public.quiz_start(uuid, text, jsonb) from public;
grant execute on function public.quiz_start(uuid, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- painel: listar, salvar e publicar funis
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_quizzes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role('owner', 'admin', 'analyst');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'slug', q.slug,
      'name', q.name,
      'purpose', q.purpose::text,
      'state', q.state::text,
      'built_in', q.built_in,
      'headline', q.headline,
      'subheadline', q.subheadline,
      'cta_label', q.cta_label,
      'outro', q.outro,
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', x.key, 'kind', x.kind::text, 'title', x.title,
          'hint', x.hint, 'required', x.required, 'options', x.options
        ) order by x.position)
          from public.quiz_questions x where x.quiz_id = q.id
      ), '[]'::jsonb),
      'sessions', (select count(*) from public.quiz_sessions s where s.quiz_id = q.id),
      'leads', (select count(*) from public.quiz_sessions s where s.quiz_id = q.id and s.lead_email is not null),
      'created_at', q.created_at,
      'updated_at', q.updated_at
    ) order by q.created_at)
      from public.quizzes q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_quizzes() from public, anon;
grant execute on function public.admin_list_quizzes() to authenticated;

/*
  Grava o funil inteiro de uma vez: o quiz e as perguntas na mesma
  transação. Salvar pergunta a pergunta deixaria um funil publicado no meio
  de uma edição, com metade das perguntas novas e metade das antigas.
*/
create or replace function public.admin_save_quiz(
  p_slug text,
  p_name text,
  p_purpose text,
  p_questions jsonb,
  p_reason text,
  p_headline text default null,
  p_subheadline text default null,
  p_cta_label text default null,
  p_outro text default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  item jsonb;
  ordem smallint := 0;
  novo boolean := false;
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'o motivo é obrigatório' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' then
    raise exception 'as perguntas precisam ser uma lista' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) > 20 then
    raise exception 'no máximo 20 perguntas por funil' using errcode = '22023';
  end if;

  select * into q from public.quizzes where slug = p_slug;

  if not found then
    insert into public.quizzes (slug, name, purpose, headline, subheadline, cta_label, outro, created_by)
    values (p_slug, btrim(p_name), p_purpose::public.quiz_purpose,
            nullif(btrim(coalesce(p_headline, '')), ''),
            nullif(btrim(coalesce(p_subheadline, '')), ''),
            nullif(btrim(coalesce(p_cta_label, '')), ''),
            nullif(btrim(coalesce(p_outro, '')), ''),
            auth.uid())
    returning * into q;
    novo := true;
  else
    if q.built_in then
      raise exception 'o funil original tem as perguntas no código e não se edita por aqui'
        using errcode = '42501';
    end if;
    update public.quizzes
       set name = btrim(p_name),
           purpose = p_purpose::public.quiz_purpose,
           headline = nullif(btrim(coalesce(p_headline, '')), ''),
           subheadline = nullif(btrim(coalesce(p_subheadline, '')), ''),
           cta_label = nullif(btrim(coalesce(p_cta_label, '')), ''),
           outro = nullif(btrim(coalesce(p_outro, '')), ''),
           updated_at = now()
     where id = q.id
    returning * into q;
  end if;

  /*
    As perguntas são substituídas, não mescladas.

    A tela manda a lista inteira toda vez, e essa é a única forma de
    apagar uma pergunta ou trocar a ordem sem inventar um protocolo de
    diferenças que ninguém vai acertar na pressa.
  */
  delete from public.quiz_questions where quiz_id = q.id;

  for item in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    ordem := ordem + 1;
    insert into public.quiz_questions (quiz_id, position, key, kind, title, hint, required, options)
    values (
      q.id, ordem,
      item ->> 'key',
      coalesce(nullif(item ->> 'kind', ''), 'unica')::public.quiz_question_kind,
      btrim(item ->> 'title'),
      nullif(btrim(coalesce(item ->> 'hint', '')), ''),
      coalesce((item ->> 'required')::boolean, true),
      coalesce(item -> 'options', '[]'::jsonb)
    );
  end loop;

  perform public.record_admin_audit(
    case when novo then 'quiz.create' else 'quiz.update' end,
    'quiz', q.id::text, null, 'ok', btrim(p_reason),
    null, jsonb_build_object('slug', q.slug, 'perguntas', ordem), p_context
  );

  return jsonb_build_object('id', q.id, 'slug', q.slug, 'questions', ordem);
end;
$$;

revoke all on function public.admin_save_quiz(text, text, text, jsonb, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_save_quiz(text, text, text, jsonb, text, text, text, text, text, jsonb) to authenticated;

create or replace function public.admin_set_quiz_state(p_slug text, p_state text, p_reason text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  destino public.quiz_state := p_state::public.quiz_state;
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'o motivo é obrigatório' using errcode = '22023';
  end if;

  select * into q from public.quizzes where slug = p_slug;
  if not found then
    raise exception 'quiz não encontrado' using errcode = 'P0002';
  end if;

  if destino = 'publicado' and not q.built_in
     and not exists (select 1 from public.quiz_questions x where x.quiz_id = q.id) then
    raise exception 'um funil sem pergunta nenhuma não vai pro ar' using errcode = '22023';
  end if;

  update public.quizzes set state = destino, updated_at = now() where id = q.id;

  perform public.record_admin_audit('quiz.state', 'quiz', q.id::text, null, 'ok', btrim(p_reason),
    jsonb_build_object('state', q.state::text), jsonb_build_object('state', destino::text), p_context);
end;
$$;

revoke all on function public.admin_set_quiz_state(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_set_quiz_state(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- o funil, agora por quiz
-- ---------------------------------------------------------------------------

/*
  A assinatura antiga sai junto.

  Deixar as duas versões vivas foi o que derrubou a aba de erros depois da
  0044: com duas candidatas o PostgREST não escolhe. Aqui a troca é feita
  de uma vez, e o painel novo vai no mesmo deploy.
*/
drop function if exists public.admin_quiz_funnel(date, date);

create or replace function public.admin_quiz_funnel(p_from date, p_to date, p_quiz text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  alvo uuid;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  if p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  if p_quiz is not null then
    select id into alvo from public.quizzes where slug = p_quiz;
    if alvo is null then
      raise exception 'quiz não encontrado' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'quiz', p_quiz,
    'stages', coalesce((
      select jsonb_object_agg(n.name, coalesce(c.sessions, 0))
        from unnest(public.quiz_event_names()) as n(name)
        left join (
          select e.name, count(distinct e.session_id) as sessions
            from public.quiz_events e
            join public.quiz_sessions s on s.id = e.session_id
           where e.created_at >= from_ts and e.created_at < to_ts
             and (alvo is null or s.quiz_id = alvo)
           group by e.name
        ) c on c.name = n.name
    ), '{}'::jsonb),
    'abandoned_by_step', coalesce((
      select jsonb_object_agg(a.step::text, a.n)
        from (
          select coalesce(e.step, -1) as step, count(distinct e.session_id) as n
            from public.quiz_events e
            join public.quiz_sessions s on s.id = e.session_id
           where e.name = 'quiz_abandoned'
             and e.created_at >= from_ts and e.created_at < to_ts
             and (alvo is null or s.quiz_id = alvo)
           group by coalesce(e.step, -1)
        ) a
    ), '{}'::jsonb),
    'by_source', coalesce((
      select jsonb_object_agg(coalesce(s.utm_source, 'direto'), s.n)
        from (
          select q.utm_source, count(*) as n
            from public.quiz_sessions q
           where q.entered_at >= from_ts and q.entered_at < to_ts
             and (alvo is null or q.quiz_id = alvo)
           group by q.utm_source
        ) s
    ), '{}'::jsonb),
    'by_theme', coalesce((
      select jsonb_object_agg(coalesce(s.theme, 'padrao'), s.n)
        from (
          select q.theme, count(*) as n
            from public.quiz_sessions q
           where q.entered_at >= from_ts and q.entered_at < to_ts
             and (alvo is null or q.quiz_id = alvo)
           group by q.theme
        ) s
    ), '{}'::jsonb),
    /* Um funil por quiz, pra comparar sem trocar de tela. */
    'by_quiz', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug, 'name', t.name, 'sessions', t.sessions, 'leads', t.leads
      ) order by t.sessions desc)
        from (
          select coalesce(z.slug, 'criar-meu-plano') as slug,
                 coalesce(z.name, 'Plano em 7 perguntas') as name,
                 count(*) as sessions,
                 count(*) filter (where s.lead_email is not null) as leads
            from public.quiz_sessions s
            left join public.quizzes z on z.id = s.quiz_id
           where s.entered_at >= from_ts and s.entered_at < to_ts
           group by 1, 2
        ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_quiz_funnel(date, date, text) from public, anon;
grant execute on function public.admin_quiz_funnel(date, date, text) to authenticated;
