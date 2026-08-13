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

create policy "catálogo de eixos é público"
  on public.activity_types for select
  using (true);

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
