-- Aura — Hábitos (com histórico) e Diário, com RLS por usuária.
-- Aplicar depois do 0001_init.sql. Multi-tenant seguro: cada linha pertence a
-- auth.uid(); a RLS isola por usuária.

-- ─────────────────────────────────────────────────────────────
-- Tabela: habits (hábitos da rotina)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  emoji          text not null default '✨',
  title          text not null check (char_length(trim(title)) between 2 and 80),
  scheduled_time text,
  created_at     timestamptz not null default now()
);

create index if not exists habits_user_id_created_at_idx
  on public.habits (user_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Tabela: habit_logs (histórico — um dia concluído por linha)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  done_on    date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, done_on)
);

create index if not exists habit_logs_user_id_idx on public.habit_logs (user_id);
create index if not exists habit_logs_habit_id_idx on public.habit_logs (habit_id);

-- ─────────────────────────────────────────────────────────────
-- Tabela: diary_entries (diário)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.diary_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists diary_entries_user_id_created_at_idx
  on public.diary_entries (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — cada usuária só enxerga e mexe no que é seu
-- ─────────────────────────────────────────────────────────────
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.diary_entries enable row level security;

-- habits
drop policy if exists "habits_select_own" on public.habits;
create policy "habits_select_own" on public.habits
  for select using (auth.uid() = user_id);

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
  for insert with check (auth.uid() = user_id);

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habits_delete_own" on public.habits;
create policy "habits_delete_own" on public.habits
  for delete using (auth.uid() = user_id);

-- habit_logs
drop policy if exists "habit_logs_select_own" on public.habit_logs;
create policy "habit_logs_select_own" on public.habit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "habit_logs_insert_own" on public.habit_logs;
create policy "habit_logs_insert_own" on public.habit_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "habit_logs_delete_own" on public.habit_logs;
create policy "habit_logs_delete_own" on public.habit_logs
  for delete using (auth.uid() = user_id);

-- diary_entries
drop policy if exists "diary_select_own" on public.diary_entries;
create policy "diary_select_own" on public.diary_entries
  for select using (auth.uid() = user_id);

drop policy if exists "diary_insert_own" on public.diary_entries;
create policy "diary_insert_own" on public.diary_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "diary_update_own" on public.diary_entries;
create policy "diary_update_own" on public.diary_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "diary_delete_own" on public.diary_entries;
create policy "diary_delete_own" on public.diary_entries
  for delete using (auth.uid() = user_id);
