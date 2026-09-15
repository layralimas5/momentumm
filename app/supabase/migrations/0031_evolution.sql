-- ===========================================================================
-- 0031 — Evolução: XP, níveis e conquistas
-- ===========================================================================
--
-- O XP é concedido AQUI, e só aqui. Nenhuma linha de `xp_transactions` nasce
-- da API: as políticas só deixam o dono LER, e quem escreve são as funções
-- `security definer` disparadas por trigger em `tasks`, `habit_logs`,
-- `plan_stages`, `objectives` e `weekly_reviews`. O cliente não manda pontos,
-- não manda tipo, não manda nada: ele muda o status de uma ação e o banco
-- decide se isso vale XP, quanto, e se já valeu antes.
--
-- Três defesas contra farming, todas no servidor:
--   1. chave única por evento (`task_done:<id>`): marcar e desmarcar cem vezes
--      concede uma;
--   2. teto diário por tipo (`xp_rules.daily_cap`): vinte ações de um minuto
--      rendem no máximo oito;
--   3. lock da linha de `user_evolution` durante a concessão: dois cliques
--      simultâneos entram na fila, e o segundo enxerga o primeiro.
--
-- Os números daqui são espelhados em `src/domain/entities/evolution.ts`, e um
-- teste confere que os dois não divergiram. Mudar uma regra é mudar as duas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- configuração
-- ---------------------------------------------------------------------------

create table public.xp_rules (
  kind        text primary key,
  points      integer not null check (points >= 0),
  -- Teto de pontos desse tipo por dia. Null é sem teto.
  daily_cap   integer check (daily_cap is null or daily_cap > 0),
  description text not null
);

insert into public.xp_rules (kind, points, daily_cap, description) values
  ('task_done',       5,   40,   'Ação do Hoje concluída. Até oito por dia.'),
  ('priority_done',   10,  10,   'Prioridade do dia concluída. No lugar da ação comum, não junto.'),
  ('habit_done',      3,   15,   'Hábito cumprido, inclusive na versão mínima. Até cinco por dia.'),
  ('priorities_day',  15,  15,   'Todas as prioridades do dia fechadas, com pelo menos duas.'),
  ('review_done',     25,  25,   'Review Semanal concluído.'),
  ('stage_done',      50,  100,  'Etapa do plano concluída.'),
  ('objective_done',  100, 100,  'Objetivo concluído.'),
  ('comeback',        20,  20,   'Voltou a executar depois de pelo menos dois dias parado.'),
  ('week_consistent', 30,  30,   'Cinco dias com movimento na mesma semana.'),
  ('achievement',     0,   null, 'O XP que algumas conquistas trazem junto.');

create table public.xp_levels (
  level  integer primary key check (level >= 1),
  name   text not null,
  min_xp integer not null check (min_xp >= 0)
);

insert into public.xp_levels (level, name, min_xp) values
  (1,  'Começo',       0),
  (2,  'Movimento',    100),
  (3,  'Ritmo',        300),
  (4,  'Tração',       700),
  (5,  'Consistência', 1500),
  (6,  'Impulso',      3000),
  (7,  'Firmeza',      6000),
  (8,  'Amplitude',    9500),
  (9,  'Maestria',     13500),
  (10, 'Legado',       18000);

create table public.achievement_rules (
  key            text primary key,
  points         integer not null default 0 check (points >= 0),
  -- Nível exigido, só nas conquistas de nível.
  required_level integer check (required_level is null or required_level >= 1)
);

insert into public.achievement_rules (key, points, required_level) values
  ('primeira_semana',  20, null),
  ('primeiro_marco',   20, null),
  ('de_volta_ao_jogo', 20, null),
  ('pegou_ritmo',      40, null),
  ('momentum',         30, null),
  ('primeira_vitoria', 50, null),
  ('em_movimento',     0,  2),
  ('tracao',           0,  4),
  ('consistencia',     0,  5);

-- ---------------------------------------------------------------------------
-- dados por pessoa
-- ---------------------------------------------------------------------------

