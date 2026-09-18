-- Momentumm — arquiva os hábitos que o construtor de plano criava sozinho.
--
-- Até a mudança no app (plan-builder deixou de gerar hábito), todo objetivo
-- criado pela ativação nascia com um hábito do tipo "Trabalhar pra <objetivo>"
-- ou "Dedicar tempo a <área>" (ou, nos eixos de fábrica, "Ler todo dia",
-- "Estudar todo dia", "Treinar", "Sentar pra respirar"), ligado ao objetivo.
-- Eram o mesmo objetivo com outro nome na tela de Hábitos.
--
-- Este script ARQUIVA (não apaga) esses hábitos em todas as contas: os logs
-- ficam guardados e o hábito some da tela. Rodar uma vez no SQL Editor,
-- como postgres/service role, depois de publicar o app.
--
-- Pra ver o que vai ser arquivado antes, rode só o SELECT do final.

update public.habits h
   set archived_at = now()
 where h.archived_at is null
   and h.objective_id is not null
   and (
        h.name like 'Trabalhar pra %'
     or h.name like 'Dedicar tempo a %'
     or h.name in ('Ler todo dia', 'Estudar todo dia', 'Treinar', 'Sentar pra respirar')
   );

-- Conferência: o que sobrou ativo por conta.
select h.user_id, count(*) as habitos_ativos, array_agg(h.name order by h.name) as nomes
  from public.habits h
 where h.archived_at is null
 group by h.user_id;
