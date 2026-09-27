-- Momentumm — Clubes: a comunidade com dono, membros e ranking.
--
-- O produto já tinha as duas pontas do social: o CÍRCULO (amizade, gente
-- próxima) e o DESAFIO (um combinado com prazo e meta). Faltava o meio — um
-- lugar que dura mais que um desafio e reúne mais gente que um círculo. É o
-- clube.
--
-- ## O que o clube é, e o que ele não é
--
--   é      um lugar com nome, capa e categoria, onde acontecem desafios e onde
--          existe um ranking do que foi cumprido dentro dele.
--   não é  um feed. Não há post, comentário, curtida nem seguidor aqui. O que
--          o clube mostra de cada pessoa é o que ela JÁ publica por desafio: o
--          número de dias cumpridos. Nada mais atravessa.
--
-- Essa última frase é a regra de privacidade inteira, e ela é estrutural: o
-- ranking do clube é uma soma de `challenge_participants.done_days`, que é um
-- número que a própria pessoa publica ao entrar no desafio. Não existe nesta
-- migration nenhuma política nova que dê a alguém `select` em `tasks`,
-- `habits`, `activities` ou `objectives` de outra pessoa.
--
-- ## Criar é do PRO. Perder o PRO não apaga nada.
--
-- Criar clube exige assinatura. Se ela cair, o clube CONTINUA: os membros
-- continuam dentro, o histórico fica, o ranking segue contando. O que o dono
-- perde é a administração — editar, arquivar, convidar. Apagar comunidade de
-- gente porque um boleto venceu seria destruir o trabalho de terceiros por
-- uma dívida que não é deles.

-- ---------------------------------------------------------------------------
-- quem tem PRO
-- ---------------------------------------------------------------------------

/*
  A assinatura vigente, incluindo a cortesia (0034/0051).

  `security definer` porque isto é consultado em política de OUTRA tabela, e a
  política de `profiles` não deixa ninguém ler o plano alheio — nem deveria. A
  função responde um booleano sobre uma pessoa e nada mais.
*/
create or replace function public.has_pro(person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = person
       and (p.plan = 'pro' or coalesce(p.plan_courtesy_until, '-infinity'::timestamptz) > now())
  );
$$;

revoke all on function public.has_pro(uuid) from public;
revoke all on function public.has_pro(uuid) from anon;
grant execute on function public.has_pro(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- o clube
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.club_privacy as enum ('aberto', 'convite');
exception when duplicate_object then null;
end $$;

create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 3 and 60),
  description text check (description is null or char_length(description) <= 280),
  -- Lista fixa, igual à do domínio. Categoria livre viraria vinte grafias de
  -- "treino" e nenhuma descoberta funcionando.
  category    text not null check (category in (
    'estudo', 'treino', 'leitura', 'meditacao', 'trabalho', 'financas', 'geral'
  )),
  -- Chave de preset visual, as mesmas capas do perfil (0035).
  cover       text not null default 'aurora',
  privacy     public.club_privacy not null default 'convite',
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.clubs is
  'Comunidade com dono, membros e ranking. Criar exige PRO; perder o PRO não apaga.';

create index if not exists clubs_owner_idx on public.clubs (owner_id, created_at desc);
-- A descoberta lê só os abertos e vivos.
create index if not exists clubs_open_idx on public.clubs (privacy, archived_at, created_at desc);

create table if not exists public.club_members (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'membro' check (role in ('dono', 'membro')),
  joined_at timestamptz not null default now(),

  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id, joined_at desc);

/*
  O desafio pode pertencer a um clube.

  Nulo continua sendo o caso comum: desafio entre amigos, sem clube nenhum.
  `on delete set null` porque o desafio é das pessoas que estão nele — se o
  clube for embora, o combinado entre elas não deveria ir junto.
*/
alter table public.challenges
  add column if not exists club_id uuid references public.clubs (id) on delete set null;

create index if not exists challenges_club_idx on public.challenges (club_id, created_at desc);

-- ---------------------------------------------------------------------------
-- quem é de dentro
-- ---------------------------------------------------------------------------

/*
  `security definer` pelo mesmo motivo do `is_challenge_member` da 0011: a
  política de `clubs` consulta `club_members`, que tem RLS própria consultando
  `clubs` de volta. Sem o definer, as duas se chamariam em círculo.

  E, como na 0010: o Supabase concede EXECUTE ao papel `anon` por default
  privileges, direto ao papel, e o `revoke ... from public` não alcança isso.
*/
create or replace function public.is_club_member(club uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.club_members where club_id = club and user_id = person
  );
