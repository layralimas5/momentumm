-- Aura — perfis, papéis e status de assinatura (gating de acesso + admin).
-- Aplicar depois do 0001_init.sql.

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    -- pending: conta criada, sem acesso · active: pagante · canceled/blocked: sem acesso
    create type subscription_status as enum ('pending', 'active', 'canceled', 'blocked');
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Tabela: profiles (1:1 com auth.users)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  role                user_role not null default 'user',
  subscription_status subscription_status not null default 'pending',
  plan                text,
  created_at          timestamptz not null default now()
);

create index if not exists profiles_status_idx on public.profiles (subscription_status);

-- ─────────────────────────────────────────────────────────────
-- is_admin(): checa papel sem recursão de RLS (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS: usuária lê o próprio perfil; admin lê e edita todos
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

-- Só admin altera status/papel de qualquer conta.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Cria o perfil automaticamente a cada novo cadastro
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Bootstrap: promova a SUA conta a admin + ativa (troque o e-mail).
-- Rode depois de criar sua conta em /criar-conta.
-- ─────────────────────────────────────────────────────────────
-- update public.profiles
--   set role = 'admin', subscription_status = 'active'
--   where email = 'seu-email@exemplo.com';
