-- ===========================================================================
-- Momentumm — setup completo do banco, em um arquivo.
--
-- Gerado a partir de supabase/migrations/. As migrations numeradas continuam
-- sendo a fonte da verdade; este arquivo existe só pra colar de uma vez no SQL
-- Editor de um projeto NOVO e vazio.
--
-- NÃO rode isto num banco que já tem dados: ele assume que nenhuma tabela do
-- Momentumm existe ainda. Num banco existente, rode a migration que falta.
--
-- Duas diferenças em relação a rodar as migrations uma a uma, e as duas são
-- porque aqui o banco nasce do zero:
--
--   1. `task_status` já nasce com os cinco estados, em vez de nascer com três
--      e receber os outros dois por `alter type ... add value` — que o SQL
--      Editor recusaria, por rodar tudo dentro de uma transação só.
--   2. A policy "catálogo de eixos é público" nem chega a ser criada, em vez
--      de ser criada e removida depois pela 0006.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0001_core.sql
-- ---------------------------------------------------------------------------

-- Momentumm — núcleo do schema.
-- Uma tabela de atividade pra todos os eixos. Eixo novo = linha em activity_types.
-- RLS ligada em todas as tabelas desde o primeiro commit.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type activity_visibility as enum ('publica', 'seguidores', 'privada');

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  handle              text not null unique,
  name                text not null,
  bio                 text,
  avatar_url          text,
  default_visibility  activity_visibility not null default 'publica',
  created_at          timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_name_length check (char_length(name) between 2 and 60),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 160)
);

-- ---------------------------------------------------------------------------
-- follows (a camada social entra na fase 2, mas a visibilidade já depende dela)
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- activity_types
-- ---------------------------------------------------------------------------

create table public.activity_types (
  slug       text primary key,
  label      text not null,
  verb       text not null,
  unit       text not null check (unit in ('paginas', 'minutos')),
  sort_order smallint not null default 0
);

insert into public.activity_types (slug, label, verb, unit, sort_order) values
  ('leitura',    'Leitura',    'leu',       'paginas', 1),
  ('estudo',     'Estudo',     'estudou',   'minutos', 2),
  ('treino',     'Treino',     'treinou',   'minutos', 3),
  ('meditacao',  'Meditação',  'meditou',   'minutos', 4);

-- ---------------------------------------------------------------------------
-- activities — a unidade única do produto
-- ---------------------------------------------------------------------------

create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type_slug    text not null references public.activity_types (slug),
  value        integer not null check (value > 0 and value <= 100000),
  unit         text not null check (unit in ('paginas', 'minutos')),
  duration_min integer not null check (duration_min >= 0 and duration_min <= 1440),
  note         text check (note is null or char_length(note) <= 280),
  -- Dia LOCAL do usuário, gravado pelo cliente. Streak depende disso; derivar
  -- de occurred_at no servidor jogaria todo mundo pro fuso do banco.
  day          date not null,
  occurred_at  timestamptz not null default now(),
  visibility   activity_visibility not null default 'publica',
  source       text not null default 'manual' check (source in ('manual', 'timer', 'importacao')),
  created_at   timestamptz not null default now()
);

create index activities_user_day_idx on public.activities (user_id, day desc);
create index activities_feed_idx on public.activities (occurred_at desc)
  where visibility <> 'privada';
create index activities_user_type_idx on public.activities (user_id, type_slug, day desc);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type_slug   text not null references public.activity_types (slug),
  target      integer not null check (target > 0 and target <= 100000),
  period      text not null check (period in ('dia', 'semana', 'mes')),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- Uma meta ativa por eixo e período: evita metas concorrentes na mesma tela.
create unique index goals_unique_active_idx
  on public.goals (user_id, type_slug, period)
  where archived_at is null;

create index goals_user_idx on public.goals (user_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.follows        enable row level security;
alter table public.activity_types enable row level security;
alter table public.activities     enable row level security;
alter table public.goals          enable row level security;

-- Perfil é público por natureza (é a página que a pessoa compartilha).
create policy "perfis são legíveis por todos"
  on public.profiles for select
  using (true);

create policy "usuário cria o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "usuário edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A leitura de activity_types é definida na seção da 0004: eixo de fábrica é
-- público, eixo criado é só de quem criou. Uma policy `using (true)` aqui se
-- somaria àquela com OR e vazaria as áreas de todo mundo.

create policy "follows são legíveis por todos"
  on public.follows for select
  using (true);

create policy "usuário gerencia quem ele segue"
  on public.follows for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- Visibilidade da atividade é regra de banco, nunca filtro de front.
create policy "atividade visível conforme a visibilidade escolhida"
  on public.activities for select
  using (
    auth.uid() = user_id
    or visibility = 'publica'
    or (
      visibility = 'seguidores'
      and exists (
        select 1 from public.follows f
        where f.following_id = activities.user_id
          and f.follower_id = auth.uid()
      )
    )
  );

create policy "usuário registra a própria atividade"
  on public.activities for insert
  with check (auth.uid() = user_id);

create policy "usuário edita a própria atividade"
  on public.activities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário apaga a própria atividade"
  on public.activities for delete
  using (auth.uid() = user_id);

-- Meta é privada: número de meta alheia não agrega e expõe demais.
create policy "usuário gerencia as próprias metas"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Perfil criado junto com a conta, pra não existir usuário sem perfil.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix integer := 0;
begin
  base_handle := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if char_length(base_handle) < 3 then
    base_handle := 'momentum' || base_handle;
  end if;
  base_handle := left(base_handle, 16);
  final_handle := base_handle;

  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  end loop;

  insert into public.profiles (id, handle, name)
  values (
    new.id,
    final_handle,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), initcap(base_handle))
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 0002_planner.sql
-- ---------------------------------------------------------------------------

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
-- Já com os estados do V1: num banco novo não há por que criar com três
-- e alterar depois.
create type task_status as enum ('pendente', 'em-andamento', 'feita', 'adiada', 'cancelada');

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


