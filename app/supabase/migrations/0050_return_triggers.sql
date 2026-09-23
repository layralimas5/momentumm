-- Momentumm — os gatilhos de retorno.
--
-- O app já sabia mandar UM aviso: "você não abriu hoje" (0036). Ele funciona,
-- mas responde à pergunta errada. A pergunta que uma notificação precisa
-- responder é *por que eu deveria abrir isso agora*, e "não esqueça do
-- Momentumm" não responde.
--
-- Esta migration transforma aquele envio único numa DECISÃO: seis tipos, uma
-- regra de escolha por pessoa, preferências de quem recebe e o registro do
-- que foi mandado — que é o que permite parar de mandar o que ninguém abre.
--
-- ## O que foi reaproveitado
--
--   `push_subscriptions`  os aparelhos, com `failed_at` e tudo. Intocada.
--   `user_presence`       a última abertura e o fuso. Intocada.
--   `product_events`      os eventos (`notification_sent`, `_opened`,
--                         `_converted`) já entraram na 0048.
--   `push-reminders`      a Edge Function continua sendo a mesma; ela passa a
--                         ler `notifications_due()` em vez de
--                         `push_reminders_due()`, que fica no lugar até a
--                         nova estar rodando em produção.
--
-- ## A regra que evita virar spam
--
-- UMA notificação por pessoa por dia, escolhida por prioridade. Não existe
-- fila: se dois tipos se aplicam hoje, o de maior prioridade ganha e o outro
-- simplesmente não acontece. Fila de notificação é como um app começa mandando
-- duas por dia e termina sendo desinstalado.

-- ---------------------------------------------------------------------------
-- tipos
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.notification_type as enum (
    'proximo_passo',   -- existe ação importante pra hoje
    'continuidade',    -- avançou ontem, o próximo passo está pronto
    'progresso',       -- avanço relevante na semana
    'dia_dificil',     -- o dia está acabando e a ação segue pendente
    'retomada',        -- período sem atividade
    'social'           -- a dupla avançou, ou mandou um incentivo
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- preferências
-- ---------------------------------------------------------------------------

/*
  Uma linha por pessoa, com o que ela aceita receber.

  O padrão é tudo ligado MENOS `progresso` — que é a única categoria que não
  pede ação nenhuma de quem recebe. Um aviso que não muda o que a pessoa vai
  fazer é o primeiro candidato a ensinar ela a ignorar os outros.
*/
create table if not exists public.notification_preferences (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  /* A janela em que pode chegar aviso, no fuso da pessoa. */
  quiet_from   smallint not null default 22,
  quiet_to     smallint not null default 7,
  /* A hora preferida do lembrete diário. */
  preferred_hour smallint not null default 19,
  types        public.notification_type[] not null default
                 array['proximo_passo', 'continuidade', 'dia_dificil', 'retomada', 'social']::public.notification_type[],
  updated_at   timestamptz not null default now(),

  constraint notification_preferences_hours check (
    quiet_from between 0 and 23 and quiet_to between 0 and 23 and preferred_hour between 0 and 23
  )
);

comment on table public.notification_preferences is
  'O que cada pessoa aceita receber, e quando. Sem linha, valem os padrões.';

alter table public.notification_preferences enable row level security;

drop policy if exists "dono lê as próprias preferências" on public.notification_preferences;
create policy "dono lê as próprias preferências"
  on public.notification_preferences for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "dono cria as próprias preferências" on public.notification_preferences;
create policy "dono cria as próprias preferências"
  on public.notification_preferences for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "dono atualiza as próprias preferências" on public.notification_preferences;
create policy "dono atualiza as próprias preferências"
  on public.notification_preferences for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- o que já foi mandado
-- ---------------------------------------------------------------------------

/*
  O registro de envio, e é ele que segura a frequência.

  `product_events` guarda a análise; esta tabela guarda a REGRA — "essa pessoa
  já recebeu hoje" precisa ser uma consulta barata e confiável, não uma
  agregação sobre a tabela de eventos, que tem limite de escrita por hora e
  pode descartar linha.
*/
create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       public.notification_type not null,
  /* O dia local de quem recebeu. */
  day        date not null,
  sent_at    timestamptz not null default now(),
  opened_at  timestamptz,
  /* A pessoa avançou depois de abrir? Carimbado pelo app. */
  converted_at timestamptz
);

create index if not exists notification_log_user_day_idx on public.notification_log (user_id, day desc);
create index if not exists notification_log_type_idx on public.notification_log (type, sent_at desc);

alter table public.notification_log enable row level security;

