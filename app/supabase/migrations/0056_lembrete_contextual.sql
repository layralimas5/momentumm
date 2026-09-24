-- Momentumm — o lembrete que olha o dia antes de tocar.
--
-- A 0050 criou a decisão (seis tipos, prioridade, preferências, registro). Ela
-- tinha, porém, uma regra de RELÓGIO: o aviso só existia na hora preferida da
-- pessoa, uma vez por dia. Isso resolve "resumo do dia" e não resolve o caso
-- que faz alguém voltar — a ação de hoje continua aberta, o dia ficou corrido,
-- e o app tem algo útil a dizer AGORA, não às 19h.
--
-- Esta migration acrescenta a segunda pergunta: *faz quanto tempo que essa
-- pessoa não aparece, e existe algo em aberto?* Quatro horas sem atividade,
-- ação pendente, dentro da janela do dia. E tira os números do meio do código:
-- eles viram uma linha de tabela que dá pra mudar sem deploy.
--
-- O que NÃO muda:
--
--   `push_subscriptions`, `user_presence`  intocadas.
--   `push_reminders_due()`                 continua existindo. A Edge Function
--                                          nova não usa, mas derrubar a antiga
--                                          no mesmo deploy é ficar sem
--                                          lembrete nenhum se algo falhar.
--   uma notificação por pessoa por dia     segue valendo, agora por regra
--                                          configurável (`max_per_day`).

-- ---------------------------------------------------------------------------
-- a regra, em uma linha de tabela
-- ---------------------------------------------------------------------------

/*
  Uma linha só, e é a fonte da verdade sobre QUANDO um aviso pode sair.

  Existe porque esses números mudam com o que a prática mostrar — quatro horas
  pode virar seis, 21h30 pode virar 21h — e cada mudança dessas não vale um
  deploy. Espalhados pelo código, eles também divergem: a tela dizendo 19h e o
  servidor mandando às 20h é o tipo de erro que ninguém percebe olhando o diff.
*/
create table if not exists public.notification_rules (
  id                         boolean primary key default true,
  /* Horas sem atividade no app antes de o lembrete valer a pena. */
  inactivity_threshold_hours smallint not null default 4,
  /* A faixa do dia em que um aviso pode chegar, no fuso de quem recebe. */
  window_start               time not null default '08:00',
  window_end                 time not null default '21:30',
  /* Horas até o mesmo tipo poder repetir. */
  cooldown_hours             smallint not null default 20,
  /* Teto de avisos por dia local, de qualquer tipo. */
  max_per_day                smallint not null default 1,
  /* Dessa hora em diante, ação em aberto vira "dia difícil", não "próximo passo". */
  hard_day_from_hour         smallint not null default 18,
  updated_at                 timestamptz not null default now(),

  constraint notification_rules_one_row check (id),
  constraint notification_rules_sane check (
    inactivity_threshold_hours between 0 and 72
    and cooldown_hours between 0 and 168
    and max_per_day between 0 and 5
    and hard_day_from_hour between 0 and 23
    and window_start < window_end
  )
);

comment on table public.notification_rules is
  'Os limiares do lembrete (inatividade, janela do dia, cooldown, teto diário). Uma linha só.';

insert into public.notification_rules (id) values (true) on conflict (id) do nothing;

alter table public.notification_rules enable row level security;

-- Sem política: ninguém lê pela API. Quem precisa dos números é o servidor, e
-- a tela só narra o que a regra faz (`domain/notifications/push-device`).

/** A linha de regras, sempre preenchida: sem linha, valem os padrões da tabela. */
create or replace function public.notification_rules_current()
returns public.notification_rules
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r from public.notification_rules r where r.id limit 1),
    row(true, 4, '08:00'::time, '21:30'::time, 20, 1, 18, now())::public.notification_rules
  );
$$;

revoke all on function public.notification_rules_current() from public;
revoke all on function public.notification_rules_current() from anon;
revoke all on function public.notification_rules_current() from authenticated;

-- Presença é lida por "quem está parado há mais de X horas": o índice é o que
-- impede a fila de virar varredura de tabela quando a base crescer.
create index if not exists user_presence_last_active_idx
  on public.user_presence (last_active_at);

