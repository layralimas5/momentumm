-- Momentumm — Juntos: a dupla de accountability.
--
-- O MVP social do produto, e ele entra menor do que o Círculo (0009) de
-- propósito: DUAS pessoas, sem feed, sem comentário, sem descoberta, sem
-- ranking. A pergunta que este código existe pra responder é uma só — ter
-- alguém acompanhando melhora a retenção? — e tudo que não ajuda a responder
-- isso ficou de fora.
--
-- ## Por que não reaproveitar `friendships`
--
-- `friendships` é uma rede: N amigos, pedido por handle, quem descobre quem.
-- A dupla é outra coisa: UMA por pessoa, só por convite com link, e com um
-- estado próprio (desde quando, quantos dias em movimento juntas). Empilhar
-- os dois conceitos na mesma tabela faria "somos amigos" e "somos dupla"
-- terem a mesma resposta, e o dia em que um deles mudar de regra o outro
-- muda junto sem ninguém pedir.
--
-- O que É reaproveitado: `profiles` (nome e avatar), `user_presence` (o fuso
-- de cada um, pra "hoje" ser o hoje DELA), `tasks` e `habit_logs` (o avanço),
-- `product_events` (os eventos) e o mesmo desenho de RLS do resto do schema.
--
-- ## A regra de privacidade, em uma frase
--
-- O par vê QUE a outra pessoa avançou, nunca EM QUÊ.
--
-- Isso não é uma decisão de tela: não existe nenhuma política nesta migration
-- que dê a alguém `select` em `tasks`, `habits`, `objectives` ou `journey_events`
-- de outra pessoa. O status do par sai de UMA função `security definer`
-- (`pair_overview`) que devolve booleanos e contagens — nada que carregue
-- texto escrito por alguém. Conhecer o uuid do par não abre nada.

-- ---------------------------------------------------------------------------
-- convites
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.pair_invite_status as enum ('pendente', 'aceito', 'recusado', 'expirado', 'cancelado');
exception when duplicate_object then null;
end $$;

/*
  O token do link NÃO é guardado.

  A tabela guarda o hash sha256 dele. Um vazamento de banco (backup, dump,
  consulta de suporte) entregaria o link de convite de todo mundo se o token
  estivesse aqui em claro — e link de convite é credencial: quem tem, entra.
*/
create table if not exists public.pair_invites (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid not null references public.profiles (id) on delete cascade,
  token_hash   text not null unique,
  status       public.pair_invite_status not null default 'pendente',
  /* Quem aceitou. Null enquanto ninguém aceitou. */
  invitee_id   uuid references public.profiles (id) on delete set null,
  pair_id      uuid,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  responded_at timestamptz,

  constraint pair_invites_token_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint pair_invites_not_self check (invitee_id is null or invitee_id <> inviter_id)
);

comment on table public.pair_invites is
  'Convites de dupla. Guarda o hash do token, nunca o token. Uso único.';

create index if not exists pair_invites_inviter_idx on public.pair_invites (inviter_id, status);

alter table public.pair_invites enable row level security;

/*
  Quem convidou vê os próprios convites — e mais ninguém vê nada.

  Não existe política de select pra quem RECEBE: o convite é resgatado pelo
  token, por função. Sem isso, alguém poderia varrer a tabela procurando
  convites em aberto.
*/
drop policy if exists "vê os convites que enviou" on public.pair_invites;
create policy "vê os convites que enviou"
  on public.pair_invites for select
  to authenticated
  using (auth.uid() = inviter_id);

-- Sem política de insert/update/delete: tudo passa pelas funções abaixo.

-- ---------------------------------------------------------------------------
-- a dupla
-- ---------------------------------------------------------------------------

create table if not exists public.accountability_pairs (
  id         uuid primary key default gen_random_uuid(),
  invite_id  uuid references public.pair_invites (id) on delete set null,
  created_at timestamptz not null default now(),
  /* A dupla desfeita continua existindo: o histórico dela não some junto. */
  ended_at   timestamptz,
  ended_by   uuid references public.profiles (id) on delete set null
);

comment on table public.accountability_pairs is
  'Uma dupla de accountability. Duas pessoas, sem grupo e sem dono.';

alter table public.accountability_pairs enable row level security;

