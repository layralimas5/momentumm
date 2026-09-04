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

-- Um objetivo ativo por eixo. É a mesma regra que o onboarding aplica ao pedir
-- uma área só: dois objetivos disputando o mesmo eixo tornam o progresso
-- ambíguo, porque os dois somam das mesmas atividades.
create unique index objectives_one_active_per_axis
  on public.objectives (user_id, axis_slug)
  where archived_at is null;

create index objectives_user_deadline_idx on public.objectives (user_id, deadline);

alter table public.objectives enable row level security;

create policy "usuário gerencia os próprios objetivos"
  on public.objectives for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
