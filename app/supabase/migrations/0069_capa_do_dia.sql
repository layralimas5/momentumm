-- Momentumm — toda foto publicada vira a capa do dia dela.
--
-- A 0068 escolhia a capa do calendário como "a publicação mais recente do
-- dia", e tomava o caminho da primeira foto DELA. A consequência aparecia numa
-- sequência banal:
--
--   09:00  publica a foto do treino     → o dia 12 mostra a foto
--   21:00  publica "fechei a semana"    → o dia 12 fica CINZA
--
-- A segunda publicação não tinha foto, virou a capa por ser a mais recente, e
-- levou junto a memória do dia. Quem registrou perdeu a foto do calendário por
-- ter escrito uma linha à noite, e não há nada na tela que explique isso.
--
-- A capa passa a ser **a publicação mais recente QUE TEM foto**. A contagem
-- continua contando todas (o dia segue dizendo que teve duas coisas dentro), e
-- o que a célula abre continua sendo o dia inteiro.
--
-- ## O álbum manual entra onde a publicação não alcança
--
-- Antes, a foto guardada sem publicar (`day_photos`, 0060) só aparecia em dia
-- SEM publicação nenhuma. Agora ela aparece sempre que o dia não tem foto
-- publicada — inclusive num dia que teve publicação só de texto. É uma foto
-- daquele dia, e o calendário existe pra mostrar foto daquele dia.
--
-- `from_album` continua dizendo de onde a IMAGEM veio (é o que decide qual
-- bucket assina o link), e `post_id` continua dizendo o que a célula abre. Os
-- dois deixaram de andar juntos, e é justamente essa separação que permite um
-- dia ter publicação de texto e imagem do álbum ao mesmo tempo.

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
  /* A capa: a mais recente COM foto. É a única mudança que importa aqui. */
  com_foto as (
    select distinct on (v.day)
           v.day,
           v.id,
           (select m.path from public.post_media m where m.post_id = v.id order by m.position limit 1) as path
      from visiveis v
     where exists (select 1 from public.post_media m where m.post_id = v.id)
     order by v.day, v.created_at desc
  ),
  /* O que a célula abre quando nenhuma publicação do dia tem foto. */
  qualquer as (
    select distinct on (v.day) v.day, v.id
      from visiveis v
     order by v.day, v.created_at desc
  ),
  contagem as (
    select v.day, count(*) as total from visiveis v group by v.day
  )
  select
    q.day,
    -- Abre a publicação da capa; sem capa, abre a mais recente do dia.
    coalesce(f.id, q.id),
    -- A imagem: a da publicação, ou a do álbum quando nenhuma tem foto.
    coalesce(f.path, a.path),
    n.total,
    (f.path is null and a.path is not null)
  from qualquer q
  join contagem n on n.day = q.day
  left join com_foto f on f.day = q.day
  left join public.day_photos a on a.user_id = p_user and a.day = q.day

  union all

  -- Os dias que têm foto guardada e nenhuma publicação.
  select d.day, null::uuid, d.path, 0::bigint, true
    from public.day_photos d
   where d.user_id = p_user
     and d.day between p_from and p_to
     and not exists (select 1 from qualquer q where q.day = d.day);
$$;

revoke all on function public.profile_calendar(uuid, date, date) from public;
revoke all on function public.profile_calendar(uuid, date, date) from anon;
grant execute on function public.profile_calendar(uuid, date, date) to authenticated;

/*
  O índice que a capa passou a pedir.

  `com_foto` faz um `exists` sobre `post_media` por publicação do intervalo.
  `post_media_post_idx` (0067) já cobre isso por `post_id`, e é ele que evita a
  varredura quando um mês tem trinta publicações.

  Fica registrado aqui o que NÃO foi feito: nenhuma coluna de "tem foto" em
  `posts`. Ela seria mais rápida e seria mais um número pra manter em sincronia
  por trigger, com uma forma conhecida de errar (foto apagada, coluna não
  atualizada, calendário mostrando célula quebrada). Um mês tem no máximo
  algumas dezenas de publicações; o `exists` resolve.
*/
