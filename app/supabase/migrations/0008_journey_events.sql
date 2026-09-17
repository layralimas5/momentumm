-- Momentumm — a camada de momentos da jornada.
--
-- O produto já registra ESFORÇO (`activities`: leu 32 páginas, treinou 45
-- minutos). O que faltava era registrar RESULTADO: o dia que fechou, a rotina
-- que saiu inteira, o objetivo concluído, o momentum recorde, a retomada
-- depois de uma semana parada.
--
-- São coisas diferentes e por isso são tabelas diferentes. Esforço é
-- matéria-prima, entra várias vezes por dia e alimenta streak, meta e
-- histórico. Momento é resultado, é raro, e é o que um feed mostraria. Enfiar
-- os dois na mesma tabela obrigaria toda leitura de streak a filtrar eventos
-- que não são esforço, e todo feed a filtrar registros que não são notícia.
--
-- ## Por que ela nasce antes de existir feed
--
-- Porque o Share Studio é o primeiro consumidor, e o segundo (feed de amigos),
-- o terceiro (perfil) e o quarto (comunidade) leem exatamente o mesmo formato.
-- Criar a tabela depois significaria backfill de eventos que ninguém guardou.
--
-- ## Privado por padrão
--
-- `visibility` já tem os quatro degraus, mas o DEFAULT é 'privada' e a RLS
-- desta migration só permite ler o que é seu. Adicionar valor a enum depois é
-- barato; descobrir que mil linhas nasceram públicas não é.

create type public.journey_event_type as enum (
  'habit_completed',
  'routine_completed',
  'day_completed',
  'goal_progress',
  'goal_completed',
  'milestone',
  'weekly_review',
  'comeback',
  'momentum_record'
);

create type public.journey_event_source as enum (
  'habit',
  'routine',
  'day',
  'objective',
  'week',
  'momentum',
  'streak'
);

create type public.journey_visibility as enum (
  'privada',
  'amigos',
  'comunidade',
  'publica'
);

create table public.journey_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.journey_event_type not null,
  source_type public.journey_event_source not null,
  -- Texto, não FK: a origem pode ser um uuid de objetivo, uma DayKey
  -- ('2026-09-07') ou 'dia:parte-do-dia'. Uma FK por origem possível traria de
  -- volta a tabela por módulo que a arquitetura do Momentumm recusa.
  source_id   text,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 400),

  -- Progresso do objetivo, 0 a 1.
  progress_before numeric(4, 3) check (progress_before between 0 and 1),
  progress_after  numeric(4, 3) check (progress_after between 0 and 1),

  -- Momentum, 0 a 100. A VARIAÇÃO não é guardada: ela é derivada dos dois
  -- lados. Guardar abriria a porta pra uma linha dizendo "+6" com 76 → 81 na
  -- coluna ao lado, e o card mostraria a contradição em tamanho grande.
  momentum_before smallint check (momentum_before between 0 and 100),
  momentum_after  smallint check (momentum_after between 0 and 100),

  duration_min          integer check (duration_min >= 0),
  completion_percentage numeric(4, 3) check (completion_percentage between 0 and 1),

  -- Campos opcionais nomeados do lado do domínio (itens da rotina, eixo,
  -- dias parados, contagem do marco). Fica em jsonb porque a forma varia por
  -- tipo de evento e uma coluna por variante deixaria a tabela 80% nula.
  metadata   jsonb not null default '{}'::jsonb,

  visibility public.journey_visibility not null default 'privada',
  -- Dia no calendário LOCAL de quem registrou, igual ao resto do app.
  day        date not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index journey_events_user_day_idx
  on public.journey_events (user_id, day desc);

-- Deduplicação: o último hábito do dia pode ser desmarcado e remarcado várias
-- vezes, e cada clique tentaria gravar "dia concluído" de novo. O índice torna
-- a segunda gravação um UPDATE em vez de uma linha nova.
--
-- O índice é TOTAL, não parcial (`where source_id is not null`), por dois
-- motivos. O primeiro é comportamental e vem de graça: no Postgres, NULLs são
-- distintos entre si por padrão, então evento sem origem continua nunca
-- colidindo com outro — que é exatamente o que um índice parcial daria.
--
-- O segundo é o que obriga: `ON CONFLICT (colunas)` só consegue inferir um
-- índice PARCIAL se a instrução repetir o predicado dele, e o `upsert` do
-- supabase-js manda apenas a lista de colunas. Com o índice parcial, toda
-- gravação de momento morreria com "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification" — e só contra o Supabase de verdade,
-- porque o modo demo deduplica em JavaScript e nunca veria o erro.
create unique index journey_events_dedupe_idx
  on public.journey_events (user_id, type, source_id, day);

alter table public.journey_events enable row level security;

-- Uma política só, e restritiva: nesta versão ninguém lê o momento de outra
-- pessoa, nem quando ele está marcado 'publica'. Quando o feed existir, entra
-- uma política de SELECT adicional lendo visibility e a tabela de amizades —
-- e ela precisa ser escrita junto com o feed, não adiantada aqui às cegas.
create policy "usuário gerencia os próprios momentos"
  on public.journey_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Momento concluído tem data de conclusão: sem o carimbo o feed futuro não
-- consegue ordenar por quando aconteceu, só por quando foi gravado — e os dois
-- divergem sempre que a gravação vem de um recálculo.
create or replace function public.stamp_journey_event_completion()
returns trigger
language plpgsql
as $$
begin
  if new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger journey_events_stamp_completion
  before insert or update on public.journey_events
  for each row execute function public.stamp_journey_event_completion();
