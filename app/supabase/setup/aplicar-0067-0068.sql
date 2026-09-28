-- Momentumm — a camada social, pra colar no SQL Editor.
--
-- Este arquivo é a 0067 e a 0068 na ordem, num bloco só, porque a ordem
-- importa: a 0068 lê tabelas e tipos que a 0067 cria. Ele é GERADO a partir
-- das duas migrations e não deve ser editado à mão — quem manda são os
-- arquivos em `supabase/migrations/`.
--
-- ## Como rodar
--
--   1. Painel do Supabase > SQL Editor > New query
--   2. Colar ESTE arquivo inteiro e rodar
--   3. Rodar `supabase/setup/conferir-0067-0068.sql` e ler o veredito
--   4. Registrar no CLI, pra o próximo `db push` não tentar reaplicar:
--
--        npx supabase login
--        npx supabase migration repair --status applied \
--          0057 0058 0059 0060 0061 0062 0063 0064 0065 0066 0067 0068
--        npx supabase migration list
--
-- O DDL do Postgres é transacional e o SQL Editor roda o bloco inteiro de uma
-- vez: se qualquer linha falhar, NADA é aplicado. Não existe meio caminho.
--
-- ## O que ela muda no que já existe
--
-- É aditiva em quase tudo (dez tabelas novas, um bucket novo), com três
-- exceções que valem ser lidas antes:
--
--   1. `follows` ganha `status`. As linhas que existem viram `aceito` quando o
--      perfil de destino é `publico`, e `pendente` nas outras. É a leitura
--      conservadora: elas nasceram quando seguir não dava acesso a nada, então
--      nenhuma delas é consentimento pra ver conteúdo fechado.
--   2. A política de SELECT de `profiles` é substituída. Ela ganha duas
--      cláusulas (quem tem pedido aceito, e quem pediu pra me seguir) e mantém
--      as quatro da 0012. Nada é afrouxado.
--   3. `follow_counts` passa a contar só o aceito. Perfil fechado que tinha
--      seguidor pendente vê o número cair, e é o número certo.
--
-- Nada é apagado, nada é destrutivo, e rodar de novo não quebra nada.
--
-- ============================================================================

-- Momentumm — a camada social: publicação, feed, stories e o álbum do dia.
--
-- O produto até aqui era single-player com uma varanda: `journey_events` (0008)
-- registra o que o app percebe sozinho, `friendships` (0009) fecha o círculo de
-- amigos e `follows` (0060) conta quem acompanha quem sem abrir nada. Esta
-- migration acrescenta o que faltava pra pessoa CONTAR a própria jornada com as
-- palavras e as fotos dela: publicação, story, comentário, curtida e salvo.
--
-- ## A decisão que manda em todo o resto
--
-- Existe UMA pergunta de autorização nesta camada, e ela tem UMA função:
--
--     public.can_view_content_of(dono uuid) -> boolean
--
-- Perfil público: qualquer conta autenticada vê. Perfil fechado: só quem segue
-- com pedido ACEITO. Bloqueio derruba os dois casos. Publicação, mídia, story
-- e comentário leem dessa mesma função, e o Storage também. Espalhar a regra
-- por sete políticas seria garantir que uma delas afrouxasse sozinha no dia em
-- que a próxima tela precisasse de uma exceção.
--
-- ## `follows` deixou de ser só contagem
--
-- A 0060 dizia, com todas as letras, que seguir NÃO ABRE NADA. Isso muda aqui,
-- e muda de propósito: sem seguir, não existe feed. O que entra junto é o
-- pedido de aprovação (`status`), que é o que devolve ao perfil fechado o
-- controle que ele tinha quando seguir não significava nada.
--
-- Quem decide o `status` é um TRIGGER, nunca o cliente. Deixar a coluna sob a
-- policy de insert do dono repetiria a falha de `profiles.plan` (ver 0013): um
-- PATCH com `{"status":"aceito"}` viraria acesso ao perfil fechado de outra
-- pessoa, e o front nunca mandaria esse campo, que é justamente por que
-- passaria despercebido.
--
-- ## O que acontece com quem já seguia alguém
--
-- As linhas que existem viram `aceito` só quando o perfil de destino é
-- `publico`; as outras voltam pra `pendente`. É a leitura conservadora: essas
-- linhas foram criadas quando seguir não dava acesso a nada, então nenhuma
-- delas é um consentimento pra ver conteúdo fechado. Ninguém perde conteúdo
-- retroativamente, porque publicação é tabela nova e ainda não existe linha.

