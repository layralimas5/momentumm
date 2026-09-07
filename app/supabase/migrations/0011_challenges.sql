-- Momentumm — desafios entre amigos.
--
-- A segunda camada social, e ela herda o freio da primeira: desafio é privado
-- por definição, o convite sai só do dono e só para quem já é amigo dele no
-- Círculo. Não existe desafio público, descoberta, comunidade nem ranking fora
-- do próprio desafio.
--
-- ## O desafio não guarda progresso por dia
--
-- Quem move o progresso continua sendo `activities` (ou o hábito que a pessoa
-- vinculou). Uma tabela de "dia cumprido no desafio" seria uma segunda verdade
-- sobre o mesmo dia, e as duas divergiriam na primeira vez que alguém apagasse
-- um registro.
--
-- O que ESTA migration guarda é `done_days`: um inteiro por participante, o
-- único número que atravessa a fronteira entre duas pessoas. Ele existe porque
-- o progresso de alguém é calculado a partir de hábitos e atividades que a RLS
-- não deixa mais ninguém ler — e nem deveria. Entrar num desafio é consentir em
-- mostrar quantos dias você fechou nele. Nada além.
--
-- Quem escreve `done_days` é sempre o dono da linha, e a política garante isso.

create type public.challenge_mode as enum ('diaria', 'semanal', 'total');

create type public.challenge_participant_status as enum (
  'convidado',
  'ativo',
  'recusado',
  'saiu'
);

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 3 and 60),
  description text check (description is null or char_length(description) <= 280),
  -- Texto, e não FK: o eixo pode ser um dos de fábrica ou um criado pela
  -- pessoa, exatamente como em `activities`.
  axis        text not null,
  mode        public.challenge_mode not null,
  -- A meta do modo: dias por semana em 'semanal', dias no total em 'total'.
  -- Em 'diaria' guarda a janela inteira, pra leitura não precisar recalcular.
  target       integer not null check (target > 0),
  -- Quanto fecha um dia, na unidade do eixo. Ignorado por quem vinculou hábito.
  daily_target integer not null default 1 check (daily_target > 0),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  completed_at timestamptz,
  archived_at  timestamptz,

  constraint challenges_window check (ends_on >= starts_on)
);

create index challenges_owner_idx on public.challenges (owner_id, created_at desc);

create table public.challenge_participants (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       public.challenge_participant_status not null default 'convidado',
  -- Escolha de cada um e válida só pra ele: o desafio combina O QUE cumprir,
  -- não com qual hábito cada pessoa cumpre.
  habit_id     uuid references public.habits (id) on delete set null,
  done_days    integer not null default 0 check (done_days >= 0),
  invited_at   timestamptz not null default now(),
  joined_at    timestamptz,
  completed_at timestamptz,

  -- Uma pessoa, uma linha por desafio. Sem isso, convidar duas vezes criaria
  -- dois lugares publicando progressos diferentes da mesma pessoa.
  unique (challenge_id, user_id)
);

create index challenge_participants_user_idx
  on public.challenge_participants (user_id, status);
create index challenge_participants_challenge_idx
  on public.challenge_participants (challenge_id);

-- ---------------------------------------------------------------------------
-- Sou desse desafio?
--
-- `security definer` pelo mesmo motivo do `are_friends` da 0009: a política de
-- `challenges` precisa consultar `challenge_participants`, que tem RLS própria
-- consultando `challenges` de volta. Sem o definer, as duas se chamariam em
-- círculo.
--
-- E como aprendemos na 0010, o Supabase concede EXECUTE ao papel `anon` por
-- DEFAULT PRIVILEGES, direto ao papel — o `revoke ... from public` não alcança.
-- Toda função `security definer` deste projeto precisa do revoke explícito.
-- ---------------------------------------------------------------------------

create or replace function public.is_challenge_member(challenge uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.challenge_participants
     where challenge_id = challenge
       and user_id = person
       and status in ('convidado', 'ativo')
  );
$$;

revoke execute on function public.is_challenge_member(uuid, uuid) from anon;
revoke execute on function public.is_challenge_member(uuid, uuid) from public;
grant execute on function public.is_challenge_member(uuid, uuid) to authenticated;

create or replace function public.owns_challenge(challenge uuid, person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges where id = challenge and owner_id = person
  );
$$;

