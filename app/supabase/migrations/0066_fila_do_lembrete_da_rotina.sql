-- ===========================================================================
-- 0066 — A fila do lembrete da rotina
-- ===========================================================================
--
-- A 0065 só criou o valor `rotina` no enum, porque o Postgres recusa usá-lo na
-- mesma transação em que ele nasce. Aqui vem o resto: a consulta que diz o que
-- está pra vencer, a coluna que guarda QUAL item foi avisado e o carimbo.
--
-- A infraestrutura de push já existe desde a 0050/0056 (`pg_cron` de hora em
-- hora → Edge Function `push-reminders`). O lembrete de rotina entra por fora
-- da cota dos outros seis tipos, porque ele é outra coisa: os outros perguntam
-- "por que abrir o app agora" e saem no máximo um por dia; este é um
-- COMPROMISSO com hora marcada, e dois compromissos no mesmo dia mandam dois.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- qual item foi avisado
-- ---------------------------------------------------------------------------

/*
  `notification_log` guardava uma linha por (pessoa, tipo, dia), o que basta pros
  seis tipos que saem no máximo uma vez ao dia. O lembrete de rotina sai por
  ITEM, então a linha precisa dizer qual: sem a coluna, o primeiro compromisso
  do dia calaria todos os outros.

  Ela vem antes da função porque a função a consulta.
*/
alter table public.notification_log
  add column if not exists entity_id uuid;

create unique index if not exists notification_log_rotina_unica
  on public.notification_log (user_id, day, entity_id)
  where type = 'rotina';

-- ---------------------------------------------------------------------------
-- o que está pra vencer
-- ---------------------------------------------------------------------------

/*
  Os itens de rotina com lembrete cuja hora está chegando.

  A conta é toda no fuso de quem recebe (`user_presence.timezone`), como no
  resto do sistema de aviso: o "18:20" de quem mora em Manaus não é o mesmo
  instante do de quem mora em Lisboa, e um lembrete uma hora atrasado é pior
  que nenhum.

  A janela é de `p_window_min` minutos pra trás, porque o cron roda de hora em
  hora: sem ela, só receberia aviso quem tivesse o compromisso no minuto exato
  em que a função rodou.
*/
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
      i.reminder_min
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
    greatest(
      0,
      (extract(epoch from (a.time_of_day::time - a.agora_local)) / 60)::integer
    ) as minutes_left
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
    -- a hora do lembrete chegou, e não faz mais que a janela do cron
    and a.agora_local >= (a.time_of_day::time - make_interval(mins => a.reminder_min))
    and a.agora_local < (a.time_of_day::time - make_interval(mins => a.reminder_min)
                         + make_interval(mins => p_window_min))
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

-- ---------------------------------------------------------------------------
-- o carimbo, por item
-- ---------------------------------------------------------------------------

/*
  `notification_log` guardava uma linha por (pessoa, tipo, dia), o que basta pros
  seis tipos que saem no máximo uma vez ao dia. O lembrete de rotina sai por
  item, então a linha precisa dizer QUAL item: sem a coluna, o primeiro
  compromisso do dia calaria todos os outros.
*/
create or replace function public.mark_routine_reminder_sent(
  p_user uuid,
  p_item uuid,
  p_day date
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notification_log (user_id, type, day, entity_id)
  values (p_user, 'rotina', p_day, p_item)
  on conflict do nothing;
$$;

revoke all on function public.mark_routine_reminder_sent(uuid, uuid, date) from public;
revoke all on function public.mark_routine_reminder_sent(uuid, uuid, date) from anon;
revoke all on function public.mark_routine_reminder_sent(uuid, uuid, date) from authenticated;
grant execute on function public.mark_routine_reminder_sent(uuid, uuid, date) to service_role;
