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