create table if not exists public.pair_members (
  pair_id   uuid not null references public.accountability_pairs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,

  primary key (pair_id, user_id)
);

comment on table public.pair_members is
  'Quem está em qual dupla. Uma dupla ativa por pessoa (índice parcial abaixo).';

/*
  Uma dupla ativa por pessoa.

  O índice parcial é a regra, não uma checagem no app: duas duplas simultâneas
  transformariam o "Juntos" num grupo pela porta dos fundos, e a tela inteira
  foi desenhada pra duas pessoas.
*/
create unique index if not exists pair_members_one_active_idx
  on public.pair_members (user_id) where left_at is null;

create index if not exists pair_members_pair_idx on public.pair_members (pair_id) where left_at is null;

alter table public.pair_members enable row level security;

/*
  "Somos da mesma dupla?" — em `security definer` pelo mesmo motivo de
  `are_friends` (0009): a política de `pair_members` precisa consultar
  `pair_members`, e sem o definer isso é recursão.
*/
create or replace function public.in_same_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.pair_members ma
      join public.pair_members mb on mb.pair_id = ma.pair_id
     where ma.user_id = a and mb.user_id = b
       and ma.left_at is null and mb.left_at is null
  );
$$;

revoke all on function public.in_same_pair(uuid, uuid) from public;
revoke all on function public.in_same_pair(uuid, uuid) from anon;
grant execute on function public.in_same_pair(uuid, uuid) to authenticated;

/** A dupla ativa de alguém, ou null. */
create or replace function public.my_pair_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.pair_id from public.pair_members m
   where m.user_id = auth.uid() and m.left_at is null
   limit 1;
$$;

revoke all on function public.my_pair_id() from public;
revoke all on function public.my_pair_id() from anon;
grant execute on function public.my_pair_id() to authenticated;

drop policy if exists "vê a própria dupla" on public.accountability_pairs;
create policy "vê a própria dupla"
  on public.accountability_pairs for select
  to authenticated
  using (id = public.my_pair_id());

drop policy if exists "vê quem está na própria dupla" on public.pair_members;
create policy "vê quem está na própria dupla"
  on public.pair_members for select
  to authenticated
  using (pair_id = public.my_pair_id());

-- Sem insert/update/delete: entrar e sair passa por função.

-- ---------------------------------------------------------------------------
-- incentivos
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.encouragement_kind as enum ('bora', 'mandou_bem', 'to_contigo');
exception when duplicate_object then null;
end $$;

