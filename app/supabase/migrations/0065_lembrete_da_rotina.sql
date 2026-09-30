-- ===========================================================================
-- 0065 — Lembrete por item da rotina
-- ===========================================================================
--
-- A 0064 guardou `reminder_min` e disse em voz alta que ele não disparava. Esta
-- migration liga o disparo, e ela é pequena de propósito: a infraestrutura de
-- push já existe desde a 0050/0056 (`pg_cron` de hora em hora → Edge Function
-- `push-reminders` → `notifications_due()` → `mark_notification_sent`). O que
-- faltava era um tipo e uma consulta.
--
-- ## O lembrete de rotina é diferente dos outros seis
--
-- Os outros perguntam "por que abrir o app agora" e saem no máximo um por dia,
-- com cooldown de vinte horas por tipo. Este é um COMPROMISSO com hora marcada:
-- "treino em 10 minutos". Ele não compete com os outros, e por isso:
--
--   - sai por ITEM, não por pessoa: dois compromissos no mesmo dia mandam dois
--   - não entra na cota `max_per_day` dos outros tipos, e nem a consome
--   - só sai uma vez por item por dia (`notification_log` com a mesma chave)
--   - só sai se o item continua PENDENTE: quem já treinou não é lembrado de
--     treinar, que é o aviso que ensina a ignorar todos os outros
--
-- ## Por que esta migration só adiciona o valor do enum
--
-- Um valor novo de enum não pode ser USADO na mesma transação em que nasce, e
-- o Postgres recusa até o literal dentro do corpo de uma função (`unsafe use of
-- new value`). Então o valor entra sozinho aqui e a 0066 traz a consulta, o
-- carimbo e a coluna. É a mesma lição da 0011, que precisou dos quatro valores
-- novos do enum de evento fora da migration que os usava.
-- ===========================================================================

alter type public.notification_type add value if not exists 'rotina';

alter type public.notification_type add value if not exists 'rotina';