create table public.xp_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null references public.xp_rules (kind),
  points      integer not null check (points > 0),
  -- A chave que impede a segunda concessão do mesmo evento.
  event_key   text not null check (char_length(event_key) between 3 and 160),
  source_type text not null,
  source_id   text,
  day         date not null,
  created_at  timestamptz not null default now(),
  constraint xp_transactions_once_per_event unique (user_id, event_key)
);

create index xp_transactions_user_day_idx on public.xp_transactions (user_id, day desc);
create index xp_transactions_user_kind_day_idx on public.xp_transactions (user_id, kind, day);

create table public.user_evolution (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  xp_total   integer not null default 0 check (xp_total >= 0),
  level      integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  key         text not null references public.achievement_rules (key),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- RLS: dono lê, ninguém escreve pela API
-- ---------------------------------------------------------------------------

alter table public.xp_rules          enable row level security;
alter table public.xp_levels         enable row level security;
alter table public.achievement_rules enable row level security;
alter table public.xp_transactions   enable row level security;
alter table public.user_evolution    enable row level security;
alter table public.user_achievements enable row level security;

create policy "regras de XP são públicas pra quem está logado"
  on public.xp_rules for select to authenticated using (true);

create policy "níveis são públicos pra quem está logado"
  on public.xp_levels for select to authenticated using (true);

create policy "regras de conquista são públicas pra quem está logado"
  on public.achievement_rules for select to authenticated using (true);

create policy "dono lê as próprias transações de XP"
  on public.xp_transactions for select to authenticated using (auth.uid() = user_id);

create policy "dono lê a própria evolução"
  on public.user_evolution for select to authenticated using (auth.uid() = user_id);

create policy "dono lê as próprias conquistas"
  on public.user_achievements for select to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- funções internas
-- ---------------------------------------------------------------------------

-- O dia do XP é o dia REAL em que aconteceu, no fuso do produto. Usar o dia
-- planejado da ação deixaria alguém fechar trinta dias passados e furar o teto.
create or replace function public.evolution_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- O nível de um total. Acima da última linha da tabela, cada nível pede
-- 5000 a mais: a fórmula continua sozinha, ninguém bate em teto.
create or replace function public.evolution_level_of(p_xp integer)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_level integer;
  v_last  public.xp_levels%rowtype;
begin
  select * into v_last from public.xp_levels order by level desc limit 1;

  if p_xp >= v_last.min_xp then
    return v_last.level + floor((p_xp - v_last.min_xp) / 5000.0)::integer;
  end if;

  select max(level) into v_level from public.xp_levels where min_xp <= greatest(p_xp, 0);
  return coalesce(v_level, 1);
end;
$$;

-- Concede uma vez, dentro do teto do dia. Devolve true só quando gravou.
create or replace function public.evolution_award(
  p_user        uuid,
  p_kind        text,
  p_event_key   text,
  p_source_type text,
  p_source_id   text,
  p_day         date,
  p_points      integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule   public.xp_rules%rowtype;
  v_points integer;
  v_spent  integer;
  v_total  integer;
begin
  select * into v_rule from public.xp_rules where kind = p_kind;
  if not found then
    raise exception 'regra de XP desconhecida: %', p_kind using errcode = '22023';
  end if;

  v_points := coalesce(p_points, v_rule.points);
  if v_points <= 0 then
    return false;
  end if;

  -- Serializa as concessões da pessoa: dois cliques ao mesmo tempo entram
  -- na fila, e o segundo já enxerga o teto gasto pelo primeiro.
  insert into public.user_evolution (user_id) values (p_user)
    on conflict (user_id) do nothing;
  perform 1 from public.user_evolution where user_id = p_user for update;

  if exists (
    select 1 from public.xp_transactions
     where user_id = p_user and event_key = p_event_key
  ) then
    return false;
  end if;

  if v_rule.daily_cap is not null then
    select coalesce(sum(points), 0) into v_spent
      from public.xp_transactions
     where user_id = p_user and kind = p_kind and day = p_day;
    if v_spent + v_points > v_rule.daily_cap then
      return false;
    end if;
  end if;

  insert into public.xp_transactions (user_id, kind, points, event_key, source_type, source_id, day)
  values (p_user, p_kind, v_points, p_event_key, p_source_type, p_source_id, p_day)
  on conflict (user_id, event_key) do nothing;
  if not found then
    return false;
  end if;

  update public.user_evolution
     set xp_total   = xp_total + v_points,
         level      = public.evolution_level_of(xp_total + v_points),
         updated_at = now()
   where user_id = p_user
   returning xp_total into v_total;

  return true;
end;
$$;

-- Retomada e semana consistente. Leem só os tipos de movimento.
create or replace function public.evolution_after_progress(p_user uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last       date;
  v_week_start date;
  v_days       integer;
begin
  select max(day) into v_last
    from public.xp_transactions
   where user_id = p_user
     and kind in ('task_done', 'priority_done', 'habit_done')
     and day < p_day;

  -- Sem histórico anterior não existe "voltar": é o primeiro dia da conta.
  if v_last is not null and (p_day - v_last) > 2 then
    perform public.evolution_award(p_user, 'comeback', 'comeback:' || p_day, 'day', p_day::text, p_day);
  end if;

  v_week_start := date_trunc('week', p_day)::date;

  select count(distinct day) into v_days
    from public.xp_transactions
   where user_id = p_user
     and kind in ('task_done', 'priority_done', 'habit_done')
     and day >= v_week_start
     and day <= v_week_start + 6;

  if v_days >= 5 then
    perform public.evolution_award(
      p_user, 'week_consistent', 'week_consistent:' || v_week_start, 'week', v_week_start::text, p_day
    );
  end if;
end;
$$;

-- Uma conquista qualifica? Cada condição lê o que já está gravado.
create or replace function public.evolution_qualifies(p_user uuid, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule  public.achievement_rules%rowtype;
  v_level integer;
begin
  select * into v_rule from public.achievement_rules where key = p_key;
  if not found then
    return false;
  end if;

  if v_rule.required_level is not null then
    select level into v_level from public.user_evolution where user_id = p_user;
    return coalesce(v_level, 1) >= v_rule.required_level;
  end if;

  return case p_key
    when 'primeira_semana'  then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'review_done')
    when 'primeiro_marco'   then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'stage_done')
    when 'primeira_vitoria' then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'objective_done')
    when 'de_volta_ao_jogo' then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'comeback')
    when 'momentum'         then exists (select 1 from public.xp_transactions where user_id = p_user and kind = 'week_consistent')
    when 'pegou_ritmo'      then (
      select count(distinct day) from public.xp_transactions
       where user_id = p_user and kind = 'priority_done'
    ) >= 7
    else false
  end;
