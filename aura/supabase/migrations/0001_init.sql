-- Aura — schema inicial (Metas e Leituras) com RLS por usuária.
-- Aplicar no Supabase: SQL Editor > cole e rode, ou via CLI:
--   supabase db push
-- Multi-tenant seguro: cada linha pertence a auth.uid(); RLS isola por usuária.

-- ─────────────────────────────────────────────────────────────
-- Extensões
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'goal_status') then
    create type goal_status as enum ('active', 'completed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'reading_status') then
    create type reading_status as enum ('to_read', 'reading', 'read');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Tabela: goals (metas)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 2 and 120),
  description text,
  progress    integer not null default 0 check (progress between 0 and 100),
  status      goal_status not null default 'active',
  due_date    date,
  created_at  timestamptz not null default now()
);

create index if not exists goals_user_id_created_at_idx
  on public.goals (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Tabela: books (leituras)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 200),
  author      text,
  status      reading_status not null default 'to_read',
  progress    integer not null default 0 check (progress between 0 and 100),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists books_user_id_created_at_idx
  on public.books (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — cada usuária só enxerga e mexe no que é seu
-- ─────────────────────────────────────────────────────────────
alter table public.goals enable row level security;
alter table public.books enable row level security;

-- goals
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- books
drop policy if exists "books_select_own" on public.books;
create policy "books_select_own" on public.books
  for select using (auth.uid() = user_id);

drop policy if exists "books_insert_own" on public.books;
create policy "books_insert_own" on public.books
  for insert with check (auth.uid() = user_id);

drop policy if exists "books_update_own" on public.books;
create policy "books_update_own" on public.books
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "books_delete_own" on public.books;
create policy "books_delete_own" on public.books
  for delete using (auth.uid() = user_id);
