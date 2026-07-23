-- Aura — Conclusões de Missão diária, com RLS por usuária.
-- O conteúdo da missão é derivado do dia no app (determinístico), então só a
-- conclusão precisa persistir: uma linha por dia concluído. Aplicar depois do 0001_init.sql.

-- ─────────────────────────────────────────────────────────────
-- Tabela: mission_completions (um dia de missão concluído por linha)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.mission_completions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  done_on    date not null,
  created_at timestamptz not null default now(),
  unique (user_id, done_on)
);

create index if not exists mission_completions_user_id_idx
  on public.mission_completions (user_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — cada usuária só enxerga e mexe no que é seu
-- ─────────────────────────────────────────────────────────────
alter table public.mission_completions enable row level security;

drop policy if exists "mission_completions_select_own" on public.mission_completions;
create policy "mission_completions_select_own" on public.mission_completions
  for select using (auth.uid() = user_id);

drop policy if exists "mission_completions_insert_own" on public.mission_completions;
create policy "mission_completions_insert_own" on public.mission_completions
  for insert with check (auth.uid() = user_id);

drop policy if exists "mission_completions_delete_own" on public.mission_completions;
create policy "mission_completions_delete_own" on public.mission_completions
  for delete using (auth.uid() = user_id);
