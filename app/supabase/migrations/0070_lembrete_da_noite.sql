-- Momentumm — o lembrete da rotina para de sumir depois das 22h45.
--
-- A 0066 monta a janela do lembrete somando minutos a um `time`:
--
--   agora >= (hora - lembrete)
--   agora <  (hora - lembrete) + 75 minutos
--
-- `time` do Postgres NÃO tem dia, então a soma **dá a volta na meia-noite**.
-- Pra um compromisso das 22:58 com lembrete de 10 minutos:
--
--   limite de baixo  22:48
--   limite de cima   22:48 + 75min = 24:03  →  vira 00:03
--
-- E aí a condição vira `agora >= 22:48 AND agora < 00:03`, que é falsa pra
-- qualquer hora do dia. O resultado, em produção: **nenhum lembrete marcado
-- depois de mais ou menos 22h45 jamais disparou**, e nada na tela dizia isso.
-- O item continuava lá, com o sino ligado, e a notificação simplesmente não
-- chegava.
--
-- O mesmo vale do outro lado: um compromisso das 00:05 com lembrete de 10
-- minutos tem limite de baixo às 23:55, e a janela cruza a meia-noite de novo.
--
-- ## A correção
--
-- A comparação passa a ser em MINUTOS DESDE A MEIA-NOITE, com a distância
-- medida pra frente em aritmética modular:
--
--   ((agora - inicio + 1440) % 1440) < janela
--
-- Isso responde "faz quanto tempo que o lembrete venceu, dando a volta no dia
-- se preciso", e é verdade nas duas pontas sem caso especial. É a mesma conta
-- que o relógio faz, e por isso ela não tem borda.
--
-- ## A regra vira uma função própria, e é ela que o teste cobra
--
-- `minutes_ahead(de, para)` responde "quantos minutos faltam de um horário pro
-- outro, dando a volta no dia". Ela é `immutable` e não lê relógio nenhum, o
-- que permite provar as bordas com números fixos em vez de esperar dar 22h48
-- pra descobrir o bug — que foi exatamente como ele sobreviveu até agora.
--
-- ## O que isso NÃO muda
--
-- As outras três condições continuam iguais: o item cai hoje pela recorrência,
-- quem já fez ou pulou não é lembrado, e cada item avisa uma vez por dia. A
-- assinatura da função também: o agendador continua chamando do mesmo jeito.

/**
 * Quantos minutos faltam de um horário do dia pro outro, pela volta do
 * relógio. Os dois vêm em minutos desde a meia-noite.
 *
 * `immutable` e sem relógio: é o que torna a regra provável com números fixos.
 * De 23:50 (1430) pras 00:10 (10) são 20 minutos, não menos 1420.
 */
create or replace function public.minutes_ahead(p_from integer, p_to integer)
returns integer
language sql
immutable
as $$
  select ((coalesce(p_to, 0) - coalesce(p_from, 0)) % 1440 + 1440) % 1440;
$$;

comment on function public.minutes_ahead(integer, integer) is
  'Distância em minutos pela frente, dando a volta na meia-noite.';

create or replace function public.routine_reminders_due(p_window_min integer default 75)
returns table (
  subscription_id uuid,
  user_id         uuid,
  endpoint        text,
  p256dh          text,
  auth            text,
  first_name      text,
  item_id         uuid,
  title           text,
  minutes_left    integer
)
language sql
security definer
set search_path = public
stable
as $$
  with pessoas as (
    select
      s.id as subscription_id,
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth,
      split_part(p.name, ' ', 1) as first_name,
      coalesce(pr.timezone, 'America/Sao_Paulo') as tz
    from public.push_subscriptions s
    join public.user_presence pr on pr.user_id = s.user_id
    join public.profiles p on p.id = s.user_id
   where s.failed_at is null
  ),
  agenda as (
    select
      q.*,
      (now() at time zone q.tz)::date as hoje_local,
      (now() at time zone q.tz)::time as agora_local,
      i.id as item_id,
      i.title,
      i.time_of_day,
      i.reminder_min,
      /*
        Tudo em minutos desde a meia-noite. É o que tira a borda: `time` não
        tem dia, então somar minutos a ele é a operação que estava errada.
      */
      (extract(epoch from (now() at time zone q.tz)::time) / 60)::integer as agora_min,
      (
        ((extract(epoch from i.time_of_day::time) / 60)::integer - i.reminder_min) % 1440 + 1440
      ) % 1440 as aviso_min,
      (extract(epoch from i.time_of_day::time) / 60)::integer as hora_min
    from pessoas q
    join public.routine_items i on i.user_id = q.user_id
   where i.archived_at is null
     and i.paused_at is null
     and i.time_of_day is not null
     and i.reminder_min is not null
  )
  select
    a.subscription_id,
    a.user_id,
    a.endpoint,
    a.p256dh,
    a.auth,
    a.first_name,
    a.item_id,
    a.title,
    /*
      Quanto falta pro compromisso, também pela volta do relógio: às 23:50, um
      item das 00:10 falta dez minutos, não menos mil e quatrocentos.
    */
    public.minutes_ahead(a.agora_min, a.hora_min) as minutes_left
  from agenda a
  where
    -- o item cai hoje, pela mesma regra de recorrência do app
    (
      case
        when exists (
          select 1 from public.routine_items r
           where r.id = a.item_id and r.recurrence = 'unica' and r.day = a.hoje_local
        ) then true
        when exists (
          select 1 from public.routine_items r
           where r.id = a.item_id
             and r.recurrence = 'diario'
        ) then true
        when exists (
          select 1 from public.routine_items r
           where r.id = a.item_id
             and r.recurrence = 'dias-semana'
             and extract(dow from a.hoje_local)::smallint = any (r.weekdays)
        ) then true
        when exists (
          select 1 from public.routine_items r
           where r.id = a.item_id
             and r.recurrence = 'uteis'
             and extract(isodow from a.hoje_local) between 1 and 5
        ) then true
        when exists (
          select 1 from public.routine_items r
           where r.id = a.item_id
             and r.recurrence = 'fim-semana'
             and extract(isodow from a.hoje_local) in (6, 7)
        ) then true
        else false
      end
    )
    -- a hora do lembrete chegou e não faz mais que a janela do cron, dando a
    -- volta na meia-noite quando a janela atravessa o dia
    and public.minutes_ahead(a.aviso_min, a.agora_min) < greatest(1, p_window_min)
    -- quem já fez, pulou ou reagendou não é lembrado
    and not exists (
      select 1 from public.routine_occurrences o
       where o.item_id = a.item_id
         and o.day = a.hoje_local
         and o.status <> 'pendente'
    )
    -- e cada item avisa uma vez por dia
    and not exists (
      select 1 from public.notification_log l
       where l.user_id = a.user_id
         and l.type = 'rotina'
         and l.day = a.hoje_local
         and l.entity_id = a.item_id
    );
$$;

revoke all on function public.routine_reminders_due(integer) from public;
revoke all on function public.routine_reminders_due(integer) from anon;
revoke all on function public.routine_reminders_due(integer) from authenticated;
grant execute on function public.routine_reminders_due(integer) to service_role;

revoke all on function public.minutes_ahead(integer, integer) from public;
revoke all on function public.minutes_ahead(integer, integer) from anon;
grant execute on function public.minutes_ahead(integer, integer) to authenticated, service_role;