-- ---------------------------------------------------------------------------
-- os tipos
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'follow_status') then
    create type public.follow_status as enum ('pendente', 'aceito');
  end if;

  /*
    Dois degraus, não quatro.

    `activity_visibility` (0001) e `journey_visibility` (0008) têm quatro cada,
    e nenhuma das duas serve aqui: lá "pública" é alcance que ninguém consegue
    conferir na interface. Publicação só tem duas respostas possíveis, e as
    duas são conferíveis na tela: quem me vê, ou ninguém além de mim.

    O alcance de `seguidores` é decidido pelo PERFIL (`profile_visibility`), e
    não repetido aqui: com as duas coisas, "perfil fechado + publicação
    pública" seria uma combinação que a tela teria que explicar.
  */
  if not exists (select 1 from pg_type where typname = 'post_visibility') then
    create type public.post_visibility as enum ('privada', 'seguidores');
  end if;

  if not exists (select 1 from pg_type where typname = 'story_media') then
    create type public.story_media as enum ('imagem', 'video');
  end if;

  if not exists (select 1 from pg_type where typname = 'report_target') then
    create type public.report_target as enum ('publicacao', 'comentario', 'story', 'pessoa');
  end if;

  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum (
      'spam', 'assedio', 'conteudo-sexual', 'violencia', 'desinformacao', 'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('aberta', 'revisada', 'arquivada');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- bloqueio
-- ---------------------------------------------------------------------------

/*
  Uma linha por DIREÇÃO, e quem bloqueou é quem lê.

  Quem foi bloqueado não vê a linha: saber que foi bloqueado é informação que
  a pessoa bloqueada usa, e a defesa de quem bloqueou é justamente o silêncio.
  O efeito ela percebe (o conteúdo some), e é diferente de receber um aviso.
*/
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'Bloqueio, de uma via. Só quem bloqueou lê a linha; o efeito é mútuo.';

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "só quem bloqueou vê" on public.blocks;
create policy "só quem bloqueou vê"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "só você bloqueia por você" on public.blocks;
create policy "só você bloqueia por você"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "só quem bloqueou desfaz" on public.blocks;
create policy "só quem bloqueou desfaz"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

/*
  O bloqueio é MÚTUO na leitura, mesmo sendo de uma via no registro.

  Se só valesse pra quem bloqueou, a pessoa bloqueada continuaria vendo tudo e
  comentando, e o gesto não teria servido pra nada.
*/
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks bl
     where (bl.blocker_id = a and bl.blocked_id = b)
        or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public;
revoke all on function public.is_blocked_between(uuid, uuid) from anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- seguir, agora com aprovação
-- ---------------------------------------------------------------------------

alter table public.follows
  add column if not exists status public.follow_status not null default 'pendente';

comment on column public.follows.status is
  'Quem escreve é o trigger follows_decide_status, nunca o cliente.';

/*
  O estado inicial é uma consequência do perfil de destino, não uma escolha de
  quem segue. Perfil público aceita na hora (é o que "público" significa);
  qualquer outro degrau vira pedido esperando resposta.

  O trigger também roda no UPDATE, e é ele que impede o caminho curto: a
  policy de update abaixo só deixa o DESTINATÁRIO mexer, e aqui o `pendente ->
  aceito` de quem segue é desfeito de qualquer jeito.
*/
create or replace function public.follows_decide_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destino public.profile_visibility;
begin
  select p.profile_visibility into destino
    from public.profiles p
   where p.id = new.following_id;

  if tg_op = 'INSERT' then
    new.status := case when destino = 'publico' then 'aceito' else 'pendente' end;
    return new;
  end if;

  /*
    No update, só o dono do perfil seguido decide. Quem segue não se aprova.

    A guarda vale pra sessão AUTENTICADA, e só. Sem `auth.uid()` a escrita já
    não passou pela RLS (a policy de update exige `auth.uid() = following_id`),
    então quem chega aqui sem sessão é `service_role` ou uma migration — e
    desfazer a escrita deles transformaria uma correção administrativa num
    update silenciosamente ignorado, que é o pior dos dois mundos.
  */
  if auth.uid() is not null
     and new.status is distinct from old.status
     and auth.uid() <> new.following_id then
    new.status := old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists follows_status_guard on public.follows;
create trigger follows_status_guard
  before insert or update on public.follows
  for each row execute function public.follows_decide_status();

/*
  O retrato: quem já seguia alguém de perfil aberto continua seguindo; o resto
  vira pedido. Roda uma vez, e é re-executável porque só toca quem está no
  estado padrão da coluna recém-criada.
*/
update public.follows f
   set status = 'aceito'
  from public.profiles p
 where p.id = f.following_id
   and p.profile_visibility = 'publico'
   and f.status = 'pendente';

create index if not exists follows_pending_idx
  on public.follows (following_id, created_at desc)
  where status = 'pendente';

create index if not exists follows_accepted_idx
  on public.follows (follower_id, following_id)
  where status = 'aceito';

/*
  Aceitar e recusar.

  Recusar é um DELETE (a política de delete da 0060 já deixa os dois lados
  desfazerem), então a única escrita nova é o aceite, e ela é do destinatário.
*/
drop policy if exists "só o destinatário aceita" on public.follows;
create policy "só o destinatário aceita"
  on public.follows for update
  to authenticated
  using (auth.uid() = following_id)
  with check (auth.uid() = following_id);

-- ---------------------------------------------------------------------------
-- a única pergunta de autorização desta camada
-- ---------------------------------------------------------------------------

create or replace function public.can_view_content_of(dono uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when auth.uid() = dono then true
    when public.is_blocked_between(auth.uid(), dono) then false
    when exists (
      select 1 from public.profiles p
       where p.id = dono and p.profile_visibility = 'publico'
    ) then true
    else exists (
      select 1 from public.follows f
       where f.follower_id = auth.uid()
         and f.following_id = dono
         and f.status = 'aceito'
    )
  end;
$$;

revoke all on function public.can_view_content_of(uuid) from public;
revoke all on function public.can_view_content_of(uuid) from anon;
grant execute on function public.can_view_content_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- o perfil passa a ser legível por quem segue
-- ---------------------------------------------------------------------------

/*
  Duas cláusulas a mais na política da 0012.

  A primeira é óbvia: quem teve o pedido aceito precisa ver o cartão de quem
  ele segue, senão o feed mostraria publicação sem nome nem foto.

  A segunda é a mesma lição de `has_profile_link`: quem PEDIU pra me seguir
  precisa ser visível pra mim, ou o pedido chega como "alguém quer te seguir",
  impossível de responder.

  Bloqueio não entra aqui de propósito. O perfil continua legível nos dois
  sentidos porque `profiles` é lido por Círculo, Clubes, Desafios e Juntos, e
  sumir com a linha deixaria card sem nome em quatro telas que não têm nada a
  ver com isto. Quem some é o CONTEÚDO, que é o que o bloqueio quer dizer.
*/
drop policy if exists "perfil visível conforme a escolha da pessoa" on public.profiles;
create policy "perfil visível conforme a escolha da pessoa"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or profile_visibility = 'publico'
    or (profile_visibility = 'amigos' and public.are_friends(auth.uid(), id))
    or public.has_profile_link(auth.uid(), id)
    or exists (
      select 1 from public.follows f
       where f.follower_id = auth.uid() and f.following_id = id and f.status = 'aceito'
    )
    or exists (
      select 1 from public.follows f
       where f.follower_id = id and f.following_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- publicação
-- ---------------------------------------------------------------------------

/*
  `day` é coluna, não derivada de `created_at`.

  O calendário do perfil é o produto desta migration, e ele pergunta "como foi
  esse dia", não "a que horas o servidor recebeu isto". Quem publica 00:40 de
  quarta está contando a terça, e quem viaja muda de fuso sem mudar de vida. O
  cliente manda o dia dele; o banco só recusa dia que ainda não chegou.

  As contagens são COLUNAS, mantidas por trigger. Contar por `select count(*)`
  devolveria o número que a RLS de quem pergunta deixa ver — cada pessoa veria
  "1 curtida" em qualquer publicação que ela mesma curtiu, que foi exatamente o
  problema que `follow_counts` (0060) existiu pra resolver.
*/
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  caption       text,
  -- O objetivo é opcional e NUNCA obrigatório. `on delete set null`: apagar o
  -- objetivo não apaga a lembrança do dia em que ele andou.
  objective_id  uuid references public.objectives (id) on delete set null,
  visibility    public.post_visibility not null default 'seguidores',
  day           date not null,
  /*
    O progresso do momento, congelado: "Dia 8 de 30".

    Dois inteiros, não uma frase. Frase livre aceita qualquer coisa e vira
    campo de texto no meio de um card; o par (feito, alvo) é conferível e a
    tela escolhe se escreve "Dia 8 de 30" ou "27%".

    Congelado, e não recalculado na leitura, porque a publicação é um MOMENTO.
    Ler o objetivo hoje pra desenhar o card de dois meses atrás reescreveria o
    que a pessoa contou: "dia 8 de 30" viraria "dia 30 de 30" no dia em que ela
    terminasse, e o post deixaria de dizer o que dizia quando foi escrito.
  */
  progress_done integer,
  progress_goal integer,
  /*
    A unidade, em palavra: "páginas", "minutos", "treinos".

    Ela é guardada junto porque o objetivo NÃO é legível por quem vê a
    publicação (a RLS de `objectives` é de dono puro, e nome de objetivo é
    texto escrito pela pessoa). Sem a unidade aqui, o card de terceiros
    mostraria "1240 de 1800" sem dizer de quê.
  */
  progress_unit text,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,

  constraint posts_caption_len check (caption is null or char_length(caption) <= 2200),
  constraint posts_day_not_ahead check (day <= (now() at time zone 'utc')::date + 1),
  constraint posts_counts_not_negative check (like_count >= 0 and comment_count >= 0),
  -- Metade de um progresso não é progresso: ou os dois números, ou nenhum.
  constraint posts_progress_pair check (
    (progress_done is null and progress_goal is null)
    or (progress_done >= 0 and progress_goal > 0 and progress_done <= progress_goal)
  ),
  constraint posts_progress_unit_len check (
    progress_unit is null or char_length(progress_unit) <= 24
  )
);

comment on table public.posts is
  'A publicação: foto, legenda e o dia que ela conta. O alcance sai do perfil.';

create index if not exists posts_author_recent_idx on public.posts (user_id, created_at desc);
create index if not exists posts_author_day_idx    on public.posts (user_id, day desc);
create index if not exists posts_recent_idx        on public.posts (created_at desc);
create index if not exists posts_objective_idx     on public.posts (objective_id) where objective_id is not null;

alter table public.posts enable row level security;

drop policy if exists "publicação visível pra quem pode ver a pessoa" on public.posts;
create policy "publicação visível pra quem pode ver a pessoa"
  on public.posts for select
  to authenticated
  using (
    auth.uid() = user_id
    or (visibility = 'seguidores' and public.can_view_content_of(user_id))
  );

drop policy if exists "só você publica por você" on public.posts;
create policy "só você publica por você"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "só o autor edita" on public.posts;
create policy "só o autor edita"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "só o autor apaga" on public.posts;
create policy "só o autor apaga"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

/*
  A pergunta "posso ver esta publicação", numa função.

  Ela existe pra as políticas de mídia, curtida, comentário e salvo não
  precisarem consultar a RLS de `posts` por dentro — o que custa uma avaliação
  de política por linha e, quando a política de `posts` um dia mencionar
  qualquer uma dessas tabelas, vira recursão.
*/
create or replace function public.can_view_post(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts po
     where po.id = alvo
       and (
         po.user_id = auth.uid()
         or (po.visibility = 'seguidores' and public.can_view_content_of(po.user_id))
       )
  );
$$;

revoke all on function public.can_view_post(uuid) from public;
revoke all on function public.can_view_post(uuid) from anon;
grant execute on function public.can_view_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- as fotos da publicação
-- ---------------------------------------------------------------------------

/*
  A imagem NÃO mora aqui, mora no bucket. A linha guarda o caminho, e o
  caminho tem que começar pela pasta do próprio autor — a mesma chave de
  autorização que o Storage usa desde a 0014.

  `position` dá o carrossel sem tabela nova e sem campo de ordenação frouxo: a
  chave única (publicação, posição) é o que impede duas fotos disputando o
  primeiro lugar. Dez é o teto, e é o número em que o carrossel deixa de ser
  um momento e vira um álbum.

  `width`/`height` sobem junto pro feed reservar o espaço da imagem antes de
  ela chegar. Sem isso, cada foto que carrega empurra o resto da lista pra
  baixo, que é o CLS que o produto mede.
*/
create table if not exists public.post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  path       text not null,
  position   smallint not null default 0,
  width      integer,
  height     integer,
  created_at timestamptz not null default now(),

  unique (post_id, position),
  constraint post_media_path_is_own check (path like user_id::text || '/%'),
  constraint post_media_position_range check (position between 0 and 9)
);

create index if not exists post_media_post_idx on public.post_media (post_id, position);
-- O Storage pergunta por caminho, uma vez por arquivo aberto.
create index if not exists post_media_path_idx on public.post_media (path);

alter table public.post_media enable row level security;

/*
  A foto pertence a quem publicou, e o banco confere em vez de confiar.

  Sem isso, uma requisição podia gravar `user_id` de outra pessoa junto com um
  caminho da pasta dela: a constraint de caminho passaria (ela compara com o
  `user_id` da própria linha) e a foto de alguém entraria na publicação de
  outro.
*/
create or replace function public.post_media_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  autor uuid;
begin
  select po.user_id into autor from public.posts po where po.id = new.post_id;
  if autor is null then
    raise exception 'publicação inexistente' using errcode = '23503';
  end if;
  if autor <> new.user_id then
    raise exception 'a foto precisa ser de quem publicou' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists post_media_belongs_to_author on public.post_media;
create trigger post_media_belongs_to_author
  before insert or update on public.post_media
  for each row execute function public.post_media_guard();

drop policy if exists "foto visível com a publicação" on public.post_media;
create policy "foto visível com a publicação"
  on public.post_media for select
  to authenticated
  using (auth.uid() = user_id or public.can_view_post(post_id));

drop policy if exists "só o autor anexa foto" on public.post_media;
create policy "só o autor anexa foto"
  on public.post_media for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "só o autor troca a foto" on public.post_media;
create policy "só o autor troca a foto"
  on public.post_media for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "só o autor tira a foto" on public.post_media;
create policy "só o autor tira a foto"
  on public.post_media for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- curtida
-- ---------------------------------------------------------------------------

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;

drop policy if exists "curtida visível com a publicação" on public.post_likes;
create policy "curtida visível com a publicação"
  on public.post_likes for select
  to authenticated
  using (auth.uid() = user_id or public.can_view_post(post_id));

/*
  Curtir exige ENXERGAR. Sem esta metade, um POST direto na API inflaria a
  contagem de uma publicação fechada que a pessoa nunca viu.
*/
drop policy if exists "só você curte por você" on public.post_likes;
create policy "só você curte por você"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_view_post(post_id));

