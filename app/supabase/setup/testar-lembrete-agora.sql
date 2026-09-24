-- Momentumm — provar o lembrete no celular, sem esperar a hora certa.
--
-- O aviso só existe quando a pessoa tem ação em aberto hoje E já faz umas
-- quatro horas que não aparece. Num teste isso nunca acontece: você acabou de
-- ligar o lembrete, então o app sabe que você está aqui e fica quieto, que é o
-- comportamento certo.
--
-- Este arquivo finge o estado que a regra pede e dispara o envio.
--
-- Ele age sobre a conta do ÚLTIMO aparelho inscrito, que é sempre o celular
-- que acabou de ligar o lembrete. Assim não precisa procurar uuid nenhum.
--
-- Rodar bloco a bloco no SQL Editor, na ordem. O celular pode estar com o app
-- FECHADO: é justamente isso que se quer provar.

-- ---------------------------------------------------------------------------
-- 1. Diagnóstico: o que a regra vê agora
-- ---------------------------------------------------------------------------

with alvo as (
  select user_id from public.push_subscriptions order by created_at desc limit 1
)
select
  (select count(*) from public.push_subscriptions s, alvo a where s.user_id = a.user_id)
    as aparelhos_inscritos,
  (select pr.timezone from public.user_presence pr, alvo a where pr.user_id = a.user_id)
    as fuso,
  (select to_char(now() at time zone pr.timezone, 'HH24:MI')
     from public.user_presence pr, alvo a where pr.user_id = a.user_id)
    as hora_local,
  (select round(extract(epoch from (now() - pr.last_active_at)) / 3600.0, 1)
     from public.user_presence pr, alvo a where pr.user_id = a.user_id)
    as horas_parada,
  (select count(*) from public.tasks t, alvo a
    where t.user_id = a.user_id
      and t.day = public.local_day_of(a.user_id)
      and t.status in ('pendente', 'em-andamento', 'adiada'))
    as acoes_em_aberto_hoje,
  (select count(*) from public.notification_log l, alvo a
    where l.user_id = a.user_id and l.day = public.local_day_of(a.user_id))
    as avisos_hoje,
  (select public.decide_notification(a.user_id) from alvo a)
    as decisao_agora;

-- Como ler:
--   aparelhos_inscritos = 0  -> o celular não ligou o lembrete. Volta pro app.
--   acoes_em_aberto_hoje = 0 -> cria uma ação pra hoje no app e roda de novo.
--   hora_local fora de 08:00–21:30 -> a regra cala de propósito. Testa amanhã.
--   decisao_agora = null com tudo acima ok -> é a inatividade. Segue pro 2.

-- ---------------------------------------------------------------------------
-- 2. Fingir que você sumiu faz cinco horas
-- ---------------------------------------------------------------------------
--
-- Mexe só no carimbo de presença e apaga o registro de aviso de hoje. Não
-- toca em ação, hábito, objetivo nem em nada que você veja na tela.

with alvo as (
  select user_id from public.push_subscriptions order by created_at desc limit 1
)
update public.user_presence pr
   set last_active_at = now() - interval '5 hours'
  from alvo a
 where pr.user_id = a.user_id;

with alvo as (
  select user_id from public.push_subscriptions order by created_at desc limit 1
)
delete from public.notification_log l
 using alvo a
 where l.user_id = a.user_id
   and l.day = public.local_day_of(a.user_id);

-- Confere que agora existe aviso a mandar (tem que voltar 'proximo_passo',
-- ou 'dia_dificil' se já passou das 18h locais):
select public.decide_notification(
  (select user_id from public.push_subscriptions order by created_at desc limit 1)
) as decisao_depois;

-- ---------------------------------------------------------------------------
-- 3. Mandar agora
-- ---------------------------------------------------------------------------
--
-- É o mesmo caminho do robô de hora em hora: banco -> Edge Function -> push.

select public.call_push_reminders();

-- Espera uns 3 segundos e roda isto. `status_code` 200 com "sent":1 quer
-- dizer que o aviso saiu pro teu celular.
select status_code, content, created
  from net._http_response
 order by created desc
 limit 1;

-- ---------------------------------------------------------------------------
-- 4. Depois de tocar na notificação
-- ---------------------------------------------------------------------------
--
-- O clique abre o Hoje e o app carimba a abertura sozinho. Aqui dá pra ver se
-- o laço inteiro fechou: enviado -> aberto -> avançou.

select type, sent_at, opened_at, converted_at
  from public.notification_log
 order by sent_at desc
 limit 5;