/*
  O fuso pode ter dígito. A regex da 0036 não deixava.

  `^[A-Za-z_]+(/[A-Za-z_+-]+){0,2}$` recusa `Etc/GMT+3`, que é um nome IANA
  legítimo e é o que `Intl.DateTimeFormat().resolvedOptions().timeZone` devolve
  em aparelho (ou container) configurado por offset. O efeito era silencioso e
  feio: `touch_my_presence` estourava a constraint, o app engolia o erro, a
  presença NUNCA gravava e a pessoa nunca recebia aviso nenhum — sem nada em
  lugar algum dizendo por quê.
*/
alter table public.user_presence drop constraint if exists user_presence_timezone_format;
alter table public.user_presence add constraint user_presence_timezone_format
  check (timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$');

-- ---------------------------------------------------------------------------
-- cooldown
-- ---------------------------------------------------------------------------

/*
  Esse tipo já foi mandado pra essa pessoa dentro do prazo?

  O teto por dia (`max_per_day`) não basta: sem cooldown, um aviso às 21h e
  outro às 8h do dia seguinte são dois dias diferentes no papel e duas
  cobranças seguidas na vida real.
*/
create or replace function public.notified_recently(
  p_user uuid,
  p_type public.notification_type,
  p_hours integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notification_log l
     where l.user_id = p_user
       and l.type = p_type
       and l.sent_at > now() - make_interval(hours => greatest(coalesce(p_hours, 0), 0))
  );
$$;

revoke all on function public.notified_recently(uuid, public.notification_type, integer) from public;
revoke all on function public.notified_recently(uuid, public.notification_type, integer) from anon;
revoke all on function public.notified_recently(uuid, public.notification_type, integer) from authenticated;

-- ---------------------------------------------------------------------------
-- a decisão, agora com a pergunta do tempo
-- ---------------------------------------------------------------------------

/*
  Qual aviso essa pessoa deveria receber agora — ou nenhum.

  A ordem das perguntas É a prioridade:

    retomada       sumiu há dias. Nada mais importa.
    social         a dupla te mandou algo, ou avançou.
    dia_dificil    o dia está acabando e a ação continua aberta.
    proximo_passo  tem ação pra hoje e o dia ainda cabe.
    continuidade   avançou ontem, mas hoje ainda não abriu.
    progresso      nada urgente; só a leitura da semana.

  O que a 0056 acrescenta, e vale pra TODOS os tipos:

    janela do dia     nada fora de 08:00–21:30 locais, nem no silêncio que a
                      pessoa configurou. A mais apertada das duas ganha.
    inatividade       quem esteve no app nas últimas horas não é interrompido.
                      Push pra quem está com o app aberto é só barulho.
    cooldown          o mesmo tipo não repete antes do prazo, nem virando o dia.

  E a separação que faz o lembrete existir: `proximo_passo` e `dia_dificil`
  saem a QUALQUER hora dentro da janela, porque respondem ao estado do dia. Os
  outros quatro têm hora marcada (a preferida da pessoa), porque são leitura,
  não urgência — e leitura fora de hora é interrupção.
*/
create or replace function public.decide_notification(p_user uuid)
returns public.notification_type
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  regras    public.notification_rules;
  tz        text;
  hoje      date;
  agora     time;
  hora      integer;
  parada_ha numeric;
  prefs     public.notification_preferences;
  aceitos   public.notification_type[];
  na_hora   boolean;
  avancou   boolean;
  dias_fora integer;
  pendentes integer;
  dupla     uuid;
begin
  regras := public.notification_rules_current();

  select coalesce(pr.timezone, 'America/Sao_Paulo') into tz
    from public.user_presence pr where pr.user_id = p_user;
  tz := coalesce(tz, 'America/Sao_Paulo');

  hoje  := (now() at time zone tz)::date;
  agora := (now() at time zone tz)::time;
  hora  := extract(hour from (now() at time zone tz))::integer;

  -- Fora da faixa do dia não existe aviso útil: existe aviso acordando alguém.
  if agora < regras.window_start or agora > regras.window_end then
    return null;
  end if;

  select * into prefs from public.notification_preferences where user_id = p_user;
  aceitos := coalesce(prefs.types,
    array['proximo_passo', 'continuidade', 'dia_dificil', 'retomada', 'social']::public.notification_type[]);

  if coalesce(array_length(aceitos, 1), 0) = 0 then
    return null;
  end if;

  -- Silêncio escolhido pela pessoa, por cima da janela geral.
  if public.in_quiet_hours(hora, coalesce(prefs.quiet_from, 22), coalesce(prefs.quiet_to, 7)) then
    return null;
  end if;

  -- O teto do dia. A checagem vem antes de qualquer conta cara.
  if (select count(*) from public.notification_log l
       where l.user_id = p_user and l.day = hoje) >= regras.max_per_day then
    return null;
  end if;

  /*
    Quanto tempo faz que essa pessoa não aparece.

    A presença é carimbada ao abrir o app e ao concluir algo — é o mesmo
    relógio que o resto do sistema usa pra dizer "esteve aqui". Sem linha de
    presença não existe app aberto nenhum, e aí não existe aviso: conta que
    nunca entrou é assunto do onboarding, não de notificação.
  */
  select extract(epoch from (now() - pr.last_active_at)) / 3600.0
    into parada_ha
    from public.user_presence pr where pr.user_id = p_user;

  if parada_ha is null or parada_ha < regras.inactivity_threshold_hours then
    return null;
  end if;

  na_hora := hora = coalesce(prefs.preferred_hour, 19);

  avancou := public.advanced_on(p_user, hoje);

  select greatest(0, (hoje - max(d.dia)))::integer into dias_fora
    from (
      select generate_series(hoje - 30, hoje, interval '1 day')::date dia
    ) d
   where public.advanced_on(p_user, d.dia);

  -- Conta nova sem nenhum avanço ainda: o lugar disso é o onboarding, não uma
  -- notificação de retomada dizendo "continue de onde parou".
  if dias_fora is null then
    return null;
  end if;

  /*
    Pausa longa: só a retomada serve, e ela tem hora marcada.

    Sem o `return null` no fim deste bloco, quem sumiu há cinco dias receberia
    "sua ação de hoje ainda cabe" às 9h da manhã — a mensagem certa pra quem
    está no ritmo, e a errada pra quem saiu dele.
  */
  if dias_fora >= 3 then
    if na_hora and 'retomada' = any (aceitos)
       and not public.notified_recently(p_user, 'retomada', regras.cooldown_hours) then
      return 'retomada';
    end if;
    return null;
  end if;

  dupla := (select m.pair_id from public.pair_members m
             where m.user_id = p_user and m.left_at is null limit 1);

  if dupla is not null and na_hora and 'social' = any (aceitos)
     and not public.notified_recently(p_user, 'social', regras.cooldown_hours) then
    -- Incentivo que chegou e ainda não foi visto.
    if exists (select 1 from public.pair_encouragements e
                where e.recipient_id = p_user and e.read_at is null
                  and e.created_at > now() - interval '20 hours') then
      return 'social';
    end if;
    -- A outra pessoa avançou hoje e eu ainda não.
    if not avancou and exists (
      select 1 from public.pair_members m
       where m.pair_id = dupla and m.left_at is null and m.user_id <> p_user
         and public.advanced_on(m.user_id, public.local_day_of(m.user_id))
    ) then
      return 'social';
    end if;
  end if;

  -- Quem já avançou hoje fez o que o app queria. Depois disso, aviso é interrupção.
  if avancou then
    return null;
  end if;

  select count(*) into pendentes from public.tasks t
   where t.user_id = p_user and t.day = hoje
     and t.status in ('pendente', 'em-andamento', 'adiada');

  if pendentes > 0 and hora >= regras.hard_day_from_hour and 'dia_dificil' = any (aceitos)
     and not public.notified_recently(p_user, 'dia_dificil', regras.cooldown_hours) then
    return 'dia_dificil';
  end if;

  if pendentes > 0 and 'proximo_passo' = any (aceitos)
     and not public.notified_recently(p_user, 'proximo_passo', regras.cooldown_hours) then
    return 'proximo_passo';
  end if;

  if dias_fora = 1 and na_hora and 'continuidade' = any (aceitos)
     and not public.notified_recently(p_user, 'continuidade', regras.cooldown_hours) then
    return 'continuidade';
  end if;

  if na_hora and 'progresso' = any (aceitos)
     and not public.notified_recently(p_user, 'progresso', regras.cooldown_hours)
     and (select count(distinct d.dia) from (
            select generate_series(hoje - 6, hoje, interval '1 day')::date dia
          ) d where public.advanced_on(p_user, d.dia)) >= 3 then
    return 'progresso';
  end if;

  return null;
end;
$$;

revoke all on function public.decide_notification(uuid) from public;
revoke all on function public.decide_notification(uuid) from anon;
revoke all on function public.decide_notification(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- a fila de envio
-- ---------------------------------------------------------------------------

/*
  Uma linha por aparelho a avisar, já com o tipo decidido.

  A hora saiu do `where`: quem manda na hora agora é `decide_notification`,
  que sabe quais tipos têm hora marcada e quais respondem ao estado do dia.
  O que ficou aqui são os cortes BARATOS, os que evitam rodar a decisão pra
  quem obviamente não recebe: aparelho com falha, gente que esteve no app
  agora há pouco, e quem já bateu o teto do dia.
*/
create or replace function public.notifications_due()
returns table (
  subscription_id uuid,
  user_id         uuid,
  endpoint        text,
  p256dh          text,
  auth            text,
  first_name      text,
  kind            public.notification_type,
  days_away       integer,
  partner_name    text
)
language sql
security definer
set search_path = public
stable
as $$
  with regras as (
    select * from public.notification_rules_current()
  ),
  candidatos as (
    select
      s.id as subscription_id,
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth,
      split_part(p.name, ' ', 1) as first_name,
      coalesce(pr.timezone, 'America/Sao_Paulo') as tz,
      public.decide_notification(s.user_id) as kind
    from public.push_subscriptions s
    join public.user_presence pr on pr.user_id = s.user_id
    join public.profiles p on p.id = s.user_id
    cross join regras r
   where s.failed_at is null
     and pr.last_active_at <= now() - make_interval(hours => r.inactivity_threshold_hours)
     and (
       select count(*) from public.notification_log l
        where l.user_id = s.user_id
          and l.day = (now() at time zone coalesce(pr.timezone, 'America/Sao_Paulo'))::date
     ) < r.max_per_day
  )
  select
    c.subscription_id,
    c.user_id,
    c.endpoint,
    c.p256dh,
    c.auth,
    c.first_name,
    c.kind,
    coalesce((
      select ((now() at time zone c.tz)::date - max(d.dia))::integer
        from (select generate_series((now() at time zone c.tz)::date - 30,
                                     (now() at time zone c.tz)::date,
                                     interval '1 day')::date dia) d
       where public.advanced_on(c.user_id, d.dia)
    ), 0) as days_away,
    (select split_part(p2.name, ' ', 1)
       from public.pair_members m
       join public.pair_members m2 on m2.pair_id = m.pair_id and m2.user_id <> m.user_id
       join public.profiles p2 on p2.id = m2.user_id
      where m.user_id = c.user_id and m.left_at is null and m2.left_at is null
      limit 1) as partner_name
  from candidatos c
 where c.kind is not null;
$$;

revoke all on function public.notifications_due() from public;
revoke all on function public.notifications_due() from anon;
revoke all on function public.notifications_due() from authenticated;
grant execute on function public.notifications_due() to service_role;

-- ---------------------------------------------------------------------------
-- eventos: o que o servidor registra
-- ---------------------------------------------------------------------------

-- A mesma lista de `PRODUCT_EVENTS` no app (domain/analytics/product-events).
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
    'notification_sent', 'notification_opened', 'notification_converted',
    'notification_failed',

    -- a permissão e o aparelho: onde a fila do push quebra
    'notification_permission_prompted', 'notification_permission_granted',
    'notification_permission_denied', 'push_subscription_created',

    -- instalação do app
    'pwa_install_prompted', 'pwa_installed', 'ios_install_shown'
  ];
$$;

/*
  O evento que o SERVIDOR registra.

  `track_event` exige `auth.uid()`, e com razão: é a porta do app, e ninguém
  deve poder escrever evento em nome de outra pessoa. O envio do push não tem
  sessão — quem manda é o `pg_cron` —, então precisa de uma porta própria,
  fechada em `service_role`, que recebe o dono explicitamente.

  A validação é a mesma: nome conhecido, chaves conhecidas, valores curtos.
*/
create or replace function public.log_notification_event(
  p_user uuid,
  p_name text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean jsonb := '{}'::jsonb;
  entry record;
  current_plan public.plan_tier;
begin
  if p_user is null then
    raise exception 'evento sem dono' using errcode = '22023';
  end if;
  if not (p_name = any (public.product_event_names())) then
    raise exception 'evento desconhecido' using errcode = '22023';
  end if;

  for entry in select key, value from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) loop
    if entry.key = any (public.product_event_metadata_keys())
       and jsonb_typeof(entry.value) in ('string', 'number', 'boolean')
       and char_length(entry.value::text) <= 40 then
      clean := clean || jsonb_build_object(entry.key, entry.value);
    end if;
  end loop;

  select p.plan into current_plan from public.profiles p where p.id = p_user;

  insert into public.product_events (user_id, name, feature, plan, metadata)
  values (p_user, p_name, 'notificacoes', coalesce(current_plan, 'free'), clean);
end;
$$;

revoke all on function public.log_notification_event(uuid, text, jsonb) from public;
revoke all on function public.log_notification_event(uuid, text, jsonb) from anon;
revoke all on function public.log_notification_event(uuid, text, jsonb) from authenticated;
grant execute on function public.log_notification_event(uuid, text, jsonb) to service_role;
