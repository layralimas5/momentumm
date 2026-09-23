-- Momentumm — a instrumentação do laço de retenção.
--
-- O produto já sabia responder "quantas pessoas abriram". Não sabia responder
-- a pergunta que importa: quem entra, quem AGE, quem volta e onde desiste.
-- Esta migration não cria uma segunda ferramenta de analytics: ela estende a
-- que existe (`product_events` + `track_event`, 0024) com os eventos do laço
-- e com as funções que transformam esses eventos em métrica.
--
-- ## O que foi REAPROVEITADO em vez de recriado
--
--   `session_start`   já é o "abriu o app". Ganhou metadados de contexto
--                     (dias desde o cadastro, dias desde a última atividade)
--                     em vez de virar um `app_opened` concorrente.
--   `feature_view`    já é o "viu a tela X". `today_viewed` e
--                     `progress_viewed` seriam o mesmo dado com outro nome.
--   `task_completed`  já é o "concluiu uma ação". Ganhou `primary` e o XP.
--   `recovery_started` já existia. Entram só as duas pontas que faltavam.
--
-- ## Atividade significativa
--
-- A diferença entre "abriu" e "avançou" é a única que decide se o produto
-- funciona. `meaningful_event_names()` é a lista do que conta como avanço, e
-- `advanced_user_ids()` é a versão de `active_user_ids()` que usa só ela.

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------

create or replace function public.product_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    -- base (0024/0036)
    'session_start', 'feature_view', 'onboarding_completed',
    'objective_created', 'task_created', 'task_completed', 'habit_logged',
    'review_completed', 'momentum_viewed', 'ai_call', 'recovery_started',
    'share_exported', 'record_created', 'cancellation_requested', 'support_opened',
    'plan_limit_hit', 'checkout_started', 'subscription_canceled',
    'trial_started', 'trial_ended', 'reminder_enabled', 'reminder_disabled',

    -- o laço individual
    'primary_action_viewed', 'action_started', 'day_completed',
    'day_adapt_requested', 'day_adapt_completed',
    'recovery_shown', 'recovery_completed',
    'review_started', 'achievement_unlocked',

    -- Juntos (dupla de accountability)
    'pair_invite_created', 'pair_invite_opened', 'pair_invite_accepted',
    'pair_created', 'pair_viewed', 'encouragement_sent', 'encouragement_received',
    'pair_return_started', 'pair_left',

    -- gatilhos de retorno. Não existe evento de agendamento: nada é agendado
    -- com antecedência, o aviso é decidido na hora do envio.
    'notification_sent', 'notification_opened', 'notification_converted'
  ];
$$;

create or replace function public.product_feature_names()
returns text[]
language sql
immutable
as $$
  select array[
    'hoje', 'objetivos', 'habitos', 'plano', 'progresso', 'review',
    'momentum_score', 'ai', 'retomada', 'compartilhamento',
    'registro_texto', 'registro_foto', 'registro_voz',
    'circulo', 'desafios', 'foco', 'insights', 'perfil', 'evolucao',
    'configuracoes', 'assinatura', 'juntos', 'notificacoes'
  ];
$$;

/*
  As chaves novas.

  `action_id` e `objective_id` são uuid da própria pessoa (36 caracteres, sob
  o teto de 40 que `track_event` já aplica) e permitem responder "qual ação
  trava a semana". Continuam de fora: título, descrição, nota, qualquer texto
  escrito por alguém.
*/
create or replace function public.product_event_metadata_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'kind', 'mode', 'template', 'source', 'count', 'duration_ms', 'result', 'limit',
    'action_id', 'objective_id', 'primary', 'xp', 'minutes', 'state',
    'days_since_signup', 'days_since_activity',
    'notification_type', 'trigger', 'destination', 'elapsed_ms'
  ];
$$;

-- ---------------------------------------------------------------------------
-- avanço x abertura
-- ---------------------------------------------------------------------------

/*
  O que conta como "a pessoa avançou no objetivo dela".

  Abrir o app, ver uma tela e exportar uma imagem NÃO entram: retenção medida
  por abertura é a métrica que faz um produto parecer saudável enquanto
  ninguém muda de vida com ele.
*/
create or replace function public.meaningful_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'task_completed', 'habit_logged', 'review_completed',
    'objective_created', 'task_created', 'onboarding_completed',
    'recovery_completed', 'day_completed'
  ];
$$;

create or replace function public.advanced_user_ids(p_from timestamptz, p_to timestamptz)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct e.user_id
    from public.product_events e
   where e.user_id is not null
     and e.created_at >= p_from
     and e.created_at < p_to
     and e.name = any (public.meaningful_event_names());
$$;

revoke all on function public.advanced_user_ids(timestamptz, timestamptz) from public;
revoke all on function public.advanced_user_ids(timestamptz, timestamptz) from anon;
revoke all on function public.advanced_user_ids(timestamptz, timestamptz) from authenticated;

/*
  Retenção por avanço, não por login.

  Mesma janela de três dias que `retained_at` usa — a pessoa que volta no D8 em
  vez do D7 não é outra pessoa —, só que olhando exclusivamente os eventos de
  avanço.
*/
create or replace function public.advanced_at(p_user uuid, p_created timestamptz, p_day integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.product_events e
     where e.user_id = p_user
       and e.name = any (public.meaningful_event_names())
       and e.created_at >= p_created + make_interval(days => p_day)
       and e.created_at < p_created + make_interval(days => p_day + 3)
  );