drop policy if exists "só você descurte" on public.post_likes;
create policy "só você descurte"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- comentário
-- ---------------------------------------------------------------------------

/*
  Sem thread nesta versão, e `hidden_at` já existe.

  A coluna entra agora porque moderação que chega depois costuma chegar como
  DELETE — e apagar é a resposta que não dá pra revisar. Escondido continua
  legível pra quem escreveu, some pro resto, e isso é o suficiente pra o autor
  da publicação tirar de cima dele o que não quer, sem apagar a prova.
*/
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id) on delete set null,

  constraint post_comments_body_len check (char_length(btrim(body)) between 1 and 500)
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at desc);
create index if not exists post_comments_user_idx on public.post_comments (user_id, created_at desc);

alter table public.post_comments enable row level security;

drop policy if exists "comentário visível com a publicação" on public.post_comments;
create policy "comentário visível com a publicação"
  on public.post_comments for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      public.can_view_post(post_id)
      and hidden_at is null
      and not public.is_blocked_between(auth.uid(), user_id)
    )
  );

drop policy if exists "só você comenta por você" on public.post_comments;
create policy "só você comenta por você"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_view_post(post_id));

/*
  Apagar: o próprio comentário, ou qualquer comentário da própria publicação.

  A segunda metade é a moderação mínima, e ela é de quem publicou. Sem ela, a
  única saída de um comentário indesejado seria apagar a publicação inteira.
*/
create or replace function public.owns_post(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.posts po where po.id = alvo and po.user_id = auth.uid());
$$;