/*
  Três reações, sem texto livre.

  Texto livre é chat, chat precisa de moderação, denúncia e bloqueio, e nada
  disso existe aqui. Três gestos cobrem o que a dupla precisa dizer no MVP:
  "bora", "mandou bem" e "tô contigo".
*/
create table if not exists public.pair_encouragements (
  id           uuid primary key default gen_random_uuid(),
  pair_id      uuid not null references public.accountability_pairs (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         public.encouragement_kind not null,
  /* O dia local de quem mandou. É o que limita a repetição. */
  day          date not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,

  constraint pair_encouragements_not_self check (sender_id <> recipient_id)
);

comment on table public.pair_encouragements is
  'Reações entre a dupla. Sem texto livre: três gestos fechados.';

/* Um gesto de cada tipo por dia. Sem isso, "mandar 🔥" vira notificação em rajada. */
create unique index if not exists pair_encouragements_once_idx
  on public.pair_encouragements (pair_id, sender_id, kind, day);

create index if not exists pair_encouragements_recipient_idx
  on public.pair_encouragements (recipient_id, created_at desc);

alter table public.pair_encouragements enable row level security;

/* Só quem está na dupla lê, e só o que passou por ela. */
drop policy if exists "lê os incentivos da própria dupla" on public.pair_encouragements;
create policy "lê os incentivos da própria dupla"
  on public.pair_encouragements for select
  to authenticated
  using (pair_id = public.my_pair_id());

/* Marcar como lido é só de quem recebeu. */
drop policy if exists "marca como lido o que recebeu" on public.pair_encouragements;
create policy "marca como lido o que recebeu"
  on public.pair_encouragements for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Insert por função: ela valida a dupla, o destinatário e o dia local.

-- ---------------------------------------------------------------------------
-- avanço do dia, sem revelar em quê
-- ---------------------------------------------------------------------------

/*
  "Essa pessoa avançou no dia X?"

  É a ÚNICA coisa que a dupla aprende uma sobre a outra, e ela sai daqui como
  booleano. O dia é o dia LOCAL da pessoa avaliada (`user_presence.timezone`):
  quem está em Lisboa não pode aparecer como "ainda não avançou" às nove da
  manhã só porque o servidor está em UTC.

  Avançar é concluir uma ação ou cumprir um hábito — inclusive na versão
  mínima. Abrir o app não conta: o Juntos não existe pra celebrar presença.
*/
create or replace function public.advanced_on(p_user uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
     where t.user_id = p_user and t.status = 'feita'
       and t.completed_at is not null
       and (t.completed_at at time zone coalesce(
             (select pr.timezone from public.user_presence pr where pr.user_id = p_user),
             'America/Sao_Paulo'))::date = p_day
  ) or exists (
    select 1 from public.habit_logs l
     where l.user_id = p_user and l.status in ('feito', 'minimo') and l.day = p_day
  );
$$;

/*
  O revoke de `authenticated` é EXPLÍCITO, e é o mais importante dos três.

  O Postgres (e o Supabase, por default privileges) concede execute a
  `public` em toda função nova: "não dar grant" não é o mesmo que "negar".
  Sem esta linha, qualquer sessão logada poderia perguntar "fulano avançou no
  dia X?" sobre QUALQUER uuid — que é exatamente o vazamento que a dupla
  inteira foi desenhada pra impedir. Quem chama é `pair_overview`, que roda
  como definer e já verificou a dupla.

  Um teste cobre isso (`supabase/tests/pglite/juntos.mjs`), porque foi assim
  que o furo apareceu.
*/
revoke all on function public.advanced_on(uuid, date) from public;
revoke all on function public.advanced_on(uuid, date) from anon;
revoke all on function public.advanced_on(uuid, date) from authenticated;

/** O dia de hoje no fuso da pessoa. */
create or replace function public.local_day_of(p_user uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce(
    (select pr.timezone from public.user_presence pr where pr.user_id = p_user),
    'America/Sao_Paulo'
  ))::date;
$$;

revoke all on function public.local_day_of(uuid) from public;
revoke all on function public.local_day_of(uuid) from anon;
revoke all on function public.local_day_of(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- criar e aceitar convite
-- ---------------------------------------------------------------------------

/** Quantos dias o link de convite vale. */
create or replace function public.pair_invite_ttl_days()
returns integer language sql immutable as $$ select 7 $$;

/*
  Cria o convite e devolve o token EM CLARO — uma vez, aqui, nunca mais.

  O app monta o link com ele. Quem perdeu o link gera outro; o anterior é
  cancelado no mesmo movimento, porque dois links vivos pra mesma pessoa é
  um deles sendo aceito sem ninguém saber qual.
*/
create or replace function public.pair_create_invite()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := auth.uid();
  token text;
  novo  public.pair_invites;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  if public.my_pair_id() is not null then
    raise exception 'você já está em uma dupla' using errcode = '23505';
  end if;

  -- Ritmo: seis convites por dia por conta. Acima disso é geração em massa
  -- de links, não alguém chamando um amigo.
  if (select count(*) from public.pair_invites i
       where i.inviter_id = quem and i.created_at > now() - interval '1 day') >= 6 then
    raise exception 'muitos convites hoje' using errcode = '53400';
  end if;

  update public.pair_invites
     set status = 'cancelado', responded_at = now()
   where inviter_id = quem and status = 'pendente';

  token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.pair_invites (inviter_id, token_hash, expires_at)
  values (
    quem,
    encode(extensions.digest(token, 'sha256'), 'hex'),
    now() + make_interval(days => public.pair_invite_ttl_days())
  )
  returning * into novo;

  return jsonb_build_object(
    'id', novo.id,
    'token', token,
    'expires_at', novo.expires_at
  );
end;
$$;

revoke all on function public.pair_create_invite() from public;
revoke all on function public.pair_create_invite() from anon;
grant execute on function public.pair_create_invite() to authenticated;

/*
  O que a pessoa convidada vê ANTES de aceitar.

  Só o primeiro nome e o avatar de quem convidou, mais o estado do convite.
  Nada de objetivo, progresso ou e-mail: a tela de aceite não é um perfil, e
  quem tem o link ainda não é ninguém pra essa conta.
*/
create or replace function public.pair_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  convite public.pair_invites;
  nome    text;
  avatar  text;
begin
  select * into convite from public.pair_invites
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if convite.id is null then
    return jsonb_build_object('status', 'invalido');
  end if;

  if convite.status <> 'pendente' then
    return jsonb_build_object('status', convite.status::text);
  end if;

  if convite.expires_at <= now() then
    return jsonb_build_object('status', 'expirado');
  end if;

  select split_part(p.name, ' ', 1), p.avatar_url into nome, avatar
    from public.profiles p where p.id = convite.inviter_id;

  return jsonb_build_object(
    'status', 'pendente',
    'inviter_name', nome,
    'inviter_avatar', avatar,
    'expires_at', convite.expires_at,
    /* Aceitar exige sessão; a tela usa isso pra mandar pro cadastro antes. */
    'can_accept', auth.uid() is not null and auth.uid() <> convite.inviter_id
  );
end;
$$;

revoke all on function public.pair_invite_preview(text) from public;
grant execute on function public.pair_invite_preview(text) to anon;
grant execute on function public.pair_invite_preview(text) to authenticated;

/*
  Aceitar.

  Tudo numa transação e com a linha do convite travada (`for update`): dois
  cliques no mesmo link, ao mesmo tempo, em dois aparelhos, criariam duas
  duplas com o mesmo convite se a checagem e a escrita ficassem separadas.
*/
create or replace function public.pair_accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem    uuid := auth.uid();
  convite public.pair_invites;
  nova    uuid;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select * into convite from public.pair_invites
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;

  if convite.id is null then
    raise exception 'convite inválido' using errcode = '22023';
  end if;
  if convite.status <> 'pendente' then
    raise exception 'esse convite já foi usado' using errcode = '22023';
  end if;
  if convite.expires_at <= now() then
    update public.pair_invites set status = 'expirado', responded_at = now() where id = convite.id;
    raise exception 'convite expirado' using errcode = '22023';
  end if;
  if convite.inviter_id = quem then
    raise exception 'você não pode aceitar o próprio convite' using errcode = '22023';
  end if;
  if public.my_pair_id() is not null then
    raise exception 'você já está em uma dupla' using errcode = '23505';
  end if;
  -- Quem convidou pode ter entrado em outra dupla enquanto o link circulava.
  if exists (select 1 from public.pair_members m
              where m.user_id = convite.inviter_id and m.left_at is null) then
    update public.pair_invites set status = 'cancelado', responded_at = now() where id = convite.id;
    raise exception 'quem te convidou já está em outra dupla' using errcode = '22023';
  end if;

  insert into public.accountability_pairs (invite_id) values (convite.id) returning id into nova;
  insert into public.pair_members (pair_id, user_id) values (nova, convite.inviter_id), (nova, quem);

  update public.pair_invites
     set status = 'aceito', invitee_id = quem, pair_id = nova, responded_at = now()
   where id = convite.id;

  return nova;
end;
$$;

revoke all on function public.pair_accept_invite(text) from public;
revoke all on function public.pair_accept_invite(text) from anon;
grant execute on function public.pair_accept_invite(text) to authenticated;

/** Recusar: o link morre sem criar nada. */
create or replace function public.pair_decline_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  update public.pair_invites
     set status = 'recusado', responded_at = now(), invitee_id = auth.uid()
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and status = 'pendente'
     and inviter_id <> auth.uid();
end;
$$;

revoke all on function public.pair_decline_invite(text) from public;
revoke all on function public.pair_decline_invite(text) from anon;
grant execute on function public.pair_decline_invite(text) to authenticated;

/** Cancelar um convite que ainda não foi usado. Só quem enviou. */
create or replace function public.pair_cancel_invite(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pair_invites
     set status = 'cancelado', responded_at = now()
   where id = p_id and inviter_id = auth.uid() and status = 'pendente';
$$;

revoke all on function public.pair_cancel_invite(uuid) from public;
revoke all on function public.pair_cancel_invite(uuid) from anon;
grant execute on function public.pair_cancel_invite(uuid) to authenticated;

/*
  Sair da dupla.

  Sair é dos dois lados: a dupla inteira é encerrada, e não "a outra pessoa
  continua sozinha numa dupla". O histórico fica — `left_at` e `ended_at` são
  carimbos, não exclusão.
*/
create or replace function public.pair_leave()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
  qual uuid := public.my_pair_id();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;
  if qual is null then
    return;
  end if;

  update public.pair_members set left_at = now() where pair_id = qual and left_at is null;
  update public.accountability_pairs set ended_at = now(), ended_by = quem where id = qual;
end;
$$;

revoke all on function public.pair_leave() from public;
revoke all on function public.pair_leave() from anon;
grant execute on function public.pair_leave() to authenticated;

-- ---------------------------------------------------------------------------
-- a tela da dupla
-- ---------------------------------------------------------------------------

/** Quantos dias a tela mostra na faixa de atividade. */
create or replace function public.pair_window_days()
returns integer language sql immutable as $$ select 7 $$;

/*
  Tudo que a tela do Juntos precisa, numa chamada.

  Uma chamada e não seis: a tela mostra duas pessoas, sete dias cada e as
  reações do dia. Em seis consultas isso seria um N+1 por membro, e no
  celular em rede ruim a diferença entre uma ida e doze é a tela existir ou
  não existir.

  O que sai daqui, por pessoa: id, primeiro nome, avatar, se avançou hoje e
  um vetor de sete booleanos. Não existe caminho nesta função pra um título,
  uma nota, um objetivo ou uma quantidade de ações.
*/
create or replace function public.pair_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  quem    uuid := auth.uid();
  qual    uuid;
  criada  timestamptz;
  membros jsonb;
  juntos  integer := 0;
  dia     date;
  i       integer;
  todos   boolean;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  qual := public.my_pair_id();
  if qual is null then
    return jsonb_build_object('pair', null);
  end if;

  select p.created_at into criada from public.accountability_pairs p where p.id = qual;

  select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'is_me', m.user_id = quem,
           'name', split_part(pr.name, ' ', 1),
           'avatar_url', pr.avatar_url,
           'advanced_today', public.advanced_on(m.user_id, public.local_day_of(m.user_id)),
           'days', (
             select jsonb_agg(jsonb_build_object(
                      'day', d.dia,
                      'advanced', public.advanced_on(m.user_id, d.dia)
                    ) order by d.dia)
               from generate_series(
                      public.local_day_of(m.user_id) - (public.pair_window_days() - 1),
                      public.local_day_of(m.user_id),
                      interval '1 day'
                    ) as g(ts)
               cross join lateral (select g.ts::date as dia) d
           )
         ) order by (m.user_id = quem) desc)
    into membros
    from public.pair_members m
    join public.profiles pr on pr.id = m.user_id
   where m.pair_id = qual and m.left_at is null;

  /*
    "Dias em movimento juntas": dias seguidos, de trás pra frente, em que as
    DUAS avançaram. É uma contagem de consistência compartilhada, e ela para
    no primeiro dia em que uma das duas não avançou — sem nunca dizer qual.
  */
  for i in 0 .. (public.pair_window_days() * 4) loop
    dia := (public.local_day_of(quem) - i);
    select bool_and(public.advanced_on(m.user_id, dia)) into todos
      from public.pair_members m
     where m.pair_id = qual and m.left_at is null;

    -- O dia de hoje ainda está acontecendo: ele não interrompe a contagem.
    if todos then
      juntos := juntos + 1;
    elsif i > 0 then
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'pair', jsonb_build_object(
      'id', qual,
      'created_at', criada,
      'days_together', juntos,
      'members', coalesce(membros, '[]'::jsonb),
      'encouragements_today', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', e.id, 'kind', e.kind, 'sender_id', e.sender_id,
                 'recipient_id', e.recipient_id, 'created_at', e.created_at,
                 'read_at', e.read_at
               ) order by e.created_at)
          from public.pair_encouragements e
         where e.pair_id = qual and e.day >= public.local_day_of(quem) - 1
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.pair_overview() from public;
revoke all on function public.pair_overview() from anon;
grant execute on function public.pair_overview() to authenticated;