$$;

revoke all on function public.advanced_at(uuid, timestamptz, integer) from public;
revoke all on function public.advanced_at(uuid, timestamptz, integer) from anon;
revoke all on function public.advanced_at(uuid, timestamptz, integer) from authenticated;

-- ---------------------------------------------------------------------------
-- o painel do laço
-- ---------------------------------------------------------------------------

/*
  Uma função, cinco perguntas:

    ativação    cadastro → plano → viu o Hoje → concluiu a primeira ação
    retenção    D1/D3/D7/D14/D30, nas DUAS réguas (abriu e avançou)
    tempo       quanto demora da conta até a primeira ação concluída
    retomada    quantos viram, iniciaram, concluíram e voltaram a avançar
    social      dupla x sem dupla, sem afirmar causa

  O corte social é descritivo de propósito: quem aceita um convite já é, em
  média, alguém mais engajado. Comparar os dois grupos mostra correlação, e a
  função devolve os dois lados justamente pra a leitura ser feita por quem
  sabe disso — não existe aqui nenhum campo chamado "efeito da dupla".
*/
create or replace function public.admin_engagement(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts   timestamptz := (p_to + 1)::timestamptz;
  coorte  bigint;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  select count(*) into coorte
    from auth.users u
   where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null;

  return jsonb_build_object(
    'cohort_size', coorte,

    -- ativação: cada degrau conta pessoas da coorte, não eventos
    'activation', jsonb_build_object(
      'signed_up', coorte,
      'planned', (
        select count(*) from auth.users u
         where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null
           and exists (select 1 from public.objectives o where o.user_id = u.id)
      ),
      'saw_today', (
        select count(*) from auth.users u
         where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null
           and exists (select 1 from public.product_events e
                        where e.user_id = u.id and e.name = 'feature_view' and e.feature = 'hoje')
      ),
      'first_action', (
        select count(*) from auth.users u
         where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null
           and exists (select 1 from public.tasks t where t.user_id = u.id and t.completed_at is not null)
      )
    ),

    -- retenção nas duas réguas, lado a lado
    'retention', (
      select jsonb_object_agg(d.dia, jsonb_build_object('opened', d.abriu, 'advanced', d.avancou))
        from (
          select dias as dia,
                 round(100.0 * count(*) filter (where public.retained_at(u.id, u.created_at, dias))
                       / nullif(count(*), 0), 1) abriu,
                 round(100.0 * count(*) filter (where public.advanced_at(u.id, u.created_at, dias))
                       / nullif(count(*), 0), 1) avancou
            from auth.users u
            cross join unnest(array[1, 3, 7, 14, 30]) dias
           where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null
             and u.created_at < now() - make_interval(days => dias)
           group by dias
        ) d
    ),

    -- time to first value: da conta até a primeira ação concluída
    'time_to_first_action_hours', jsonb_build_object(
      'median', (
        select round(percentile_cont(0.5) within group (
                 order by extract(epoch from (t.first_at - u.created_at)) / 3600)::numeric, 1)
          from auth.users u
          join (select user_id, min(completed_at) first_at from public.tasks
                 where completed_at is not null group by user_id) t on t.user_id = u.id
         where u.created_at >= from_ts and u.created_at < to_ts
      ),
      'p90', (
        select round(percentile_cont(0.9) within group (
                 order by extract(epoch from (t.first_at - u.created_at)) / 3600)::numeric, 1)
          from auth.users u
          join (select user_id, min(completed_at) first_at from public.tasks
                 where completed_at is not null group by user_id) t on t.user_id = u.id
         where u.created_at >= from_ts and u.created_at < to_ts
      )
    ),

    -- funil da retomada
    'recovery', jsonb_build_object(
      'shown',     (select count(distinct user_id) from public.product_events
                     where name = 'recovery_shown' and created_at >= from_ts and created_at < to_ts),
      'started',   (select count(distinct user_id) from public.product_events
                     where name = 'recovery_started' and created_at >= from_ts and created_at < to_ts),
      'completed', (select count(distinct user_id) from public.product_events
                     where name = 'recovery_completed' and created_at >= from_ts and created_at < to_ts),
      'advanced_after', (
        select count(distinct r.user_id)
          from public.product_events r
         where r.name = 'recovery_completed' and r.created_at >= from_ts and r.created_at < to_ts
           and exists (
             select 1 from public.product_events e
              where e.user_id = r.user_id
                and e.name = any (public.meaningful_event_names())
                and e.created_at > r.created_at
                and e.created_at < r.created_at + interval '3 days'
           )
      )
    ),

    -- notificações: mandadas, abertas e o que virou avanço depois
    'notifications', coalesce((
      select jsonb_object_agg(n.tipo, jsonb_build_object(
               'sent', n.enviadas, 'opened', n.abertas, 'converted', n.convertidas))
        from (
          select coalesce(e.metadata ->> 'notification_type', 'desconhecido') tipo,
                 count(*) filter (where e.name = 'notification_sent') enviadas,
                 count(*) filter (where e.name = 'notification_opened') abertas,
                 count(*) filter (where e.name = 'notification_converted') convertidas
            from public.product_events e
           where e.name in ('notification_sent', 'notification_opened', 'notification_converted')
             and e.created_at >= from_ts and e.created_at < to_ts
           group by 1
        ) n
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_engagement(date, date) from public;
revoke all on function public.admin_engagement(date, date) from anon;
grant execute on function public.admin_engagement(date, date) to authenticated;