revoke all on function public.owns_post(uuid) from public;
revoke all on function public.owns_post(uuid) from anon;
grant execute on function public.owns_post(uuid) to authenticated;

drop policy if exists "apaga o próprio comentário ou o da própria publicação" on public.post_comments;
create policy "apaga o próprio comentário ou o da própria publicação"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.owns_post(post_id));

-- Editar comentário não existe: não há política de update, e a ausência é a
-- regra. Comentário editado depois de respondido é a fonte do mal-entendido.

-- ---------------------------------------------------------------------------
-- salvos
-- ---------------------------------------------------------------------------

/*
  Salvar é privado por definição: ninguém sabe o que você guardou, nem o autor
  da publicação. Por isso as quatro regras são de dono puro, sem `can_view_post`
  na leitura — o que some é a publicação, pela RLS dela, quando o salvo é
  buscado junto.
*/
create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, post_id)
);

create index if not exists saved_posts_recent_idx on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;

drop policy if exists "só você vê o que salvou" on public.saved_posts;
create policy "só você vê o que salvou"
  on public.saved_posts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "só você salva por você" on public.saved_posts;
create policy "só você salva por você"
  on public.saved_posts for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_view_post(post_id));

drop policy if exists "só você tira dos salvos" on public.saved_posts;
create policy "só você tira dos salvos"
  on public.saved_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- as contagens, por trigger
-- ---------------------------------------------------------------------------

/*
  `security definer` porque quem curte não é o dono da publicação, e a policy
  de update de `posts` (com razão) só deixa o autor escrever na linha dele.
  Sem isso, curtir a publicação de outra pessoa somaria zero, em silêncio.
*/
create or replace function public.bump_post_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'post_likes' then
    if tg_op = 'INSERT' then
      update public.posts set like_count = like_count + 1 where id = new.post_id;
    else
      update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    end if;
  else
    if tg_op = 'INSERT' then
      update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    else
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.bump_post_counts();

drop trigger if exists post_comments_count on public.post_comments;
create trigger post_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.bump_post_counts();

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------

/*
  Vinte e quatro horas, e o prazo é do BANCO.

  `expires_at` entra na política de leitura, então story vencido para de ser
  legível na hora, sem depender de faxina agendada nem de filtro no cliente. A
  limpeza dos arquivos vem depois, por `purge_expired_stories`, e atrasar ela
  não expõe nada.
*/
create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  path       text not null,
  kind       public.story_media not null default 'imagem',
  caption    text,
  width      integer,
  height     integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',

  constraint stories_path_is_own check (path like user_id::text || '/%'),
  constraint stories_caption_len check (caption is null or char_length(caption) <= 200)
);

create index if not exists stories_live_idx on public.stories (user_id, created_at desc);
create index if not exists stories_expiry_idx on public.stories (expires_at);
create index if not exists stories_path_idx on public.stories (path);

alter table public.stories enable row level security;

drop policy if exists "story visível enquanto vive" on public.stories;
create policy "story visível enquanto vive"
  on public.stories for select
  to authenticated
  using (
    auth.uid() = user_id
    or (expires_at > now() and public.can_view_content_of(user_id))
  );

drop policy if exists "só você posta o teu story" on public.stories;
create policy "só você posta o teu story"
  on public.stories for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "só você apaga o teu story" on public.stories;
create policy "só você apaga o teu story"
  on public.stories for delete
  to authenticated
  using (auth.uid() = user_id);

-- Story não se edita: as 24 horas contam de quando ele foi postado, e mudar a
-- imagem depois de visto é publicar outra coisa no lugar da que foi vista.

/*
  Quem viu.

  Serve a duas coisas: o anel "ainda não visto" na bandeja e a lista de quem
  viu, pro dono. Ninguém além do dono lê as visualizações dos outros.
*/
create table if not exists public.story_views (
  story_id   uuid not null references public.stories (id) on delete cascade,
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx on public.story_views (viewer_id);

alter table public.story_views enable row level security;

create or replace function public.owns_story(alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.stories s where s.id = alvo and s.user_id = auth.uid());
$$;

revoke all on function public.owns_story(uuid) from public;
revoke all on function public.owns_story(uuid) from anon;
grant execute on function public.owns_story(uuid) to authenticated;

drop policy if exists "quem viu: você e o dono" on public.story_views;
create policy "quem viu: você e o dono"
  on public.story_views for select
  to authenticated
  using (auth.uid() = viewer_id or public.owns_story(story_id));

drop policy if exists "marcar visto é por você" on public.story_views;
create policy "marcar visto é por você"
  on public.story_views for insert
  to authenticated
  with check (auth.uid() = viewer_id);

/*
  A faxina dos vencidos, arquivo junto.

  Não existe agendador garantido (a 0034 já convive com um banco sem
  `pg_cron`), então esta função é chamável e idempotente: o app dispara depois
  de abrir a bandeja, e rodar duas vezes no mesmo minuto não faz diferença. O
  que protege o conteúdo é a policy de leitura, não esta faxina.
*/
create or replace function public.purge_expired_stories()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  apagados integer;
begin
  with mortos as (
    delete from public.stories
     where expires_at < now() - interval '1 hour'
    returning path
  )
  select count(*) into apagados from mortos;

  begin
    delete from storage.objects o
     where o.bucket_id = 'social-media'
       and (storage.foldername(o.name))[2] = 'stories'
       and not exists (select 1 from public.stories s where s.path = o.name);
  exception
    when others then
      raise warning 'purge_expired_stories: storage recusou apagar (%).', sqlerrm;
  end;

  return apagados;
end;
$$;

revoke all on function public.purge_expired_stories() from public;
revoke all on function public.purge_expired_stories() from anon;
grant execute on function public.purge_expired_stories() to authenticated;

-- ---------------------------------------------------------------------------
-- denúncia
-- ---------------------------------------------------------------------------

/*
  Uma denúncia por pessoa e por alvo. Denunciar de novo é o mesmo registro, não
  um contador de indignação — e sem a chave única, a fila de moderação
  encheria com a mesma linha repetida por quem tocou duas vezes.

  Quem lê é o autor da denúncia e o admin. Não existe update nem delete pra
  conta comum: denúncia que o denunciante apaga é denúncia que some junto com
  a pressão pra apagá-la.
*/
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_kind public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  note        text,
  status      public.report_status not null default 'aberta',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,

  unique (reporter_id, target_kind, target_id),
  constraint reports_note_len check (note is null or char_length(note) <= 500)
);

create index if not exists reports_open_idx on public.reports (created_at desc) where status = 'aberta';
create index if not exists reports_target_idx on public.reports (target_kind, target_id);