-- ---------------------------------------------------------------------------
-- 0003_objectives.sql
-- ---------------------------------------------------------------------------

-- Momentumm — objetivos com prazo.
--
-- A meta (`goals`) é um ritmo que se repete e não termina. O objetivo TERMINA:
-- tem alvo acumulado e uma data em que fecha. É dele que sai o plano, e é por
-- isso que ele mora numa tabela própria em vez de virar mais uma coluna em
-- `goals` — período e prazo são conceitos diferentes e misturá-los quebraria a
-- conta dos dois lados.
--
-- O progresso NÃO tem tabela de vínculo: ele é somado das `activities` do eixo
-- dentro da janela do objetivo. Continua valendo a regra de ouro do produto —
-- a atividade é a unidade única, e registrar leitura empurra o objetivo de
-- leitura tenha ela vindo de hábito, ação, cronômetro ou registro solto.

create table public.objectives (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 80),
  axis_slug    text not null references public.activity_types (slug),
  motive       text check (motive is null or char_length(motive) <= 140),
  target       integer not null check (target > 0 and target <= 1000000),
  started_on   date not null,
  deadline     date not null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  archived_at  timestamptz,
  constraint objectives_deadline_after_start check (deadline > started_on)
);

-- Quantos objetivos cabem no mesmo eixo é o PLANO que diz, e a regra mora no
-- trigger `objectives_plan_room` (0057). Aqui fica só o índice de LEITURA: este
-- arquivo para na 0007, e recriar o índice único de 0003 devolveria a limitação
-- que a 0057 tirou — num banco que já roda, e sem ninguém perceber.
create index if not exists objectives_active_user_axis_idx
  on public.objectives (user_id, axis_slug)
  where archived_at is null;

create index objectives_user_deadline_idx on public.objectives (user_id, deadline);

alter table public.objectives enable row level security;

create policy "usuário gerencia os próprios objetivos"
  on public.objectives for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 0004_custom_axes.sql
-- ---------------------------------------------------------------------------

-- Momentumm — áreas criadas pela pessoa.
--
-- A regra de arquitetura do produto sempre foi "eixo novo é uma linha em
-- activity_types, nunca um módulo novo". Esta migration só cobra essa promessa:
-- a tabela passa a aceitar linhas de dono, e tudo que já lê de activity_types
-- (atividade, hábito, meta, objetivo, streak, review) funciona na área nova sem
-- uma linha de código a mais.
--
-- `user_id` nulo continua sendo eixo de fábrica, visível pra todo mundo.

alter table public.activity_types
  add column user_id uuid references public.profiles (id) on delete cascade,
  add column color text;

-- O slug é a chave primária e precisa continuar único no geral: dois donos com
-- uma área "escrita" cada um teriam o mesmo slug e as FKs não saberiam separar.
-- Por isso o slug de área criada nasce prefixado com o dono no repositório.
create index activity_types_user_idx on public.activity_types (user_id);

alter table public.activity_types enable row level security;

-- Eixo de fábrica é público; o criado é só de quem criou.
create policy "todos leem os eixos de fábrica e os próprios"
  on public.activity_types for select
  using (user_id is null or auth.uid() = user_id);

create policy "usuário cria os próprios eixos"
  on public.activity_types for insert
  with check (auth.uid() = user_id);

create policy "usuário gerencia os próprios eixos"
  on public.activity_types for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário apaga os próprios eixos"
  on public.activity_types for delete
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 0005_v1_modules.sql
-- ---------------------------------------------------------------------------

-- Momentumm — os módulos do V1.
--
-- Tudo aqui é aditivo. Nenhuma coluna é removida ou renomeada e nenhum dado é
-- reescrito com perda: quem já tem objetivo, hábito e ação criados continua com
-- os mesmos registros, agora com campos a mais. Os defaults foram escolhidos
-- pra que a linha antiga signifique exatamente o que ela já significava.
--
-- A mudança estrutural é uma só: `objective_id` em `habits` e `tasks`. É o que
-- transforma sete telas independentes no ciclo do produto — sem ele, o `Hoje`
-- não consegue responder "pra que serve essa ação".