$$;

revoke all on function public.is_club_member(uuid, uuid) from public;
revoke all on function public.is_club_member(uuid, uuid) from anon;
grant execute on function public.is_club_member(uuid, uuid) to authenticated;

create or replace function public.owns_club(club uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.clubs where id = club and owner_id = person);
$$;

revoke all on function public.owns_club(uuid, uuid) from public;
revoke all on function public.owns_club(uuid, uuid) from anon;
grant execute on function public.owns_club(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;

/*
  Vê quem é de dentro — e quem está procurando, se o clube é aberto.

  Clube de convite não aparece em lista nenhuma: quem não foi chamado não sabe
  que ele existe. É a diferença entre "aberto" e "por convite", e ela precisa
  ser verdade no banco, não na tela.
*/
drop policy if exists "vê o clube de que participa, ou os abertos" on public.clubs;
create policy "vê o clube de que participa, ou os abertos"
  on public.clubs for select
  to authenticated
  using (
    auth.uid() = owner_id
    or public.is_club_member(id, auth.uid())
    or (privacy = 'aberto' and archived_at is null)
  );

-- Sem política de insert: criar passa por `create_club`, que é quem confere a
-- assinatura. Uma porta de escrita direta deixaria qualquer conta criar clube.

/*
  Editar é do dono COM PRO.

  Sem assinatura ele continua dono, continua membro e continua no ranking; o
  que ele não faz é administrar. Nada é apagado, nada é escondido de ninguém.
*/
drop policy if exists "dono com PRO administra o clube" on public.clubs;
create policy "dono com PRO administra o clube"
  on public.clubs for update
  to authenticated
  using (auth.uid() = owner_id and public.has_pro(auth.uid()))
  with check (auth.uid() = owner_id and public.has_pro(auth.uid()));

drop policy if exists "dono com PRO apaga o clube" on public.clubs;
create policy "dono com PRO apaga o clube"
  on public.clubs for delete
  to authenticated
  using (auth.uid() = owner_id and public.has_pro(auth.uid()));

alter table public.club_members enable row level security;

drop policy if exists "vê os membros do clube de que participa" on public.club_members;
create policy "vê os membros do clube de que participa"
  on public.club_members for select
  to authenticated
  using (public.is_club_member(club_id, auth.uid()) or public.owns_club(club_id, auth.uid()));

/*
  Entrar: por conta própria em clube aberto, ou pela mão do dono em qualquer um.

  A pessoa só insere a PRÓPRIA linha, e só em clube aberto e vivo. O dono
  insere a de quem ele convida — e é assim que "por convite" continua sendo por
  convite.
*/
drop policy if exists "entra no clube aberto, ou é colocado pelo dono" on public.club_members;
create policy "entra no clube aberto, ou é colocado pelo dono"
  on public.club_members for insert
  to authenticated
  with check (
    (
      auth.uid() = user_id
      and role = 'membro'
      and exists (
        select 1 from public.clubs c
         where c.id = club_id and c.privacy = 'aberto' and c.archived_at is null
      )
    )
    or (public.owns_club(club_id, auth.uid()) and public.has_pro(auth.uid()))
  );

/*
  Sair é sempre livre, e o dono pode remover alguém.

  Sair não depende de plano nem de permissão de ninguém: obrigar uma pessoa a
  continuar num grupo é a única coisa que este produto nunca vai fazer.
*/
drop policy if exists "sai do clube, ou é removido pelo dono" on public.club_members;
create policy "sai do clube, ou é removido pelo dono"
  on public.club_members for delete
  to authenticated
  using (auth.uid() = user_id or public.owns_club(club_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- criar (só PRO)
-- ---------------------------------------------------------------------------

/*
  Cria o clube e coloca o dono dentro, numa transação só.

  Duas chamadas separadas deixariam, na falha da segunda, um clube sem dono
  dentro — e o dono de fora não aparece no ranking nem nos membros.

  A recusa é uma exceção com código próprio (`P0001` com a mensagem), porque a
  tela precisa distinguir "sem assinatura" de "deu erro" pra mostrar o convite
  ao PRO em vez de um aviso vermelho.
*/
create or replace function public.create_club(
  p_name        text,
  p_description text,
  p_category    text,
  p_cover       text,
  p_privacy     public.club_privacy
)
returns public.clubs
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := auth.uid();
  clube public.clubs;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  if not public.has_pro(quem) then
    raise exception 'criar clube faz parte do Momentumm PRO' using errcode = 'P0001';
  end if;

  insert into public.clubs (owner_id, name, description, category, cover, privacy)
  values (quem, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_category,
          coalesce(nullif(btrim(p_cover), ''), 'aurora'), coalesce(p_privacy, 'convite'))
  returning * into clube;

  insert into public.club_members (club_id, user_id, role)
  values (clube.id, quem, 'dono');

  return clube;
end;
$$;

revoke all on function public.create_club(text, text, text, text, public.club_privacy) from public;
revoke all on function public.create_club(text, text, text, text, public.club_privacy) from anon;
grant execute on function public.create_club(text, text, text, text, public.club_privacy) to authenticated;

-- ---------------------------------------------------------------------------
-- o ranking do clube
-- ---------------------------------------------------------------------------

/*
  Quem cumpriu quanto, dentro deste clube.

  O número é a soma de `done_days` dos desafios DO CLUBE — e `done_days` é o
  que cada pessoa publica por conta própria ao participar. Não há aqui nenhuma
  leitura de hábito, ação ou registro de ninguém: o clube vê o que foi
  publicado pra ele, e nada além.

  Nome e avatar saem daqui junto porque a política de `profiles` não deixa ler
  perfil alheio fechado — e um ranking de uuids não é um ranking. O retorno é
  estreito de propósito: id, nome, avatar e um inteiro.

  Só membros conseguem chamar: a primeira linha recusa qualquer outra pessoa.
*/
create or replace function public.club_ranking(club uuid)
returns table (user_id uuid, name text, avatar_url text, days bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_club_member(club, auth.uid()) or public.owns_club(club, auth.uid())) then
    raise exception 'esse clube não é seu' using errcode = '42501';
  end if;

  return query
    select m.user_id,
           p.name,
           p.avatar_url,
           coalesce(sum(cp.done_days), 0)::bigint as days
      from public.club_members m
      join public.profiles p on p.id = m.user_id
      left join public.challenges c on c.club_id = club and c.archived_at is null
      left join public.challenge_participants cp
             on cp.challenge_id = c.id
            and cp.user_id = m.user_id
            and cp.status = 'ativo'
     where m.club_id = club
     group by m.user_id, p.name, p.avatar_url
     order by days desc, p.name asc;
end;
$$;

revoke all on function public.club_ranking(uuid) from public;
revoke all on function public.club_ranking(uuid) from anon;
grant execute on function public.club_ranking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- os eventos dos clubes
-- ---------------------------------------------------------------------------

create or replace function public.product_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    -- base (0024/0036)
    'session_start', 'feature_view', 'onboarding_completed',
    'objective_created', 'task_created', 'task_completed', 'habit_logged',
    'review_completed', 'momentum_viewed', 'ai_call', 'recovery_started',
    'share_exported', 'record_created', 'cancellation_requested', 'support_opened',
    'plan_limit_hit', 'checkout_started', 'subscription_canceled',
    'trial_started', 'trial_ended', 'reminder_enabled', 'reminder_disabled',

    -- o laço individual
    'primary_action_viewed', 'action_started', 'day_completed',
    'day_adapt_requested', 'day_adapt_completed',
    'recovery_shown', 'recovery_completed',
    'review_started', 'achievement_unlocked',

    -- Juntos (dupla de accountability)
    'pair_invite_created', 'pair_invite_opened', 'pair_invite_accepted',
    'pair_created', 'pair_viewed', 'encouragement_sent', 'encouragement_received',
    'pair_return_started', 'pair_left',

    -- gatilhos de retorno
    'notification_sent', 'notification_opened', 'notification_converted',
    'notification_failed',

    -- a permissão e o aparelho
    'notification_permission_prompted', 'notification_permission_granted',
    'notification_permission_denied', 'push_subscription_created',

    -- instalação do app
    'pwa_install_prompted', 'pwa_installed', 'ios_install_shown',

    -- convite de amigo e o teto social do gratuito (0061)
    'friend_invite_started', 'friend_invite_shared', 'friend_invite_opened',
    'friend_invite_accepted', 'friend_added', 'friend_ranking_viewed',
    'free_friend_limit_reached',

    -- clubes (0062)
    'club_creation_paywall_viewed', 'club_creation_upgrade_clicked',
    'club_created', 'club_joined', 'club_left', 'club_ranking_viewed'
  ];
$$;