revoke execute on function public.owns_challenge(uuid, uuid) from anon;
revoke execute on function public.owns_challenge(uuid, uuid) from public;
grant execute on function public.owns_challenge(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS dos desafios
-- ---------------------------------------------------------------------------

alter table public.challenges enable row level security;

-- Lê quem é dono ou foi convidado. Não existe listagem de desafio alheio, nem
-- marcado como concluído: privado aqui é privado mesmo.
create policy "vê os desafios de que participa"
  on public.challenges for select
  using (
    auth.uid() = owner_id
    or public.is_challenge_member(id, auth.uid())
  );

create policy "cria o próprio desafio"
  on public.challenges for insert
  with check (auth.uid() = owner_id);

-- Editar e encerrar é só do dono. Participante que pudesse encerrar fecharia o
-- desafio do outro no meio.
create policy "dono edita o desafio"
  on public.challenges for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dono apaga o desafio"
  on public.challenges for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- RLS das participações
-- ---------------------------------------------------------------------------

alter table public.challenge_participants enable row level security;

-- Quem está no desafio vê os outros. É o que sustenta a lista de participantes
-- e o ranking interno — e é a ÚNICA porta pelo `done_days` de outra pessoa.
create policy "vê quem está no mesmo desafio"
  on public.challenge_participants for select
  using (
    auth.uid() = user_id
    or public.is_challenge_member(challenge_id, auth.uid())
    or public.owns_challenge(challenge_id, auth.uid())
  );

/*
  Convidar é do dono, e só amigo.

  As duas condições andam juntas de propósito. Sem a primeira, um participante
  poderia encher o desafio de gente que o dono nunca chamou. Sem a segunda, o
  convite viraria a porta dos fundos do Círculo: qualquer pessoa mandaria
  convite pra qualquer id de perfil e o produto ganharia mensagem não
  solicitada — que é exatamente o que a amizade de dois lados existe pra
  impedir.

  O dono entrando em si mesmo é o caso da criação, e passa pelo mesmo teto.
*/
create policy "dono convida amigo"
  on public.challenge_participants for insert
  with check (
    public.owns_challenge(challenge_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.are_friends(auth.uid(), user_id)
    )
  );

/*
  A linha é de quem ela descreve.

  Aceitar, recusar, sair, vincular hábito e publicar dias fechados são tudo a
  mesma escrita: a pessoa mexendo na própria participação. O dono NÃO entra
  aqui — ele convida e encerra o desafio, mas não responde por ninguém nem
  publica progresso de outro.
*/
create policy "cuida da própria participação"
  on public.challenge_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- O dono retira um convite; a pessoa apaga a própria linha.
create policy "remove a própria participação"
  on public.challenge_participants for delete
  using (
    auth.uid() = user_id
    or public.owns_challenge(challenge_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Carimbo da entrada
--
-- A hora de entrar é do servidor, não do aparelho: ela vai ser lida por outra
-- pessoa, e relógio de cliente é a única data do produto que alguém consegue
-- mexer. A conclusão continua vindo explícita de quem publica o número — ela é
-- uma DECISÃO sobre o progresso, não um efeito de escrever na linha.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_challenge_participation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ativo' and new.joined_at is null then
    new.joined_at := now();
  end if;

  return new;
end;
$$;

create trigger challenge_participants_stamp
  before insert or update on public.challenge_participants
  for each row execute function public.stamp_challenge_participation();

-- ---------------------------------------------------------------------------
-- Os momentos que o desafio gera.
--
-- Aditivo aos enums da 0008: entrar, avançar, cruzar um marco e concluir são
-- eventos como qualquer outro — nascem privados e só viram assunto no Círculo
-- se a pessoa marcar. Nada aqui promove visibilidade sozinho.
--
-- Os valores são adicionados e NÃO usados nesta migration. É a condição que o
-- Postgres impõe pra `add value` conviver com a transação em que o CLI roda as
-- migrations: o valor novo só fica visível para consultas depois do commit.
-- ---------------------------------------------------------------------------

alter type public.journey_event_type add value if not exists 'challenge_joined';
alter type public.journey_event_type add value if not exists 'challenge_progress';
alter type public.journey_event_type add value if not exists 'challenge_milestone';
alter type public.journey_event_type add value if not exists 'challenge_completed';

alter type public.journey_event_source add value if not exists 'challenge';
