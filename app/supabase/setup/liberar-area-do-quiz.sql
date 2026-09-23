-- Destravar a ativação do plano do quiz — pelo SQL Editor, sem console.
--
-- O sintoma: a tela "Não consegui ativar seu plano" com "Você já tem um
-- objetivo ativo nessa área", e nenhum caminho pra sair dela. A casca do app
-- manda pra tela de ativação enquanto houver plano do quiz guardado no
-- navegador, então cada tentativa volta pro mesmo lugar.
--
-- A causa é a regra da 0003: um objetivo ativo por área (`axis_slug`). O plano
-- do quiz quer uma área que já tem dono.
--
-- ## Duas saídas, e esta é a boa
--
-- Apagar o plano do quiz no navegador resolve, mas você PERDE o plano. Aqui a
-- gente libera a área: na próxima vez que o app abrir, a ativação encontra o
-- caminho livre, grava o plano e te leva pro Hoje. Você entra COM o plano que
-- respondeu.
--
-- ## Sem copiar uuid
--
-- A regra do banco garante UM objetivo ativo por área. Então dizer a área já
-- identifica a linha — não precisa de id. Você lê a área no BLOCO 1 e escreve
-- ela no BLOCO 2, e o próprio bloco mostra o que vai mudar antes de mudar.
--
-- Rode um bloco por vez. Troque o e-mail em todos.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — O que está ocupando o quê.
-- ---------------------------------------------------------------------------

-- 1a. A área que você escolheu no quiz (a primeira de `areas` é a principal).
select
  s.entered_at,
  s.status,
  s.answers -> 'areas'   as areas_escolhidas,
  s.answers ->> 'goal'   as objetivo_escrito,
  s.activated_at         as ja_ativou
from public.quiz_sessions s
join auth.users u on u.id = s.user_id
where u.email = 'TROQUE@PELO.SEU.EMAIL'
order by s.entered_at desc
limit 5;

-- 1b. Seus objetivos, com a ÁREA de cada um.
--
-- A coluna `area` é a que interessa: é ela que você vai escrever no BLOCO 2.
-- A área do quiz ('saude', 'carreira'…) nem sempre tem o mesmo nome do eixo
-- do objetivo ('treino', 'leitura', 'estudo', 'meditacao', ou um que você
-- criou) — então olhe pelo TÍTULO qual é o objetivo que faz par com o plano
-- novo, e use a área daquela linha.
select
  o.title      as titulo,
  o.axis_slug  as area,
  o.started_on,
  o.deadline,
  case
    when o.completed_at is not null then 'concluído'
    when o.archived_at is not null  then 'arquivado'
    else 'ATIVO — ocupa a área'
  end          as situacao
from public.objectives o
join auth.users u on u.id = o.user_id
where u.email = 'TROQUE@PELO.SEU.EMAIL'
order by (o.archived_at is null and o.completed_at is null) desc, o.started_on desc;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — Conferir antes de mexer. TROQUE a área.
-- ---------------------------------------------------------------------------
--
-- Escreva no lugar de NOME-DA-AREA o valor da coluna `area` do BLOCO 1b —
-- por exemplo 'treino'. Esta consulta NÃO muda nada: ela só mostra qual linha
-- o BLOCO 3 vai pegar. Se vier vazia ou vier mais de uma, pare e me chame.

select o.title as vai_ser_liberado, o.axis_slug as area, o.started_on
  from public.objectives o
  join auth.users u on u.id = o.user_id
 where u.email = 'TROQUE@PELO.SEU.EMAIL'
   and o.axis_slug = 'NOME-DA-AREA'
   and o.archived_at is null;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — Liberar. Escolha UMA das duas.
-- ---------------------------------------------------------------------------
--
-- Nenhuma das duas apaga nada: ações, histórico e progresso continuam no
-- banco. Muda só o que o app mostra depois.

-- Opção A — ARQUIVAR: o objetivo sai do dia e some das listas ativas.
update public.objectives o
   set archived_at = now()
  from auth.users u
 where u.id = o.user_id
   and u.email = 'TROQUE@PELO.SEU.EMAIL'
   and o.axis_slug = 'NOME-DA-AREA'
   and o.archived_at is null;

-- Opção B — CONCLUIR: entra pro histórico como cumprido.
-- update public.objectives o
--    set completed_at = now(), archived_at = now()
--   from auth.users u
--  where u.id = o.user_id
--    and u.email = 'TROQUE@PELO.SEU.EMAIL'
--    and o.axis_slug = 'NOME-DA-AREA'
--    and o.archived_at is null;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — Conferir e voltar pro app.
-- ---------------------------------------------------------------------------

select o.title, o.axis_slug as area,
       case when o.archived_at is null then 'ainda ativo' else 'liberado' end as situacao
  from public.objectives o
  join auth.users u on u.id = o.user_id
 where u.email = 'TROQUE@PELO.SEU.EMAIL'
 order by o.archived_at nulls first;

-- Agora recarregue o app. A ativação roda sozinha, grava o plano do quiz e te
-- leva pro Hoje.
--
-- Pra DESFAZER, enquanto o plano do quiz ainda não entrou:
--   update public.objectives o
--      set archived_at = null, completed_at = null
--     from auth.users u
--    where u.id = o.user_id
--      and u.email = 'TROQUE@PELO.SEU.EMAIL'
--      and o.axis_slug = 'NOME-DA-AREA';
--
-- Depois que o plano do quiz entrar, desfazer recria o conflito: as duas
-- voltam a disputar a mesma área.
