-- Momentumm — o Círculo de amigos.
--
-- A primeira camada social do produto, e ela entra com o freio puxado: amizade
-- combinada dos dois lados, momento privado por padrão, e feed que só mostra o
-- que a pessoa marcou explicitamente. Nada aqui muda o alcance de um dado
-- sozinho.
--
-- ## Amizade, não seguidor
--
-- Uma linha por par, com lado de quem pediu e lado de quem recebeu. Duas linhas
-- espelhadas exigiriam escrever nas duas pra aceitar, e qualquer falha no meio
-- deixaria o par em desacordo consigo mesmo — A achando que são amigos e B não.
--
-- Seguidor seria uma relação de uma via e traria junto tudo que o produto não
-- quer agora: audiência, alcance e a pergunta "quantos me seguem".

create type public.friendship_status as enum ('pendente', 'aceita', 'recusada');

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pendente',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,

  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- Um par, uma linha, independente de quem pediu primeiro. Sem o least/greatest,
-- A→B e B→A seriam duas amizades entre as mesmas duas pessoas, e "somos
-- amigos?" passaria a ter duas respostas possíveis.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

create policy "vê as próprias amizades"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Pedido só nasce em nome de quem está pedindo. Sem o `with check`, alguém
-- poderia inserir uma amizade entre duas outras pessoas.
create policy "envia o próprio pedido"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- Aceitar e recusar é só de quem recebeu. Quem pediu não pode aprovar o próprio
-- pedido — que seria a forma mais óbvia de furar o consentimento dos dois lados.
create policy "responde ao pedido recebido"
  on public.friendships for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

-- Desfazer é dos dois: ninguém fica preso numa amizade.
create policy "desfaz a própria amizade"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ---------------------------------------------------------------------------
-- São amigos?
--
-- `security definer` de propósito. A política de `journey_events` precisa
-- consultar `friendships`, e `friendships` tem RLS própria: sem o definer, a
-- consulta de dentro da política passaria pela política da outra tabela, o que
-- custa caro e abre a porta pra recursão entre as duas. A função é estreita —
-- devolve booleano, não devolve linha — e tem o `search_path` fixado pra não
-- ser sequestrada por um schema plantado na frente.
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.friendships
     where status = 'aceita'
       and ((requester_id = a and addressee_id = b)
         or (requester_id = b and addressee_id = a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Momentos compartilhados com o círculo.
--
-- Política ADICIONAL de leitura. A de 0008 continua valendo pro dono; esta
-- soma o caso do amigo, e só ele: `visibility = 'amigos'` E amizade aceita.
-- 'comunidade' e 'publica' seguem sem leitor nenhum, porque a tela que os
-- justificaria ainda não existe — e alcance que ninguém consegue conferir na
-- interface é alcance que não deveria existir no banco.
-- ---------------------------------------------------------------------------

create policy "amigo lê o que foi compartilhado com o círculo"
  on public.journey_events for select
  using (
    visibility = 'amigos'
    and auth.uid() <> user_id
    and public.are_friends(auth.uid(), user_id)
  );

-- ---------------------------------------------------------------------------
-- Apoio.
--
-- Uma reação só, sem variedade. Curtida com seis emojis vira métrica de
-- popularidade, e popularidade entre amigos que estão tentando mudar de vida é
-- o começo do ranking que este produto recusa. Aqui existe um gesto: "vi, e tô
-- torcendo".
-- ---------------------------------------------------------------------------

create table public.journey_event_supports (
  event_id   uuid not null references public.journey_events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (event_id, user_id)
);

create index journey_event_supports_event_idx on public.journey_event_supports (event_id);

alter table public.journey_event_supports enable row level security;

-- Lê o apoio de um momento que você já teria direito de ver. O `exists` cai na
-- RLS de journey_events, então quem não enxerga o momento não conta os apoios
-- dele.
create policy "vê o apoio dos momentos que já enxerga"
  on public.journey_event_supports for select
  using (
    exists (select 1 from public.journey_events where id = event_id)
  );

create policy "apoia em nome próprio"
  on public.journey_event_supports for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.journey_events where id = event_id)
  );

create policy "desfaz o próprio apoio"
  on public.journey_event_supports for delete
  using (auth.uid() = user_id);
