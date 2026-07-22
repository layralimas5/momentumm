-- Aura — Identidade Futura (a alma do produto), com RLS por usuária.
-- Uma identidade por usuária (1:1, PK = user_id). Aplicar depois do 0001_init.sql.

-- ─────────────────────────────────────────────────────────────
-- Tabela: identities (a mulher que a usuária decidiu se tornar)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.identities (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  becoming    text not null check (char_length(trim(becoming)) > 0),
  morning     text not null check (char_length(trim(morning)) > 0),
  dressing    text not null check (char_length(trim(dressing)) > 0),
  daily       text not null check (char_length(trim(daily)) > 0),
  never_again text not null check (char_length(trim(never_again)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — cada usuária só enxerga e mexe na própria identidade
-- ─────────────────────────────────────────────────────────────
alter table public.identities enable row level security;

drop policy if exists "identities_select_own" on public.identities;
create policy "identities_select_own" on public.identities
  for select using (auth.uid() = user_id);

drop policy if exists "identities_insert_own" on public.identities;
create policy "identities_insert_own" on public.identities
  for insert with check (auth.uid() = user_id);

drop policy if exists "identities_update_own" on public.identities;
create policy "identities_update_own" on public.identities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