end;
$$;

-- Conquistas até estabilizar: uma conquista com XP pode subir o nível, e o
-- nível novo pode valer outra. As de nível não trazem XP, então o laço para.
create or replace function public.evolution_settle(p_user uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule    public.achievement_rules%rowtype;
  v_changed boolean;
  v_round   integer := 0;
begin
  loop
    v_changed := false;
    v_round := v_round + 1;

    for v_rule in select * from public.achievement_rules order by key loop
      if exists (select 1 from public.user_achievements where user_id = p_user and key = v_rule.key) then
        continue;
      end if;
      if not public.evolution_qualifies(p_user, v_rule.key) then
        continue;
      end if;

      insert into public.user_achievements (user_id, key) values (p_user, v_rule.key)
        on conflict do nothing;
      if found then
        v_changed := true;
        if v_rule.points > 0 then
          perform public.evolution_award(
            p_user, 'achievement', 'achievement:' || v_rule.key, 'achievement', v_rule.key, p_day, v_rule.points
          );
        end if;
      end if;
    end loop;

    exit when not v_changed or v_round >= 5;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- triggers: as portas por onde o XP entra
-- ---------------------------------------------------------------------------

create or replace function public.evolution_on_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := public.evolution_today();
  v_total integer;
  v_done  integer;
begin
  if new.status <> 'feita' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'feita' then
    return new;
  end if;

  -- A prioridade vale no lugar da ação comum: a chave é a mesma, então uma
  -- ação que muda de flag depois de feita não ganha duas vezes.
  perform public.evolution_award(
    new.user_id,
    case when new.is_main_priority then 'priority_done' else 'task_done' end,
    'task_done:' || new.id,
    'task',
    new.id::text,
    v_day
  );

  -- Todas as prioridades do dia (principal ou alta), quando há pelo menos duas.
  select count(*), count(*) filter (where status = 'feita')
    into v_total, v_done
    from public.tasks
   where user_id = new.user_id
     and day = new.day
     and status <> 'cancelada'
     and (is_main_priority or priority = 'alta');

  if v_total >= 2 and v_done >= v_total then
    perform public.evolution_award(
      new.user_id, 'priorities_day', 'priorities_day:' || new.day, 'day', new.day::text, v_day
    );
  end if;

  perform public.evolution_after_progress(new.user_id, v_day);
  perform public.evolution_settle(new.user_id, v_day);
  return new;
end;
$$;

create trigger tasks_evolution
  after insert or update of status on public.tasks
  for each row execute function public.evolution_on_task();

create or replace function public.evolution_on_habit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := public.evolution_today();
begin
  if new.status not in ('feito', 'minimo') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('feito', 'minimo') then
    return new;
  end if;

  perform public.evolution_award(
    new.user_id, 'habit_done', 'habit_done:' || new.habit_id || ':' || new.day, 'habit', new.habit_id::text, v_day
  );
  perform public.evolution_after_progress(new.user_id, v_day);
  perform public.evolution_settle(new.user_id, v_day);
  return new;
end;
$$;

create trigger habit_logs_evolution
  after insert or update of status on public.habit_logs
  for each row execute function public.evolution_on_habit_log();

create or replace function public.evolution_on_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := public.evolution_today();
begin
  if new.status <> 'concluida' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'concluida' then
    return new;
  end if;

  perform public.evolution_award(
    new.user_id, 'stage_done', 'stage_done:' || new.id, 'stage', new.id::text, v_day
  );
  perform public.evolution_settle(new.user_id, v_day);
  return new;
end;
$$;

create trigger plan_stages_evolution
  after insert or update of status on public.plan_stages
  for each row execute function public.evolution_on_stage();

create or replace function public.evolution_on_objective()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := public.evolution_today();
begin
  if new.completed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  perform public.evolution_award(
    new.user_id, 'objective_done', 'objective_done:' || new.id, 'objective', new.id::text, v_day
  );
  perform public.evolution_settle(new.user_id, v_day);
  return new;
end;
$$;

create trigger objectives_evolution
  after insert or update of completed_at on public.objectives
  for each row execute function public.evolution_on_objective();

create or replace function public.evolution_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := public.evolution_today();
begin
  if new.completed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  perform public.evolution_award(
    new.user_id, 'review_done', 'review_done:' || new.week_start, 'week', new.week_start::text, v_day
  );
  perform public.evolution_settle(new.user_id, v_day);
  return new;
end;
$$;

create trigger weekly_reviews_evolution
  after insert or update of completed_at on public.weekly_reviews
  for each row execute function public.evolution_on_review();

-- ---------------------------------------------------------------------------
-- permissões: nada disso é chamável pela API
-- ---------------------------------------------------------------------------

revoke all on function public.evolution_level_of(integer) from public, anon, authenticated;
revoke all on function public.evolution_award(uuid, text, text, text, text, date, integer) from public, anon, authenticated;
revoke all on function public.evolution_after_progress(uuid, date) from public, anon, authenticated;
revoke all on function public.evolution_qualifies(uuid, text) from public, anon, authenticated;
revoke all on function public.evolution_settle(uuid, date) from public, anon, authenticated;
revoke all on function public.evolution_on_task() from public, anon, authenticated;
revoke all on function public.evolution_on_habit_log() from public, anon, authenticated;
revoke all on function public.evolution_on_stage() from public, anon, authenticated;
revoke all on function public.evolution_on_objective() from public, anon, authenticated;
revoke all on function public.evolution_on_review() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- painel: só agregados
-- ---------------------------------------------------------------------------

-- O admin vê a distribuição por nível e o XP da semana, nunca a lista de
-- transações de alguém. É o mesmo contrato das outras métricas do painel.
create or replace function public.admin_evolution_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_week_start date := date_trunc('week', public.evolution_today())::date;
begin
  perform public.assert_admin();

  return jsonb_build_object(
    'people', (select count(*) from public.user_evolution),
    'xpTotal', (select coalesce(sum(xp_total), 0) from public.user_evolution),
    'xpThisWeek', (
      select coalesce(sum(points), 0) from public.xp_transactions where day >= v_week_start
    ),
    'activeThisWeek', (
      select count(distinct user_id) from public.xp_transactions where day >= v_week_start
    ),
    'byLevel', (
      select coalesce(jsonb_agg(jsonb_build_object('level', level, 'people', people) order by level), '[]'::jsonb)
        from (select level, count(*) as people from public.user_evolution group by level) t
    ),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object('key', key, 'people', people) order by key), '[]'::jsonb)
        from (select key, count(*) as people from public.user_achievements group by key) t
    )
  );