/*
  Mandar um incentivo.

  A função descobre o destinatário sozinha — o app não escolhe quem recebe,
  porque numa dupla só existe uma resposta. Passar o id do destinatário seria
  abrir a porta pra mandar reação pra quem não é do par.
*/
create or replace function public.pair_send_encouragement(p_kind public.encouragement_kind)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := auth.uid();
  qual  uuid;
  outro uuid;
  novo  uuid;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  qual := public.my_pair_id();
  if qual is null then
    raise exception 'você não está em uma dupla' using errcode = '22023';
  end if;

  select m.user_id into outro from public.pair_members m
   where m.pair_id = qual and m.left_at is null and m.user_id <> quem
   limit 1;

  if outro is null then
    raise exception 'sua dupla está incompleta' using errcode = '22023';
  end if;

  insert into public.pair_encouragements (pair_id, sender_id, recipient_id, kind, day)
  values (qual, quem, outro, p_kind, public.local_day_of(quem))
  on conflict (pair_id, sender_id, kind, day) do nothing
  returning id into novo;

  -- Repetido no mesmo dia: devolve o que já existe em vez de erro. Repetir o
  -- gesto não é falha da pessoa, é ela achando que não enviou.
  if novo is null then
    select id into novo from public.pair_encouragements
     where pair_id = qual and sender_id = quem and kind = p_kind and day = public.local_day_of(quem);
  end if;

  return novo;