-- ---------------------------------------------------------------------------
-- Prioridade: uma escala só pra objetivo, hábito e ação.
-- ---------------------------------------------------------------------------
create type public.priority as enum ('baixa', 'media', 'alta');

-- ---------------------------------------------------------------------------
-- Objetivos: descrição, prioridade e pausa.
-- ---------------------------------------------------------------------------
alter table public.objectives
  add column description text check (description is null or char_length(description) <= 400),
  add column priority    public.priority not null default 'media',
  -- Pausar é diferente de arquivar: o objetivo continua na lista e no histórico,
  -- só para de cobrar o dia. Sem isso a única saída pra suspender é apagar.
  add column paused_at   timestamptz;

-- O índice de "um ativo por eixo" precisa continuar valendo pro pausado: dois
-- objetivos de leitura somam das mesmas atividades mesmo com um deles parado.
-- Por isso o índice de 0003 (archived_at is null) fica como está.

-- ---------------------------------------------------------------------------
-- Hábitos: frequência flexível, vínculo com objetivo, horário e pausa.
-- ---------------------------------------------------------------------------
create type public.habit_frequency as enum ('diario', 'dias-semana', 'vezes-semana');

alter table public.habits
  add column description   text check (description is null or char_length(description) <= 240),
  add column objective_id  uuid references public.objectives (id) on delete set null,
  add column priority      public.priority not null default 'media',
  add column frequency     public.habit_frequency,
  add column time_of_day   text check (time_of_day is null or time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column times_per_week smallint not null default 7 check (times_per_week between 1 and 7),
  add column paused_at     timestamptz;

-- Hábito que já existia: com dias marcados vira "dias específicos", sem dias
-- marcados vira diário. É a mesma inferência que o domínio faz ao ler uma
-- linha sem a coluna, e as duas precisam concordar.
update public.habits
   set frequency = case
                     when weekdays is not null and array_length(weekdays, 1) > 0
                       then 'dias-semana'::public.habit_frequency
                     else 'diario'::public.habit_frequency
                   end
 where frequency is null;

alter table public.habits alter column frequency set not null;
alter table public.habits alter column frequency set default 'diario';

create index habits_objective_idx on public.habits (objective_id) where objective_id is not null;

-- ---------------------------------------------------------------------------
-- Ações: descrição, objetivo, prioridade, horário, ordem e dependência.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column description   text check (description is null or char_length(description) <= 400),
  add column objective_id  uuid references public.objectives (id) on delete set null,
  add column priority      public.priority not null default 'media',
  add column time_of_day   text check (time_of_day is null or time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column sort_order    integer not null default 0,
  -- `on delete set null`: apagar a ação anterior não pode travar a seguinte pra
  -- sempre, com a tela mostrando "bloqueada" sem nada que explique o motivo.
  add column depends_on_id uuid references public.tasks (id) on delete set null;

alter table public.tasks
  add constraint tasks_no_self_dependency check (depends_on_id is null or depends_on_id <> id);

create index tasks_objective_order_idx on public.tasks (objective_id, sort_order)
  where objective_id is not null;

-- Os estados novos da ação já entraram na criação do enum, acima.

-- ---------------------------------------------------------------------------
-- Review semanal escrito.
--
-- A leitura que o app FAZ da semana é calculada e nunca guardada. Esta tabela
-- guarda o que a PESSOA escreve — e ela existe porque review pela metade é o
-- caso comum: sem rascunho persistido, quem fecha o app no meio recomeça do
-- zero e nunca termina nenhum.
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- Segunda-feira da semana revisada. É a chave junto com o usuário.
  week_start   date not null,
  achievements text check (achievements is null or char_length(achievements) <= 600),
  difficulties text check (difficulties is null or char_length(difficulties) <= 600),
  learnings    text check (learnings is null or char_length(learnings) <= 600),
  adjustments  text check (adjustments is null or char_length(adjustments) <= 600),
  priorities   text[] not null default '{}' check (array_length(priorities, 1) is null or array_length(priorities, 1) <= 3),
  ai_summary   text,
  last_step    text not null default 'resumo',
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint weekly_reviews_one_per_week unique (user_id, week_start)
);

create index weekly_reviews_user_week_idx on public.weekly_reviews (user_id, week_start desc);

alter table public.weekly_reviews enable row level security;

create policy "usuário gerencia os próprios reviews"
  on public.weekly_reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 0006_fix_axis_visibility.sql
-- ---------------------------------------------------------------------------

-- A 0006 remove a policy "catálogo de eixos é público", que num banco novo
-- nem chega a ser criada por este arquivo. Nada a fazer aqui.