end;
$$;

revoke all on function public.admin_evolution_metrics() from public, anon;
grant execute on function public.admin_evolution_metrics() to authenticated;

-- ---------------------------------------------------------------------------
-- o que já aconteceu antes desta migration
-- ---------------------------------------------------------------------------

-- Quem concluiu ação, hábito, etapa, objetivo ou review antes do XP existir
-- não começa do zero. A concessão passa pelas mesmas funções, com o dia real
-- de cada conclusão, então teto e chave única valem pro passado também.
do $$
declare
  r record;
begin
  for r in
    select id, user_id, is_main_priority, (completed_at at time zone 'America/Sao_Paulo')::date as d
      from public.tasks where status = 'feita' and completed_at is not null
     order by completed_at
  loop
    perform public.evolution_award(
      r.user_id,
      case when r.is_main_priority then 'priority_done' else 'task_done' end,
      'task_done:' || r.id, 'task', r.id::text, r.d
    );
  end loop;

  for r in
    select habit_id, user_id, day
      from public.habit_logs where status in ('feito', 'minimo')
     order by day
  loop
    perform public.evolution_award(
      r.user_id, 'habit_done', 'habit_done:' || r.habit_id || ':' || r.day, 'habit', r.habit_id::text, r.day
    );
  end loop;

  for r in
    select id, user_id, (completed_at at time zone 'America/Sao_Paulo')::date as d
      from public.plan_stages where status = 'concluida' and completed_at is not null
     order by completed_at
  loop
    perform public.evolution_award(r.user_id, 'stage_done', 'stage_done:' || r.id, 'stage', r.id::text, r.d);
  end loop;

  for r in
    select id, user_id, (completed_at at time zone 'America/Sao_Paulo')::date as d
      from public.objectives where completed_at is not null
     order by completed_at
  loop
    perform public.evolution_award(r.user_id, 'objective_done', 'objective_done:' || r.id, 'objective', r.id::text, r.d);
  end loop;

  for r in
    select week_start, user_id, (completed_at at time zone 'America/Sao_Paulo')::date as d
      from public.weekly_reviews where completed_at is not null
     order by completed_at
  loop
    perform public.evolution_award(r.user_id, 'review_done', 'review_done:' || r.week_start, 'week', r.week_start::text, r.d);
  end loop;

  for r in select distinct user_id from public.user_evolution loop
    perform public.evolution_settle(r.user_id, public.evolution_today());
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- a tela nova entra na lista de recursos do analytics
-- ---------------------------------------------------------------------------

create or replace function public.product_feature_names()
returns text[]
language sql
immutable
as $$
  select array[
    'hoje', 'objetivos', 'habitos', 'plano', 'progresso', 'review',
    'momentum_score', 'ai', 'retomada', 'compartilhamento',
    'registro_texto', 'registro_foto', 'registro_voz',
    'circulo', 'desafios', 'foco', 'insights', 'perfil', 'evolucao',
    'configuracoes', 'assinatura'
  ];
$$;