drop policy if exists "dono lê os próprios avisos" on public.notification_log;
create policy "dono lê os próprios avisos"
  on public.notification_log for select
  to authenticated using (auth.uid() = user_id);

-- Escrita só pelo servidor (envio) e pela função de abertura, abaixo.

-- ---------------------------------------------------------------------------
-- a decisão
-- ---------------------------------------------------------------------------

/*
  Qual aviso essa pessoa deveria receber agora — ou nenhum.

  A ordem das perguntas É a prioridade, e ela vai do mais urgente pro menos:

    retomada       sumiu há dias. Nada mais importa.
    social         a dupla te mandou algo, ou avançou. É o único tipo que
                   depende de outra pessoa, e ele perde a validade rápido.
    dia_dificil    o dia está acabando e a ação continua aberta.
    proximo_passo  tem ação pra hoje e o dia ainda cabe.
    continuidade   avançou ontem, mas hoje ainda não abriu.
    progresso      nada urgente; só a leitura da semana.

  Quem já avançou hoje NÃO recebe nada, de tipo nenhum, exceto social: a
  pessoa fez o que o app queria, e um aviso depois disso é interrupção pura.
*/
create or replace function public.decide_notification(p_user uuid)
returns public.notification_type
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz        text;
  hoje      date;
  hora      integer;
  prefs     public.notification_preferences;
  aceitos   public.notification_type[];
  avancou   boolean;
  dias_fora integer;
  pendentes integer;
  dupla     uuid;
begin
  select coalesce(pr.timezone, 'America/Sao_Paulo') into tz
    from public.user_presence pr where pr.user_id = p_user;
  tz := coalesce(tz, 'America/Sao_Paulo');

  hoje := (now() at time zone tz)::date;
  hora := extract(hour from (now() at time zone tz))::integer;

  select * into prefs from public.notification_preferences where user_id = p_user;
  aceitos := coalesce(prefs.types,
    array['proximo_passo', 'continuidade', 'dia_dificil', 'retomada', 'social']::public.notification_type[]);

  -- Silêncio: a janela noturna vale mesmo quando o aviso seria útil.
  if public.in_quiet_hours(hora, coalesce(prefs.quiet_from, 22), coalesce(prefs.quiet_to, 7)) then
    return null;
  end if;

  -- Uma por dia. A checagem vem antes de qualquer conta cara.
  if exists (select 1 from public.notification_log l
              where l.user_id = p_user and l.day = hoje) then
    return null;
  end if;

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

  if dias_fora >= 3 and 'retomada' = any (aceitos) then
    return 'retomada';
  end if;

  dupla := (select m.pair_id from public.pair_members m
             where m.user_id = p_user and m.left_at is null limit 1);

  if dupla is not null and 'social' = any (aceitos) then
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

  if avancou then
    return null;
  end if;

  select count(*) into pendentes from public.tasks t
   where t.user_id = p_user and t.day = hoje
     and t.status in ('pendente', 'em-andamento', 'adiada');

  if pendentes > 0 and hora >= 18 and 'dia_dificil' = any (aceitos) then
    return 'dia_dificil';
  end if;

  if pendentes > 0 and 'proximo_passo' = any (aceitos) then
    return 'proximo_passo';
  end if;

  if dias_fora = 1 and 'continuidade' = any (aceitos) then
    return 'continuidade';
  end if;

  if 'progresso' = any (aceitos)
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

/*
  A janela de silêncio atravessa a meia-noite (22h às 7h), então a comparação
  não é um simples `between`. Fica numa função própria porque essa é
  exatamente a conta que todo mundo escreve errado na primeira vez.
*/
create or replace function public.in_quiet_hours(p_hour integer, p_from integer, p_to integer)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then false
    when p_from < p_to then p_hour >= p_from and p_hour < p_to
    else p_hour >= p_from or p_hour < p_to
  end;
$$;

