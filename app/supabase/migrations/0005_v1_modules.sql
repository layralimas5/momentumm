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

-- Os estados novos da ação. O enum antigo tinha pendente, feita e adiada.
alter type public.task_status add value if not exists 'em-andamento';
alter type public.task_status add value if not exists 'cancelada';

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