alter table public.reports enable row level security;

drop policy if exists "vê a própria denúncia" on public.reports;
create policy "vê a própria denúncia"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "só você denuncia por você" on public.reports;
create policy "só você denuncia por você"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "só o admin resolve" on public.reports;
create policy "só o admin resolve"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

/*
  Bloquear desfaz o laço, nos dois sentidos.

  Sem isto, a linha de `follows` continuaria de pé e a contagem de seguidores
  incluiria alguém que não vê mais nada — um número que não corresponde a
  ninguém. E se o bloqueio fosse desfeito, o acesso voltaria sozinho, sem
  ninguém pedir de novo.
*/
create or replace function public.block_cuts_the_tie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_cut_follows on public.blocks;
create trigger blocks_cut_follows
  after insert on public.blocks
  for each row execute function public.block_cuts_the_tie();

-- ---------------------------------------------------------------------------
-- o bucket da camada social
-- ---------------------------------------------------------------------------

/*
  Bucket NOVO, e privado como o `user-media` (0014).

  Por que não reaproveitar o `user-media`: lá a política é "só o dono lê", e
  ela está certa pro que mora lá (áudio, anexo, a foto do álbum privado). Aqui
  a leitura é de terceiros, por regra. Afrouxar a política do bucket existente
  pra caber os dois casos transformaria uma condição simples numa expressão
  que alguém precisa reler inteira antes de mexer — e é assim que o áudio
  privado de alguém vira legível numa sexta-feira.

  Por que não um bucket público: perfil fechado. Bucket público entrega o
  arquivo a quem tem a URL, e a URL vaza por print, por histórico e por
  extensão de navegador. O alcance da foto tem que ser o mesmo alcance da
  publicação, e o único jeito de garantir isso é o servidor assinar cada
  leitura.

  Vídeo entra só aqui (story), e com teto menor que o do Storage por tipo: 5MB
  de imagem e 20MB no bucket, porque um vídeo de 15 segundos em 720p cabe nisso
  e um de um minuto não — e o de um minuto não é story.
*/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/*
  A leitura do arquivo pergunta pela LINHA que aponta pra ele, nunca pela pasta.

  "Pasta de perfil público é legível" seria a política mais curta e o furo mais
  fácil: `list` também passa por SELECT em `storage.objects`, então qualquer
  conta listaria a pasta inteira de alguém e pediria link pra tudo que estivesse
  lá — inclusive a foto de uma publicação marcada como privada, e a de um story
  já vencido.

  Amarrando ao registro, o arquivo vive exatamente o que a publicação (ou o
  story) vive: some da leitura quando a linha some, quando a visibilidade
  fecha, quando o bloqueio entra e quando as 24 horas acabam.
*/
create or replace function public.can_read_social_file(caminho text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.post_media pm
       where pm.path = caminho
         and (pm.user_id = auth.uid() or public.can_view_post(pm.post_id))
    )
    or exists (
      select 1 from public.stories s
       where s.path = caminho
         and (
           s.user_id = auth.uid()
           or (s.expires_at > now() and public.can_view_content_of(s.user_id))
         )
    );
$$;

revoke all on function public.can_read_social_file(text) from public;
revoke all on function public.can_read_social_file(text) from anon;
grant execute on function public.can_read_social_file(text) to authenticated;

drop policy if exists "social-media: leitura pela publicação" on storage.objects;
create policy "social-media: leitura pela publicação"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'social-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_read_social_file(name)
    )
  );

drop policy if exists "social-media: dono envia" on storage.objects;
create policy "social-media: dono envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] in ('posts', 'stories')
    and name !~ '\.\.'
  );

drop policy if exists "social-media: dono substitui" on storage.objects;
create policy "social-media: dono substitui"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name !~ '\.\.'
  );

drop policy if exists "social-media: dono apaga" on storage.objects;
create policy "social-media: dono apaga"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/*
  O arquivo morre com a conta, como no `user-media` (0014). O trigger de lá
  roda no delete de `profiles` e cuida do bucket dele; este cuida deste.
*/
create or replace function public.purge_user_social_media()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
   where bucket_id = 'social-media'
     and (storage.foldername(name))[1] = old.id::text;
  return old;
end;
$$;

drop trigger if exists profiles_purge_social_media on public.profiles;
create trigger profiles_purge_social_media
  before delete on public.profiles
  for each row execute function public.purge_user_social_media();

-- ============================================================================
-- ============================================================================
-- 0068_social_leitura.sql
-- ============================================================================
-- ============================================================================

-- Momentumm — como a camada social é LIDA.
--
-- A 0067 criou as tabelas e as regras. Esta traz as consultas, e elas são
-- funções por três motivos que valem juntos:
--
--   1. **Uma ida ao servidor por tela.** Um card de publicação precisa do
--      post, do autor, das fotos, do objetivo e de dois booleanos do próprio
--      leitor (curti? salvei?). Pelo PostgREST isso são cinco requisições ou
--      um `select` aninhado que ainda deixaria os booleanos de fora.
--
--   2. **O feed não é filtrável pelo cliente.** "De quem eu sigo" é um join
--      com `follows`; mandar a lista de ids no `in(...)` significaria baixar
--      a lista inteira de seguidos a cada página, e quebraria no dia em que
--      alguém seguisse quinhentas pessoas.
--
--   3. **Paginação desde o primeiro dia.** Todas recebem um cursor
--      (`created_at` da última linha) e um teto. Não existe caminho neste
--      arquivo que devolva "todas as publicações".
--
-- Todas são `security invoker`: a RLS da 0067 continua valendo por dentro, e
-- o que sai daqui é exatamente o que a pessoa já poderia ler tabela a tabela.
-- `security definer` aqui seria trocar sete políticas revisadas por uma
-- função que ninguém relê.

-- ---------------------------------------------------------------------------
-- o tipo de linha de um card
-- ---------------------------------------------------------------------------

/*
  As três funções que devolvem publicação (feed, perfil e uma só) devolvem as
  MESMAS colunas, na mesma ordem. Um card lido de três jeitos diferentes é um
  card que diverge em três lugares na primeira coluna nova.
*/
do $$
begin
  if exists (select 1 from pg_type where typname = 'post_card_row') then
    drop type public.post_card_row cascade;
  end if;
end $$;

create type public.post_card_row as (
  id             uuid,
  user_id        uuid,
  caption        text,
  day            date,
  visibility     public.post_visibility,
  progress_done  integer,
  progress_goal  integer,
  progress_unit  text,
  like_count     integer,
  comment_count  integer,
  created_at     timestamptz,
  edited_at      timestamptz,
  author_name    text,
  author_handle  text,
  author_avatar  text,
  objective_id   uuid,
  objective_title text,
  media          jsonb,
  liked          boolean,
  saved          boolean
);

