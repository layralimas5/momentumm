-- Momentumm — a camada social subiu inteira?
--
-- Rodar no SQL Editor DEPOIS de `aplicar-0067-0068.sql`. É uma consulta só, de
-- leitura, e o resultado cabe numa linha: `veredito` diz se está tudo no lugar,
-- e as outras colunas dizem o que faltou quando não está.
--
-- A ordem das checagens é a ordem do risco. As três primeiras são de
-- SEGURANÇA, e uma delas passando pela metade é o tipo de coisa que não aparece
-- como erro na tela e só dá notícia quando o conteúdo de alguém já foi visto:
--
--   função de autorização faltando  → a política que a chama explode ou libera
--   RLS desligada numa tabela nova  → a tabela inteira fica legível
--   bucket público                  → a foto sai por URL, sem passar por regra

select
  case
    when t.tabelas < 10                    then 'INCOMPLETA: faltam tabelas da camada social'
    when t.sem_rls > 0                     then 'PERIGO: tabela social sem RLS ligada'
    when f.autorizacao < 5                 then 'PERIGO: falta função de autorização'
    when b.bucket = 0                      then 'INCOMPLETA: o bucket social-media não existe'
    when b.publico                         then 'PERIGO: o bucket social-media está PÚBLICO'
    when p.storage < 4                     then 'INCOMPLETA: faltam políticas do bucket'
    when f.leitura < 14                    then 'INCOMPLETA: faltam funções de leitura (0068)'
    when c.status = 0                      then 'INCOMPLETA: follows não ganhou a coluna status'
    when g.guarda_status = 0               then 'PERIGO: follows tem status e NÃO tem o trigger que o decide'
    when g.contagem < 2                    then 'INCOMPLETA: faltam os triggers de contagem'
    when g.bloqueio = 0                    then 'INCOMPLETA: falta o trigger que o bloqueio usa pra cortar o laço'
    when pr.perfil = 0                     then 'PERIGO: a política de SELECT de profiles sumiu'
    when a.anonimo > 0                     then 'PERIGO: existe política social valendo pro papel anônimo'
    else 'OK — a camada social está inteira'
  end as veredito,
  t.tabelas          as tabelas_de_10,
  t.sem_rls          as tabelas_sem_rls,
  f.autorizacao      as funcoes_de_autorizacao_de_5,
  f.leitura          as funcoes_de_leitura_de_14,
  b.bucket           as bucket_existe,
  b.publico          as bucket_publico,
  p.storage          as politicas_do_bucket_de_4,
  p.sociais          as politicas_das_tabelas_sociais,
  c.status           as follows_tem_status,
  c.pendentes        as follows_pendentes,
  c.aceitos          as follows_aceitos,
  g.guarda_status    as trigger_do_status,
  g.contagem         as triggers_de_contagem_de_2,
  g.bloqueio         as trigger_do_bloqueio,
  a.anonimo          as politicas_pro_anonimo
from
  -- As dez tabelas novas, e quantas estão sem RLS.
  (select
     count(*) filter (where c.relname in (
       'posts', 'post_media', 'post_likes', 'post_comments', 'saved_posts',
       'stories', 'story_views', 'blocks', 'reports', 'follows'
     )) as tabelas,
     count(*) filter (where c.relname in (
       'posts', 'post_media', 'post_likes', 'post_comments', 'saved_posts',
       'stories', 'story_views', 'blocks', 'reports'
     ) and not c.relrowsecurity) as sem_rls
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r') t,

  -- As funções, separadas pelo que elas fazem.
  (select
     count(*) filter (where p.proname in (
       'can_view_content_of', 'can_view_post', 'can_read_social_file',
       'is_blocked_between', 'owns_post'
     )) as autorizacao,
     count(*) filter (where p.proname in (
       'post_cards', 'post_card', 'feed_page', 'profile_posts_page',
       'posts_of_day', 'profile_stats', 'follow_state', 'follow_list',
       'follow_requests', 'profile_calendar', 'post_comments_page',
       'stories_tray', 'stories_of', 'suggested_profiles'
     )) as leitura
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public') f,

  -- O bucket, e o que mais importa nele.
  (select
     count(*) as bucket,
     coalesce(bool_or(public), false) as publico
     from storage.buckets where id = 'social-media') b,

  -- As políticas: as do bucket e as das tabelas novas.
  (select
     count(*) filter (where c.relname = 'objects' and pol.polname like 'social-media:%') as storage,
     count(*) filter (where c.relname in (
       'posts', 'post_media', 'post_likes', 'post_comments', 'saved_posts',
       'stories', 'story_views', 'blocks', 'reports'
     )) as sociais
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid) p,

  -- A coluna nova de follows, e o retrato que a migration deixou.
  (select
     (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'follows' and column_name = 'status') as status,
     (select count(*) from public.follows where status = 'pendente') as pendentes,
     (select count(*) from public.follows where status = 'aceito') as aceitos) c,

  -- Os gatilhos. O do status é o que impede o cliente de se auto-aprovar.
  (select
     count(*) filter (where t.tgname = 'follows_status_guard') as guarda_status,
     count(*) filter (where t.tgname in ('post_likes_count', 'post_comments_count')) as contagem,
     count(*) filter (where t.tgname = 'blocks_cut_follows') as bloqueio
     from pg_trigger t where not t.tgisinternal) g,

  -- A política de perfil continua de pé (a 0067 a substitui, não a apaga).
  (select count(*) as perfil
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
    where c.relname = 'profiles' and pol.polcmd = 'r') pr,

  -- Nenhuma política social pode valer pro anônimo (a lição da 0021).
  (select count(*) as anonimo
     from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_roles r on r.oid = any (pol.polroles)
    where c.relname in (
      'posts', 'post_media', 'post_likes', 'post_comments', 'saved_posts',
      'stories', 'story_views', 'blocks', 'reports'
    ) and r.rolname in ('anon', 'public')) a;