/*
  A fila de envio: uma linha por aparelho, já com o tipo decidido.

  Só quem tem aparelho inscrito, está na hora preferida do próprio fuso, não
  recebeu nada hoje e tem um tipo a receber.
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
  with candidatos as (
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
    left join public.notification_preferences np on np.user_id = s.user_id
   where s.failed_at is null
     and extract(hour from (now() at time zone coalesce(pr.timezone, 'America/Sao_Paulo')))
         = coalesce(np.preferred_hour, 19)
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

/** Carimba o envio. O dia é o local de quem recebeu. */
create or replace function public.mark_notification_sent(
  p_user uuid,
  p_type public.notification_type,
  p_subscription_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tz  text;
  novo uuid;
begin
  select coalesce(pr.timezone, 'America/Sao_Paulo') into tz
    from public.user_presence pr where pr.user_id = p_user;

  insert into public.notification_log (user_id, type, day)
  values (p_user, p_type, (now() at time zone coalesce(tz, 'America/Sao_Paulo'))::date)
  returning id into novo;

  update public.push_subscriptions
     set last_reminded_on = (now() at time zone coalesce(tz, 'America/Sao_Paulo'))::date,
         failed_at = null
   where id = p_subscription_id;

  return novo;
end;
$$;

revoke all on function public.mark_notification_sent(uuid, public.notification_type, uuid) from public;
revoke all on function public.mark_notification_sent(uuid, public.notification_type, uuid) from anon;
revoke all on function public.mark_notification_sent(uuid, public.notification_type, uuid) from authenticated;
grant execute on function public.mark_notification_sent(uuid, public.notification_type, uuid) to service_role;

/*
  A abertura, carimbada pelo app quando ele abre por um link de notificação.

  O app conhece o TIPO (vem no `?n=` da URL), não o id do registro — mandar o
  id na URL exporia uma chave interna num link que a pessoa pode colar em
  qualquer lugar. A função resolve o registro sozinha: o mais recente daquele
  tipo, dessa conta, nas últimas 24 horas e ainda não aberto.

  `opened_at is null` é o que impede reabrir o app pelo histórico do navegador
  de virar uma segunda abertura.
*/
create or replace function public.mark_notification_opened(p_type public.notification_type)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_log
     set opened_at = now()
   where id = (
     select l.id from public.notification_log l
      where l.user_id = auth.uid()
        and l.type = p_type
        and l.opened_at is null
        and l.sent_at > now() - interval '24 hours'
      order by l.sent_at desc
      limit 1
   );
$$;

revoke all on function public.mark_notification_opened(public.notification_type) from public;
revoke all on function public.mark_notification_opened(public.notification_type) from anon;
grant execute on function public.mark_notification_opened(public.notification_type) to authenticated;

/*
  A conversão: a pessoa abriu pela notificação E avançou depois.

  O app chama isso ao concluir algo, e a função só carimba se existir uma
  notificação aberta nas últimas seis horas. Sem a janela, o avanço da noite
  seria creditado ao aviso da manhã.
*/
create or replace function public.mark_notification_converted()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_log
     set converted_at = now()
   where id = (
     select l.id from public.notification_log l
      where l.user_id = auth.uid()
        and l.opened_at is not null
        and l.converted_at is null
        and l.opened_at > now() - interval '6 hours'
      order by l.opened_at desc
      limit 1
   );
$$;

revoke all on function public.mark_notification_converted() from public;
revoke all on function public.mark_notification_converted() from anon;
grant execute on function public.mark_notification_converted() to authenticated;

/** Salva as preferências. Uma linha por pessoa, criada na primeira gravação. */
create or replace function public.save_notification_preferences(
  p_types public.notification_type[],
  p_preferred_hour integer default 19,
  p_quiet_from integer default 22,
  p_quiet_to integer default 7
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;
  if p_preferred_hour not between 0 and 23
     or p_quiet_from not between 0 and 23
     or p_quiet_to not between 0 and 23 then
    raise exception 'horário fora do intervalo' using errcode = '22023';
  end if;

  insert into public.notification_preferences (user_id, types, preferred_hour, quiet_from, quiet_to)
  values (quem, coalesce(p_types, '{}'::public.notification_type[]), p_preferred_hour, p_quiet_from, p_quiet_to)
  on conflict (user_id) do update
    set types = excluded.types,
        preferred_hour = excluded.preferred_hour,
        quiet_from = excluded.quiet_from,
        quiet_to = excluded.quiet_to,
        updated_at = now();
end;
$$;

revoke all on function public.save_notification_preferences(public.notification_type[], integer, integer, integer) from public;
revoke all on function public.save_notification_preferences(public.notification_type[], integer, integer, integer) from anon;
grant execute on function public.save_notification_preferences(public.notification_type[], integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- o cron continua o mesmo
-- ---------------------------------------------------------------------------
--
-- `call_push_reminders()` (0036) segue chamando a Edge Function a cada hora.
-- O que muda é o que a função LÊ: `notifications_due()` no lugar de
-- `push_reminders_due()`. A antiga fica onde está até a nova estar rodando
-- em produção — trocar as duas coisas no mesmo deploy é ficar sem lembrete
-- nenhum se a nova tiver um erro.