/*
  A montagem de um card, num lugar só.

  `objectives` é lido por dentro e a RLS dele é de dono puro: o título do
  objetivo só aparece pra quem publicou. Pra quem vê de fora ele vem nulo, e é
  o certo — o nome do objetivo é texto escrito pela pessoa, e a 0008 já tinha
  decidido que esses três (nome do objetivo, lista de hábitos, nome próprio)
  são os campos que não vazam por padrão.

  O TÍTULO que o card mostra pra terceiros sai do que a pessoa escreveu na
  legenda, não do plano dela.
*/
create or replace function public.post_cards(p_ids uuid[])
returns setof public.post_card_row
language sql
stable
security invoker
set search_path = public
as $$
  select
    po.id,
    po.user_id,
    po.caption,
    po.day,
    po.visibility,
    po.progress_done,
    po.progress_goal,
    po.progress_unit,
    po.like_count,
    po.comment_count,
    po.created_at,
    po.edited_at,
    pr.name,
    pr.handle,
    pr.avatar_url,
    po.objective_id,
    ob.title,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', m.id, 'path', m.path, 'position', m.position,
                   'width', m.width, 'height', m.height
                 )
                 order by m.position
               )
          from public.post_media m
         where m.post_id = po.id
      ),
      '[]'::jsonb
    ),
    exists (select 1 from public.post_likes l where l.post_id = po.id and l.user_id = auth.uid()),
    exists (select 1 from public.saved_posts s where s.post_id = po.id and s.user_id = auth.uid())
  from public.posts po
  join public.profiles pr on pr.id = po.user_id
  left join public.objectives ob on ob.id = po.objective_id
  where po.id = any (p_ids)
  order by po.created_at desc;
$$;

