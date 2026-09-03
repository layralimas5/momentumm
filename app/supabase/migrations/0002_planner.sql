-- Momentumm — camada de planejamento do dashboard.
--
-- Check-in, hábitos, ações e vitórias. A atividade continua sendo a unidade
-- única do produto: concluir um hábito GERA uma activity do eixo dele, e é de
-- lá que streak, meta e estatística continuam saindo. Nada aqui é por eixo.
--
-- RLS ligada em tudo. Diferente da atividade, nada nessa migration é público:
-- energia, prioridade do dia e vitória pessoal só o dono lê.

-- ---------------------------------------------------------------------------
-- plano da conta
-- ---------------------------------------------------------------------------

create type plan_tier as enum ('free', 'pro');

alter table public.profiles
  add column plan plan_tier not null default 'free';

-- ---------------------------------------------------------------------------
-- check-ins — um por dia
-- ---------------------------------------------------------------------------

create type mood_state as enum ('sem-energia', 'automatico', 'estavel', 'motivado', 'em-alta');
create type focus_capacity as enum ('disperso', 'oscilando', 'afiado');

create table public.check_ins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  mood       mood_state not null,
  energy     smallint not null check (energy between 1 and 5),
  focus      focus_capacity not null,
  note       text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now(),
  constraint check_ins_one_per_day unique (user_id, day)
);

create index check_ins_user_day_idx on public.check_ins (user_id, day desc);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------

create type day_part as enum ('manha', 'tarde', 'noite', 'qualquer');
create type habit_status as enum ('pendente', 'feito', 'minimo', 'pulado', 'adiado');

create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 60),
  icon           text not null default 'livro',
  axis_slug      text not null references public.activity_types (slug),
  day_part       day_part not null default 'qualquer',
  -- Vazio significa todos os dias. 0 = domingo, como no getDay() do JS.
  weekdays       smallint[] not null default '{}',
  target         integer not null check (target > 0 and target <= 100000),
  minimal_target integer not null check (minimal_target > 0),
  created_at     timestamptz not null default now(),
  archived_at    timestamptz,
  constraint habits_minimal_within_target check (minimal_target <= target),
  constraint habits_weekdays_range check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

create index habits_user_idx on public.habits (user_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- habit_logs — um estado por hábito e dia
-- ---------------------------------------------------------------------------

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  day        date not null,
  status     habit_status not null,
  created_at timestamptz not null default now(),
  constraint habit_logs_one_per_day unique (habit_id, day)
);

create index habit_logs_user_day_idx on public.habit_logs (user_id, day desc);

-- ---------------------------------------------------------------------------
-- tasks — as ações que ligam meta a movimento
-- ---------------------------------------------------------------------------

create type task_effort as enum ('leve', 'medio', 'pesado');
create type task_status as enum ('pendente', 'feita', 'adiada');

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 90),
  goal_id          uuid references public.goals (id) on delete set null,
  axis_slug        text references public.activity_types (slug),
  estimated_min    integer not null default 25 check (estimated_min > 0 and estimated_min <= 480),
  effort           task_effort not null default 'medio',
  minimal_version  text check (minimal_version is null or char_length(minimal_version) <= 90),
  day              date not null,
  is_main_priority boolean not null default false,
  status           task_status not null default 'pendente',
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index tasks_user_day_idx on public.tasks (user_id, day);
create index tasks_goal_idx on public.tasks (goal_id) where status = 'pendente';

-- Uma prioridade principal por dia. O produto inteiro depende dessa regra:
-- duas prioridades principais é o mesmo que nenhuma.
create unique index tasks_one_main_priority_idx
  on public.tasks (user_id, day)
  where is_main_priority and status = 'pendente';

-- ---------------------------------------------------------------------------
-- wins — uma vitória por dia
-- ---------------------------------------------------------------------------

create table public.wins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  text       text not null check (char_length(text) between 2 and 140),
  created_at timestamptz not null default now(),
  constraint wins_one_per_day unique (user_id, day)
);

create index wins_user_day_idx on public.wins (user_id, day desc);

-- ---------------------------------------------------------------------------
-- RLS — tudo aqui é privado do dono
-- ---------------------------------------------------------------------------

alter table public.check_ins  enable row level security;
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;
alter table public.tasks      enable row level security;
alter table public.wins       enable row level security;

create policy "usuário gerencia os próprios check-ins"
  on public.check_ins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário gerencia os próprios hábitos"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário gerencia os próprios registros de hábito"
  on public.habit_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário gerencia as próprias ações"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário gerencia as próprias vitórias"
  on public.wins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