end;
$$;

revoke all on function public.pair_send_encouragement(public.encouragement_kind) from public;
revoke all on function public.pair_send_encouragement(public.encouragement_kind) from anon;
grant execute on function public.pair_send_encouragement(public.encouragement_kind) to authenticated;

-- ---------------------------------------------------------------------------
-- a flag
-- ---------------------------------------------------------------------------

/*
  O Juntos nasce desligado.

  A parte individual da retenção funciona sem ele, e é assim que a comparação
  entre quem tem dupla e quem não tem vai poder ser feita: ligando pra uma
  parte da base e olhando as duas.
*/
update public.product_settings
   set value = value || jsonb_build_object('juntos', false),
       updated_at = now()
 where key = 'features';

-- ---------------------------------------------------------------------------
-- o corte social das métricas
-- ---------------------------------------------------------------------------

/*
  Com dupla x sem dupla, lado a lado.

  A função NÃO devolve nenhum campo chamado "efeito" nem "lift": quem aceita
  um convite já é, em média, alguém mais engajado, e a diferença entre os dois
  grupos é correlação. Nomear como efeito seria transformar uma leitura que
  precisa de cuidado num número que alguém cola numa apresentação.
*/
create or replace function public.admin_pair_comparison(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts   timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'pairs_created', (select count(*) from public.accountability_pairs
                       where created_at >= from_ts and created_at < to_ts),
    'pairs_ended', (select count(*) from public.accountability_pairs
                     where ended_at >= from_ts and ended_at < to_ts),
    'invites', coalesce((
      select jsonb_object_agg(i.status, i.n)
        from (select status, count(*) n from public.pair_invites
               where created_at >= from_ts and created_at < to_ts group by status) i
    ), '{}'::jsonb),
    'encouragements', (select count(*) from public.pair_encouragements
                        where created_at >= from_ts and created_at < to_ts),
    'groups', coalesce((
      select jsonb_object_agg(g.grupo, jsonb_build_object(
               'users', g.pessoas,
               'advanced_days_median', g.mediana,
               'd7_advanced', g.d7
             ))
        from (
          select case when exists (select 1 from public.pair_members m
                                    where m.user_id = u.id and m.left_at is null)
                      then 'com_dupla' else 'sem_dupla' end grupo,
                 count(*) pessoas,
                 percentile_cont(0.5) within group (
                   order by (select count(distinct e.day) from public.product_events e
                              where e.user_id = u.id
                                and e.name = any (public.meaningful_event_names())
                                and e.created_at >= from_ts and e.created_at < to_ts)
                 ) mediana,
                 round(100.0 * count(*) filter (
                   where u.created_at < now() - interval '7 days'
                     and public.advanced_at(u.id, u.created_at, 7)
                 ) / nullif(count(*) filter (where u.created_at < now() - interval '7 days'), 0), 1) d7
            from auth.users u
           where u.deleted_at is null
           group by 1
        ) g
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_pair_comparison(date, date) from public;
revoke all on function public.admin_pair_comparison(date, date) from anon;
grant execute on function public.admin_pair_comparison(date, date) to authenticated;