revoke all on function public.post_cards(uuid[]) from public;
revoke all on function public.post_cards(uuid[]) from anon;
grant execute on function public.post_cards(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- o feed
-- ---------------------------------------------------------------------------

/*
  Quem eu sigo, mais eu.

  "Mais eu" não é vaidade: sem a própria publicação no feed, a pessoa que
  acabou de publicar abre a tela e não vê nada mudar, e a primeira conclusão é
  que não salvou. É também o que faz o feed de uma conta nova não ser uma
  página vazia depois do primeiro post.

  Não existe algoritmo aqui. A ordem é o tempo, e é a ordem inteira: o produto
  recusa ranking (ver CLAUDE.md), e ordenar por engajamento seria montar o
  ranking sem nunca chamá-lo assim.

  O cursor é o `created_at` da última linha da página anterior. `id` entra no
  desempate porque duas publicações do mesmo milissegundo (importação, ou duas
  abas) fariam a página seguinte pular uma ou repetir outra.
*/
create or replace function public.feed_page(
  p_before timestamptz default null,
  p_limit  integer default 10
)
returns setof public.post_card_row
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
    from public.post_cards(
      array(
        select po.id
          from public.posts po
         where (
                 po.user_id = auth.uid()
                 or exists (
                   select 1 from public.follows f
                    where f.follower_id = auth.uid()
                      and f.following_id = po.user_id
                      and f.status = 'aceito'
                 )
               )
           and (p_before is null or po.created_at < p_before)
         order by po.created_at desc
         limit least(greatest(coalesce(p_limit, 10), 1), 30)
      )
    ) c
   order by c.created_at desc;
$$;

revoke all on function public.feed_page(timestamptz, integer) from public;
revoke all on function public.feed_page(timestamptz, integer) from anon;
grant execute on function public.feed_page(timestamptz, integer) to authenticated;

/*
  Uma publicação só, pelo id. É o que o calendário abre ao tocar num dia.
*/
create or replace function public.post_card(p_id uuid)
returns setof public.post_card_row
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.post_cards(array[p_id]);
$$;

revoke all on function public.post_card(uuid) from public;
revoke all on function public.post_card(uuid) from anon;
grant execute on function public.post_card(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- o perfil
-- ---------------------------------------------------------------------------

create or replace function public.profile_posts_page(
  p_user   uuid,
  p_before timestamptz default null,
  p_limit  integer default 12
)
returns setof public.post_card_row
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
    from public.post_cards(
      array(
        select po.id
          from public.posts po
         where po.user_id = p_user
           and (p_before is null or po.created_at < p_before)
         order by po.created_at desc
         limit least(greatest(coalesce(p_limit, 12), 1), 36)
      )
    ) c
   order by c.created_at desc;
$$;

revoke all on function public.profile_posts_page(uuid, timestamptz, integer) from public;
revoke all on function public.profile_posts_page(uuid, timestamptz, integer) from anon;
grant execute on function public.profile_posts_page(uuid, timestamptz, integer) to authenticated;

/*
  Todas as publicações de um dia. É o que abre quando o dia do calendário tem
  mais de uma.
*/
create or replace function public.posts_of_day(p_user uuid, p_day date)
returns setof public.post_card_row
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
    from public.post_cards(
      array(
        select po.id from public.posts po
         where po.user_id = p_user and po.day = p_day
         order by po.created_at desc
         limit 30
      )
    ) c
   order by c.created_at desc;
$$;

revoke all on function public.posts_of_day(uuid, date) from public;
revoke all on function public.posts_of_day(uuid, date) from anon;
grant execute on function public.posts_of_day(uuid, date) to authenticated;

/*
  Os números do perfil: seguidores, seguindo e publicações.

  `follow_counts` (0060) passou a contar SÓ o que foi aceito — pedido esperando
  resposta não é seguidor, e mostrá-lo como tal daria pra inflar o número de
  qualquer perfil fechado só pedindo pra segui-lo.

  Como as três saem de uma função `security definer`, elas não passam pela RLS
  de `follows` (que só deixa ver os próprios laços). É o mesmo desenho da 0060,
  e pela mesma razão: contagem de perfil é informação de vitrine, e sem isso
  cada pessoa veria "1 seguidor" em todo perfil que ela mesma segue.

  Publicações conta só as que o VISITANTE pode ver — as marcadas `privada`
  ficam de fora pra quem não é o dono. Um "12 publicações" sobre uma grade com
  9 é o número que ensina a não confiar nos outros.
*/
create or replace function public.profile_stats(p_user uuid)
returns table (followers bigint, following bigint, posts bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.follows f where f.following_id = p_user and f.status = 'aceito'),
    (select count(*) from public.follows f where f.follower_id  = p_user and f.status = 'aceito'),
    (select count(*) from public.posts po
      where po.user_id = p_user
        and (po.user_id = auth.uid() or (po.visibility = 'seguidores' and public.can_view_content_of(po.user_id))));
$$;

revoke all on function public.profile_stats(uuid) from public;
revoke all on function public.profile_stats(uuid) from anon;
grant execute on function public.profile_stats(uuid) to authenticated;

create or replace function public.follow_counts(target uuid)
returns table (followers bigint, following bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.follows f where f.following_id = target and f.status = 'aceito'),
    (select count(*) from public.follows f where f.follower_id  = target and f.status = 'aceito');
$$;

revoke all on function public.follow_counts(uuid) from public;
revoke all on function public.follow_counts(uuid) from anon;
grant execute on function public.follow_counts(uuid) to authenticated;

/*
  O laço entre mim e outra pessoa, nas duas direções e num objeto só.

  A tela precisa saber quatro coisas pra desenhar um botão: eu sigo? o pedido
  está esperando? essa pessoa me segue? eu bloqueei? Quatro perguntas viravam
  quatro chamadas, e entre a primeira e a última o botão piscava de "Seguir"
  pra "Solicitado".
*/
create or replace function public.follow_state(p_user uuid)
returns table (
  following boolean,
  requested boolean,
  follows_me boolean,
  blocked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.follows f
             where f.follower_id = auth.uid() and f.following_id = p_user and f.status = 'aceito'),
    exists (select 1 from public.follows f
             where f.follower_id = auth.uid() and f.following_id = p_user and f.status = 'pendente'),
    exists (select 1 from public.follows f
             where f.follower_id = p_user and f.following_id = auth.uid() and f.status = 'aceito'),
    exists (select 1 from public.blocks b
             where b.blocker_id = auth.uid() and b.blocked_id = p_user);
$$;

revoke all on function public.follow_state(uuid) from public;
revoke all on function public.follow_state(uuid) from anon;
grant execute on function public.follow_state(uuid) to authenticated;

/*
  As listas de seguidores e de seguindo.

  Elas não existiam de propósito até aqui (ver `FollowRepository`, 0060): a
  pergunta "quem pode ver essa lista" só valia a pena responder quando a tela
  existisse. Ela existe agora, e a resposta é: quem pode ver o PERFIL pode ver
  as listas dele. Perfil fechado esconde as duas, como esconde o resto.

  Bloqueado nunca aparece, nos dois sentidos.
*/
create or replace function public.follow_list(
  p_user  uuid,
  p_kind  text,
  p_after integer default 0,
  p_limit integer default 30
)
returns table (id uuid, name text, handle text, avatar_url text, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.handle, p.avatar_url, f.created_at
    from public.follows f
    join public.profiles p
      on p.id = case when p_kind = 'seguidores' then f.follower_id else f.following_id end
   where f.status = 'aceito'
     and case when p_kind = 'seguidores' then f.following_id else f.follower_id end = p_user
     and public.can_view_content_of(p_user)
     and not public.is_blocked_between(auth.uid(), p.id)
   order by f.created_at desc
  offset greatest(coalesce(p_after, 0), 0)
   limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

revoke all on function public.follow_list(uuid, text, integer, integer) from public;
revoke all on function public.follow_list(uuid, text, integer, integer) from anon;
grant execute on function public.follow_list(uuid, text, integer, integer) to authenticated;

/*
  Os pedidos esperando a minha resposta.
*/
create or replace function public.follow_requests()
returns table (id uuid, name text, handle text, avatar_url text, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.handle, p.avatar_url, f.created_at
    from public.follows f
    join public.profiles p on p.id = f.follower_id
   where f.following_id = auth.uid()
     and f.status = 'pendente'
     and not public.is_blocked_between(auth.uid(), p.id)
   order by f.created_at desc
   limit 50;
$$;

revoke all on function public.follow_requests() from public;
revoke all on function public.follow_requests() from anon;
grant execute on function public.follow_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- o calendário visual
-- ---------------------------------------------------------------------------

/*
  Um mês de dias, e o que cada um tem pra mostrar.

  A capa é a publicação MAIS RECENTE do dia (`distinct on`), e `total` diz
  quantas existem, que é o ponto de "vários registros" na célula. Sem a
  contagem, o calendário mostraria uma foto e esconderia as outras sem avisar.

  O álbum manual (`day_photos`, 0060) continua valendo e entra como reserva: um
  dia sem publicação e com foto guardada continua ilustrado. Foi assim que o
  calendário nasceu, e apagar isso jogaria fora o que as pessoas já guardaram.
  A publicação ganha do álbum quando os dois existem — ela é o registro que
  tem legenda, objetivo e conversa em volta.

  Dia sem foto nenhuma não vem daqui: quem sabe se houve movimento é o cliente,
  que já tem atividade, hábito e ação carregados. Perguntar isso ao banco de
  novo seria uma segunda conta de "esse dia andou", divergindo da primeira.
*/
create or replace function public.profile_calendar(
  p_user uuid,
  p_from date,
  p_to   date
)
returns table (
  day        date,
  post_id    uuid,
  cover_path text,
  total      bigint,
  from_album boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with visiveis as (
    select po.id, po.day, po.created_at
      from public.posts po
     where po.user_id = p_user
       and po.day between p_from and p_to
  ),
  capa as (
    select distinct on (v.day) v.day, v.id, v.created_at
      from visiveis v
     order by v.day, v.created_at desc
  ),
  contagem as (
    select v.day, count(*) as total from visiveis v group by v.day
  )
  select
    c.day,
    c.id,
    (select m.path from public.post_media m where m.post_id = c.id order by m.position limit 1),
    n.total,
    false
  from capa c
  join contagem n on n.day = c.day

  union all

  select d.day, null::uuid, d.path, 0::bigint, true
    from public.day_photos d
   where d.user_id = p_user
     and d.day between p_from and p_to
     and not exists (select 1 from capa c where c.day = d.day);
$$;

revoke all on function public.profile_calendar(uuid, date, date) from public;
revoke all on function public.profile_calendar(uuid, date, date) from anon;
grant execute on function public.profile_calendar(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- comentários
-- ---------------------------------------------------------------------------

/*
  Do mais antigo pro mais novo, ao contrário do feed.

  Comentário é conversa, e conversa se lê na ordem em que aconteceu. O cursor
  anda pra frente (`p_after`), e a tela carrega o começo e vai descendo.
*/
create or replace function public.post_comments_page(
  p_post  uuid,
  p_after timestamptz default null,
  p_limit integer default 20
)
returns table (
  id         uuid,
  user_id    uuid,
  body       text,
  created_at timestamptz,
  name       text,
  handle     text,
  avatar_url text,
  mine       boolean,
  can_delete boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.user_id,
    c.body,
    c.created_at,
    p.name,
    p.handle,
    p.avatar_url,
    c.user_id = auth.uid(),
    c.user_id = auth.uid() or public.owns_post(c.post_id)
  from public.post_comments c
  join public.profiles p on p.id = c.user_id
 where c.post_id = p_post
   and (p_after is null or c.created_at > p_after)
 order by c.created_at
 limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.post_comments_page(uuid, timestamptz, integer) from public;
revoke all on function public.post_comments_page(uuid, timestamptz, integer) from anon;
grant execute on function public.post_comments_page(uuid, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------

/*
  A bandeja: uma linha por pessoa que tem story no ar.

  O próprio usuário NÃO sai daqui. Ele é o primeiro item da bandeja na tela, e
  o estado dele ("tenho story?" / "adicionar") a tela já sabe sem perguntar: a
  linha própria vem por esta mesma função quando existe, e quando não existe o
  primeiro item é o botão de adicionar.

  `unseen` é o anel. Ele compara a contagem de stories vivos com a de vistos, e
  não "o mais recente foi visto": com dois stories e só o segundo visto, a
  segunda leitura diria que está tudo visto e o primeiro sumiria sem ser
  aberto.
*/
create or replace function public.stories_tray()
returns table (
  user_id    uuid,
  name       text,
  handle     text,
  avatar_url text,
  total      bigint,
  unseen     bigint,
  latest     timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.user_id,
    p.name,
    p.handle,
    p.avatar_url,
    count(*),
    count(*) filter (
      where not exists (
        select 1 from public.story_views v
         where v.story_id = s.id and v.viewer_id = auth.uid()
      )
    ),
    max(s.created_at)
  from public.stories s
  join public.profiles p on p.id = s.user_id
 where s.expires_at > now()
 group by s.user_id, p.name, p.handle, p.avatar_url
 order by max(s.created_at) desc
 limit 50;
$$;

revoke all on function public.stories_tray() from public;
revoke all on function public.stories_tray() from anon;
grant execute on function public.stories_tray() to authenticated;

create or replace function public.stories_of(p_user uuid)
returns table (
  id         uuid,
  user_id    uuid,
  path       text,
  kind       public.story_media,
  caption    text,
  width      integer,
  height     integer,
  created_at timestamptz,
  expires_at timestamptz,
  seen       boolean,
  views      bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id, s.user_id, s.path, s.kind, s.caption, s.width, s.height,
    s.created_at, s.expires_at,
    exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
    -- Quantos viram só interessa (e só é legível) pro dono; pra visitante a
    -- RLS de `story_views` devolve zero, e o card não mostra o número.
    (select count(*) from public.story_views v where v.story_id = s.id)
  from public.stories s
 where s.user_id = p_user
   and (s.expires_at > now() or s.user_id = auth.uid())
 order by s.created_at
 limit 30;
$$;

revoke all on function public.stories_of(uuid) from public;
revoke all on function public.stories_of(uuid) from anon;
grant execute on function public.stories_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- quem seguir
-- ---------------------------------------------------------------------------

/*
  Gente de verdade, e só.

  Perfis PÚBLICOS que a pessoa ainda não segue, não bloqueou e que não são ela
  mesma, dos que publicaram mais recentemente. Não existe conta de fábrica, não
  existe perfil de exemplo e não existe número inflado: feed vazio com três
  perfis inventados é pior que feed vazio, porque o primeiro toque revela a
  mentira.

  A ordem é a última publicação, e não a contagem de seguidores: "quem tem mais
  seguidores" é a tabela de classificação que o produto recusa, montada por
  outro nome.
*/
create or replace function public.suggested_profiles(p_limit integer default 8)
returns table (
  id          uuid,
  name        text,
  handle      text,
  avatar_url  text,
  bio         text,
  last_post   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.handle, p.avatar_url, p.bio, max(po.created_at)
    from public.profiles p
    join public.posts po on po.user_id = p.id and po.visibility = 'seguidores'
   where p.profile_visibility = 'publico'
     and p.id <> auth.uid()
     and not exists (
       select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = p.id
     )
     and not public.is_blocked_between(auth.uid(), p.id)
   group by p.id, p.name, p.handle, p.avatar_url, p.bio
   order by max(po.created_at) desc
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.suggested_profiles(integer) from public;
revoke all on function public.suggested_profiles(integer) from anon;
grant execute on function public.suggested_profiles(integer) to authenticated;

/*
  A busca por @ da 0012, agora sem quem me bloqueou.

  O resto continua igual: igualdade exata (nunca `like`), só o cartão de visita,
  e revoke explícito ao `anon`.
*/
create or replace function public.find_profile_by_handle(target_handle text)
returns table (id uuid, name text, handle text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.handle, p.avatar_url
    from public.profiles p
   where lower(p.handle) = lower(btrim(target_handle))
     and p.id <> auth.uid()
     and not public.is_blocked_between(auth.uid(), p.id)
   limit 1;
$$;

revoke all on function public.find_profile_by_handle(text) from public;
revoke all on function public.find_profile_by_handle(text) from anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;

-- ---------------------------------------------------------------------------
-- recomeçar do zero leva a camada social junto
-- ---------------------------------------------------------------------------

/*
  A função da 0060, com as tabelas novas.

  O que a pessoa PUBLICOU some, e some com as curtidas e comentários que
  recebeu (cascata da publicação). O que ela deixou na publicação de outra
  pessoa também sai: é conteúdo dela, e "recomeçar" não pode deixar rastro
  dela no perfil alheio.

  O que FICA: quem segue quem, e os bloqueios. Recomeçar é sobre o que você
  registrou, não sobre quem te acompanha — e menos ainda sobre quem você
  decidiu não querer por perto.
*/
create or replace function public.reset_my_data()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.record_audit('conta.recomecar', 'account', quem::text, 'ok', '{}'::jsonb);

  -- A camada social primeiro: publicação leva mídia, curtida e comentário
  -- junto por cascata, e o que ela deixou em publicação alheia sai à mão.
  delete from public.post_comments where user_id = quem;
  delete from public.post_likes    where user_id = quem;
  delete from public.saved_posts   where user_id = quem;
  delete from public.stories       where user_id = quem;
  delete from public.story_views   where viewer_id = quem;
  delete from public.posts         where user_id = quem;

  delete from public.challenge_participants where user_id = quem;
  delete from public.challenges where owner_id = quem;
  delete from public.journey_event_supports where user_id = quem;
  delete from public.journey_events where user_id = quem;

  delete from public.tasks where user_id = quem;
  delete from public.objectives where user_id = quem;
  delete from public.goals where user_id = quem;
  delete from public.habits where user_id = quem;
  delete from public.activities where user_id = quem;
  delete from public.check_ins where user_id = quem;
  delete from public.wins where user_id = quem;
  delete from public.weekly_reviews where user_id = quem;

  -- A rotina (0064). As ocorrências caem com o item, pela cascata.
  delete from public.routine_items where user_id = quem;

  delete from public.activity_types where user_id = quem;

  delete from public.xp_transactions where user_id = quem;
  delete from public.user_achievements where user_id = quem;
  delete from public.user_evolution where user_id = quem;

  delete from public.day_photos where user_id = quem;

  -- Os dois buckets. Mesmo contrato da exclusão: o cliente já limpa pela API
  -- antes, e aqui é a garantia caso o storage aceite.
  begin
    delete from storage.objects
     where bucket_id in ('user-media', 'social-media')
       and (storage.foldername(name))[1] = quem::text;
  exception
    when others then
      raise warning 'reset_my_data: storage recusou apagar a pasta de % (%).', quem, sqlerrm;
  end;
end;
$$;

revoke all on function public.reset_my_data() from public;
revoke all on function public.reset_my_data() from anon;
grant execute on function public.reset_my_data() to authenticated;
