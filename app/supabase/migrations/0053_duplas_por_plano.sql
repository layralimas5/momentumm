-- Momentumm — quantas duplas cabem, e isso passa a ser o plano que decide.
--
-- Até aqui era UMA dupla ativa por pessoa, garantida por índice único
-- (`pair_members_one_active_idx`, 0049). A regra de produto mudou: o gratuito
-- continua com uma, o PRO passa a ter quantas quiser.
--
-- ## O que NÃO muda
--
-- A dupla continua sendo de DUAS pessoas. "Ilimitado" é quantos pares você
-- mantém, não quanta gente entra em cada um: a tela, o contrato de privacidade
-- e a contagem de dias juntos seguem desenhados pra dois, e grupo continua não
-- existindo. Cada dupla é uma relação separada, com a própria faixa de dias e
-- os próprios incentivos.
--
-- O que atravessa também é o mesmo: nome curto, avatar e um booleano por dia.
-- Ter cinco duplas não faz nenhuma delas ver mais do que via.
--
-- ## Por que o índice único sai
--
-- Ele era a regra. Sem ele, o limite passa a ser das funções, e elas precisam
-- de trava: duas pessoas aceitando convites da mesma conta no mesmo instante
-- poderiam furar o teto do gratuito. É pra isso que entra o
-- `pg_advisory_xact_lock`, tomado em ordem de texto pra não haver deadlock
-- entre dois aceites cruzados.

-- ---------------------------------------------------------------------------
-- 1. o teto como configuração
-- ---------------------------------------------------------------------------

update public.product_settings
   set value = value || jsonb_build_object('pairs', 1),
       updated_at = now()
 where key = 'plans.free';

update public.product_settings
   set value = value || jsonb_build_object('pairs', null),
       updated_at = now()
 where key = 'plans.pro';

/* O validador precisa conhecer `pairs`, como conheceu `pairEncouragementsPerDay`. */
create or replace function public.validate_setting(p_key text, p_value jsonb)
returns void
language plpgsql
immutable
as $fn$
  declare k text;
begin
  if p_key in ('plans.free', 'plans.pro') then
    for k in select jsonb_object_keys(p_value) loop
      if k not in ('activeObjectives', 'activeHabits', 'activePlans', 'actionsPerDay',
                   'historyDays', 'pairEncouragementsPerDay', 'pairs') then
        raise exception 'chave desconhecida em %: %', p_key, k using errcode = '22023';
      end if;
      if jsonb_typeof(p_value -> k) not in ('number', 'null') then
        raise exception '% precisa ser número ou nulo', k using errcode = '22023';
      end if;
    end loop;
  elsif p_key = 'ai.limits' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean'
       or jsonb_typeof(p_value -> 'monthlyPerPlan' -> 'free') <> 'number'
       or jsonb_typeof(p_value -> 'monthlyPerPlan' -> 'pro') <> 'number'
       or jsonb_typeof(p_value -> 'dailySafetyLimit') <> 'number'
       or jsonb_typeof(p_value -> 'perMinute') <> 'number'
       or jsonb_typeof(p_value -> 'costAlertUsd') <> 'number'
       or jsonb_typeof(p_value -> 'abuseBlockMinutes') <> 'number'
       or jsonb_typeof(p_value -> 'kinds') <> 'object'
       or coalesce(jsonb_typeof(p_value -> 'costPerMillionInputUsd'), 'null') not in ('number', 'null')
       or coalesce(jsonb_typeof(p_value -> 'costPerMillionOutputUsd'), 'null') not in ('number', 'null') then
      raise exception 'ai.limits fora do formato' using errcode = '22023';
    end if;
    if (p_value -> 'dailySafetyLimit')::int < 1 or (p_value -> 'perMinute')::int < 1 then
      raise exception 'tetos da IA precisam ser positivos' using errcode = '22023';
    end if;
  elsif p_key in ('features', 'experimental') then
    for k in select jsonb_object_keys(p_value) loop
      if jsonb_typeof(p_value -> k) <> 'boolean' then
        raise exception '% precisa ser booleano', k using errcode = '22023';
      end if;
    end loop;
  elsif p_key = 'maintenance' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean' or jsonb_typeof(p_value -> 'message') <> 'string'
       or char_length(p_value ->> 'message') > 280 then
      raise exception 'maintenance fora do formato' using errcode = '22023';
    end if;
  elsif p_key = 'system.message' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean' or jsonb_typeof(p_value -> 'text') <> 'string'
       or char_length(p_value ->> 'text') > 280
       or coalesce(p_value ->> 'tone', '') not in ('info', 'aviso', 'sucesso') then
      raise exception 'system.message fora do formato' using errcode = '22023';
    end if;
  elsif p_key = 'legal.versions' then
    if not ((p_value ->> 'termos') ~ '^\d{4}-\d{2}-\d{2}$' and (p_value ->> 'privacidade') ~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'legal.versions precisa de datas AAAA-MM-DD' using errcode = '22023';
    end if;
  else
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. mais de uma dupla passa a ser possível
-- ---------------------------------------------------------------------------

/*
  O índice único sai e o de leitura fica.

  `pair_members_one_active_idx` era único em `(user_id) where left_at is null`.
  O índice sobre a mesma expressão continua valendo a pena: toda função aqui
  procura "as duplas ativas desta pessoa".
*/
drop index if exists public.pair_members_one_active_idx;

create index if not exists pair_members_active_user_idx
  on public.pair_members (user_id) where left_at is null;

comment on table public.pair_members is
  'Quem está em qual dupla. Quantas duplas ativas por pessoa é o plano que diz (public.pair_limit_for).';

/*
  "Essa dupla é minha?" — substitui `my_pair_id()` nas policies.

  `my_pair_id()` devolvia UM id, e com várias duplas ele passaria a devolver
  uma qualquer: as policies que comparavam `pair_id = my_pair_id()` esconderiam
  todas as outras. Um booleano por dupla não tem esse problema, e continua em
  `security definer` pelo mesmo motivo de antes (a policy de `pair_members`
  consulta `pair_members`).
*/
create or replace function public.in_my_pair(p_pair uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pair_members m
     where m.pair_id = p_pair and m.user_id = auth.uid() and m.left_at is null
  );
$$;

revoke all on function public.in_my_pair(uuid) from public;
revoke all on function public.in_my_pair(uuid) from anon;
grant execute on function public.in_my_pair(uuid) to authenticated;

/** As duplas ativas de quem está pedindo, da mais nova pra mais antiga. */
create or replace function public.my_pair_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.pair_id
    from public.pair_members m
    join public.accountability_pairs p on p.id = m.pair_id
   where m.user_id = auth.uid() and m.left_at is null
   order by p.created_at desc;
$$;

revoke all on function public.my_pair_ids() from public;
revoke all on function public.my_pair_ids() from anon;
grant execute on function public.my_pair_ids() to authenticated;

drop policy if exists "vê a própria dupla" on public.accountability_pairs;
create policy "vê a própria dupla"
  on public.accountability_pairs for select
  to authenticated
  using (public.in_my_pair(id));

drop policy if exists "vê quem está na própria dupla" on public.pair_members;
create policy "vê quem está na própria dupla"
  on public.pair_members for select
  to authenticated
  using (public.in_my_pair(pair_id));

drop policy if exists "lê os incentivos da própria dupla" on public.pair_encouragements;
create policy "lê os incentivos da própria dupla"
  on public.pair_encouragements for select
  to authenticated
  using (public.in_my_pair(pair_id));

-- ---------------------------------------------------------------------------
-- 3. o teto de duplas
-- ---------------------------------------------------------------------------

/** Quantas duplas ativas a pessoa tem agora. */
create or replace function public.pair_count_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.pair_members m
   where m.user_id = p_user and m.left_at is null;
$$;

revoke all on function public.pair_count_for(uuid) from public;
revoke all on function public.pair_count_for(uuid) from anon;
revoke all on function public.pair_count_for(uuid) from authenticated;

/** Quantas duplas o plano da pessoa permite. `null` é sem limite. */
create or replace function public.pair_limit_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (s.value ->> 'pairs')::int
    from public.product_settings s
   where s.key = 'plans.' || public.plan_for_user(p_user)::text;
$$;

revoke all on function public.pair_limit_for(uuid) from public;
revoke all on function public.pair_limit_for(uuid) from anon;
revoke all on function public.pair_limit_for(uuid) from authenticated;

/*
  A trava por pessoa, tomada em ordem de texto.

  Sem o índice único, o teto só vale se duas transações não puderem contar a
  mesma conta ao mesmo tempo. Ordenar as chaves é o que impede deadlock quando
  A aceita o convite de B no mesmo instante em que B aceita o de A.
*/
create or replace function public.pair_lock(p_users uuid[])
returns void
language plpgsql
as $fn$
declare chave bigint;
begin
  for chave in
    select hashtextextended(u, 0) from (select unnest(p_users)::text as u order by 1) t
  loop
    perform pg_advisory_xact_lock(chave);
  end loop;
end;
$fn$;

revoke all on function public.pair_lock(uuid[]) from public;
revoke all on function public.pair_lock(uuid[]) from anon;
revoke all on function public.pair_lock(uuid[]) from authenticated;

/*
  "Cabe outra dupla?" — a frase que as duas portas de entrada usam.

  A mensagem é escrita pra ser lida na tela: o 22023 sobe como `DomainError`
  com o texto original (ver `infrastructure/supabase/rpc.ts`).
*/
create or replace function public.pair_assert_room(p_user uuid, p_self boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  teto  int := public.pair_limit_for(p_user);
  tem   int;
begin
  if teto is null then
    return;
  end if;

  tem := public.pair_count_for(p_user);
  if tem < teto then
    return;
  end if;

  if p_self then
    raise exception 'No teu plano cabe % ativa. O PRO abre quantas você quiser.',
      case when teto = 1 then '1 dupla' else teto || ' duplas' end
      using errcode = '23505';
  else
    raise exception 'Quem te convidou já está com as duplas do plano dela ocupadas.'
      using errcode = '22023';
  end if;
end;
$fn$;

revoke all on function public.pair_assert_room(uuid, boolean) from public;
revoke all on function public.pair_assert_room(uuid, boolean) from anon;
revoke all on function public.pair_assert_room(uuid, boolean) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. as portas de entrada, agora com teto em vez de "uma só"
-- ---------------------------------------------------------------------------

/*
  Igual à 0049, com duas diferenças.

  1. "Você já está em uma dupla" virou "cabe outra?", que é o teto do plano.
  2. O convite pendente de antes NÃO é mais cancelado por um novo. Com várias
     duplas possíveis, dois links vivos são dois amigos diferentes sendo
     chamados, e cancelar o primeiro quebraria o convite que já foi enviado.
     No gratuito isso não muda nada na prática: o teto de uma dupla barra o
     segundo aceite de qualquer jeito, e o limite de seis convites por dia
     continua segurando geração em massa.
*/
create or replace function public.pair_create_invite()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  quem  uuid := auth.uid();
  token text;
  novo  public.pair_invites;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.pair_lock(array[quem]);
  perform public.pair_assert_room(quem, true);

  if (select count(*) from public.pair_invites i
       where i.inviter_id = quem and i.created_at > now() - interval '1 day') >= 6 then
    raise exception 'muitos convites hoje' using errcode = '53400';
  end if;

  token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.pair_invites (inviter_id, token_hash, expires_at)
  values (
    quem,
    encode(extensions.digest(token, 'sha256'), 'hex'),
    now() + make_interval(days => public.pair_invite_ttl_days())
  )
  returning * into novo;

  return jsonb_build_object(
    'id', novo.id,
    'token', token,
    'expires_at', novo.expires_at
  );
end;
$fn$;

revoke all on function public.pair_create_invite() from public;
revoke all on function public.pair_create_invite() from anon;
grant execute on function public.pair_create_invite() to authenticated;

/*
  Aceitar, com o teto dos DOIS lados.

  O de quem aceita e o de quem convidou: o link circula por dias, e nesse tempo
  quem convidou pode ter enchido o próprio plano. Quando é esse o caso o
  convite é cancelado, porque ele não vai passar a valer sozinho.

  Uma dupla por par de pessoas continua valendo: com duplas ilimitadas, aceitar
  um segundo convite da MESMA pessoa criaria duas relações entre as mesmas duas
  contas, cada uma com a própria contagem de dias. É a mesma relação, então é
  recusado.
*/
create or replace function public.pair_accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  quem    uuid := auth.uid();
  convite public.pair_invites;
  nova    uuid;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select * into convite from public.pair_invites
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;

  if convite.id is null then
    raise exception 'convite inválido' using errcode = '22023';
  end if;
  if convite.status <> 'pendente' then
    raise exception 'esse convite já foi usado' using errcode = '22023';
  end if;
  if convite.expires_at <= now() then
    update public.pair_invites set status = 'expirado', responded_at = now() where id = convite.id;
    raise exception 'convite expirado' using errcode = '22023';
  end if;
  if convite.inviter_id = quem then
    raise exception 'você não pode aceitar o próprio convite' using errcode = '22023';
  end if;

  perform public.pair_lock(array[quem, convite.inviter_id]);

  if public.in_same_pair(quem, convite.inviter_id) then
    raise exception 'vocês já estão numa dupla' using errcode = '23505';
  end if;

  perform public.pair_assert_room(quem, true);

  begin
    perform public.pair_assert_room(convite.inviter_id, false);
  exception when others then
    update public.pair_invites set status = 'cancelado', responded_at = now() where id = convite.id;
    raise;
  end;

  insert into public.accountability_pairs (invite_id) values (convite.id) returning id into nova;
  insert into public.pair_members (pair_id, user_id) values (nova, convite.inviter_id), (nova, quem);

  update public.pair_invites
     set status = 'aceito', invitee_id = quem, pair_id = nova, responded_at = now()
   where id = convite.id;

  return nova;
end;
$fn$;

revoke all on function public.pair_accept_invite(text) from public;
revoke all on function public.pair_accept_invite(text) from anon;
grant execute on function public.pair_accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. sair de UMA dupla
-- ---------------------------------------------------------------------------

/*
  Sair passa a dizer de qual.

  Sem argumento não dá mais pra saber: `pair_leave()` pegaria uma das duplas
  por ordem de banco e desfaria a relação errada. A versão antiga é removida de
  propósito, pra nenhum cliente velho chamar e acertar por sorte.
*/
drop function if exists public.pair_leave();

create or replace function public.pair_leave(p_pair uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  if not exists (select 1 from public.pair_members m
                  where m.pair_id = p_pair and m.user_id = quem and m.left_at is null) then
    return;
  end if;

  update public.pair_members set left_at = now() where pair_id = p_pair and left_at is null;
  update public.accountability_pairs set ended_at = now(), ended_by = quem where id = p_pair;
end;
$fn$;

revoke all on function public.pair_leave(uuid) from public;
revoke all on function public.pair_leave(uuid) from anon;
grant execute on function public.pair_leave(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. a tela: de uma dupla pra uma lista
-- ---------------------------------------------------------------------------

/*
  O retrato de UMA dupla. É o corpo da `pair_overview` da 0049, com o id vindo
  por argumento em vez de `my_pair_id()`.

  Continua sem caminho pra título, nota, objetivo ou contagem de ações: o que
  sai por pessoa é id, primeiro nome, avatar, se avançou hoje e o vetor de sete
  booleanos.
*/
create or replace function public.pair_overview_of(p_pair uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  quem    uuid := auth.uid();
  criada  timestamptz;
  membros jsonb;
  juntos  integer := 0;
  dia     date;
  i       integer;
  todos   boolean;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  -- A checagem é aqui e não na policy: esta função é `security definer`, então
  -- sem ela qualquer id de dupla passaria.
  if not exists (select 1 from public.pair_members m
                  where m.pair_id = p_pair and m.user_id = quem and m.left_at is null) then
    return null;
  end if;

  select p.created_at into criada from public.accountability_pairs p where p.id = p_pair;

  select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'is_me', m.user_id = quem,
           'name', split_part(pr.name, ' ', 1),
           'avatar_url', pr.avatar_url,
           'advanced_today', public.advanced_on(m.user_id, public.local_day_of(m.user_id)),
           'days', (
             select jsonb_agg(jsonb_build_object(
                      'day', d.dia,
                      'advanced', public.advanced_on(m.user_id, d.dia)
                    ) order by d.dia)
               from generate_series(
                      public.local_day_of(m.user_id) - (public.pair_window_days() - 1),
                      public.local_day_of(m.user_id),
                      interval '1 day'
                    ) as g(ts)
               cross join lateral (select g.ts::date as dia) d
           )
         ) order by (m.user_id = quem) desc)
    into membros
    from public.pair_members m
    join public.profiles pr on pr.id = m.user_id
   where m.pair_id = p_pair and m.left_at is null;

  for i in 0 .. (public.pair_window_days() * 4) loop
    dia := (public.local_day_of(quem) - i);
    select bool_and(public.advanced_on(m.user_id, dia)) into todos
      from public.pair_members m
     where m.pair_id = p_pair and m.left_at is null;

    if todos then
      juntos := juntos + 1;
    elsif i > 0 then
      exit;
    end if;
  end loop;

  return jsonb_build_object(
    'id', p_pair,
    'created_at', criada,
    'days_together', juntos,
    'members', coalesce(membros, '[]'::jsonb),
    'encouragements_today', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'kind', e.kind, 'sender_id', e.sender_id,
               'recipient_id', e.recipient_id, 'created_at', e.created_at,
               'read_at', e.read_at
             ) order by e.created_at)
        from public.pair_encouragements e
       where e.pair_id = p_pair and e.day >= public.local_day_of(quem) - 1
    ), '[]'::jsonb)
  );
end;
$fn$;

revoke all on function public.pair_overview_of(uuid) from public;
revoke all on function public.pair_overview_of(uuid) from anon;
grant execute on function public.pair_overview_of(uuid) to authenticated;

/*
  Todas as duplas, numa chamada.

  `pairs` é sempre uma lista: vazia quando não tem nenhuma, com um elemento no
  gratuito, com quantas o PRO tiver. `room` diz se ainda cabe outra, pra a tela
  poder oferecer o convite sem precisar conhecer o teto de cada plano.
*/
create or replace function public.pair_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  quem uuid := auth.uid();
  teto int;
  tem  int;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  teto := public.pair_limit_for(quem);
  tem := public.pair_count_for(quem);

  return jsonb_build_object(
    'pairs', coalesce((
      select jsonb_agg(public.pair_overview_of(id))
        from public.my_pair_ids() as id
    ), '[]'::jsonb),
    'max', teto,
    'room', teto is null or tem < teto
  );
end;
$fn$;

revoke all on function public.pair_overview() from public;
revoke all on function public.pair_overview() from anon;
grant execute on function public.pair_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. incentivo: pra qual dupla
-- ---------------------------------------------------------------------------

/*
  Igual à 0052, com a dupla vindo por argumento.

  O app continua sem escolher o DESTINATÁRIO — ele diz em qual dupla está
  mandando, e quem recebe é a outra pessoa daquela dupla. Passar o id de quem
  recebe continuaria abrindo a porta pra mandar reação pra quem não é do par.

  A versão sem argumento sai: com várias duplas ela mandaria pra uma qualquer.
*/
drop function if exists public.pair_send_encouragement(public.encouragement_kind);

create or replace function public.pair_send_encouragement(
  p_pair uuid,
  p_kind public.encouragement_kind
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  quem   uuid := auth.uid();
  outro  uuid;
  novo   uuid;
  dia    date;
  teto   int;
  usados int;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  if not exists (select 1 from public.pair_members m
                  where m.pair_id = p_pair and m.user_id = quem and m.left_at is null) then
    raise exception 'você não está nessa dupla' using errcode = '22023';
  end if;

  select m.user_id into outro from public.pair_members m
   where m.pair_id = p_pair and m.left_at is null and m.user_id <> quem
   limit 1;

  if outro is null then
    raise exception 'sua dupla está incompleta' using errcode = '22023';
  end if;

  dia := public.local_day_of(quem);

  select id into novo from public.pair_encouragements
   where pair_id = p_pair and sender_id = quem and kind = p_kind and day = dia;

  if novo is not null then
    return novo;
  end if;

  select (value ->> 'pairEncouragementsPerDay')::int into teto
    from public.product_settings
   where key = 'plans.' || public.plan_for_user(quem)::text;

  if teto is not null then
    /*
      O teto é por DUPLA, não por dia da conta.

      Quem tem três duplas manda um incentivo em cada: o limite existe pra o
      gesto não virar rajada dentro de uma relação, e uma conta com várias
      duplas está falando com várias pessoas diferentes. Como o gratuito tem
      uma dupla só, na prática o número não muda pra ele.
    */
    select count(*) into usados from public.pair_encouragements
     where pair_id = p_pair and sender_id = quem and day = dia;

    if usados >= teto then
      raise exception 'No teu plano cabe % por dia nessa dupla. Os três gestos, todo dia, fazem parte do PRO.',
        case when teto = 1 then '1 incentivo' else teto || ' incentivos' end
        using errcode = '22023';
    end if;
  end if;

  insert into public.pair_encouragements (pair_id, sender_id, recipient_id, kind, day)
  values (p_pair, quem, outro, p_kind, dia)
  on conflict (pair_id, sender_id, kind, day) do nothing
  returning id into novo;

  if novo is null then
    select id into novo from public.pair_encouragements
     where pair_id = p_pair and sender_id = quem and kind = p_kind and day = dia;
  end if;

  return novo;
end;
$fn$;

revoke all on function public.pair_send_encouragement(uuid, public.encouragement_kind) from public;
revoke all on function public.pair_send_encouragement(uuid, public.encouragement_kind) from anon;
grant execute on function public.pair_send_encouragement(uuid, public.encouragement_kind) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. o lembrete social olha TODAS as duplas
-- ---------------------------------------------------------------------------

/*
  A 0050 escolhia UMA dupla com `limit 1` e decidia o lembrete social por ela.

  Com várias, isso passa a ignorar as outras: quem teve o parceiro de uma das
  duplas avançando hoje não receberia nada porque o sorteio caiu na dupla
  parada. A pergunta correta é "em ALGUMA das minhas duplas", que é exatamente
  o que a versão de uma dupla perguntava quando só existia uma.

  O resto da função é igual à 0050, linha por linha.
*/
create or replace function public.decide_notification(p_user uuid)
returns public.notification_type
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  tz        text;
  hoje      date;
  hora      integer;
  prefs     public.notification_preferences;
  aceitos   public.notification_type[];
  avancou   boolean;
  dias_fora integer;
  pendentes integer;
begin
  select coalesce(pr.timezone, 'America/Sao_Paulo') into tz
    from public.user_presence pr where pr.user_id = p_user;
  tz := coalesce(tz, 'America/Sao_Paulo');

  hoje := (now() at time zone tz)::date;
  hora := extract(hour from (now() at time zone tz))::integer;

  select * into prefs from public.notification_preferences where user_id = p_user;
  aceitos := coalesce(prefs.types,
    array['proximo_passo', 'continuidade', 'dia_dificil', 'retomada', 'social']::public.notification_type[]);

  if public.in_quiet_hours(hora, coalesce(prefs.quiet_from, 22), coalesce(prefs.quiet_to, 7)) then
    return null;
  end if;

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

  if dias_fora is null then
    return null;
  end if;

  if dias_fora >= 3 and 'retomada' = any (aceitos) then
    return 'retomada';
  end if;

  if 'social' = any (aceitos)
     and exists (select 1 from public.pair_members m
                  where m.user_id = p_user and m.left_at is null) then
    -- Incentivo que chegou e ainda não foi visto, de qualquer uma das duplas.
    if exists (select 1 from public.pair_encouragements e
                where e.recipient_id = p_user and e.read_at is null
                  and e.created_at > now() - interval '20 hours') then
      return 'social';
    end if;
    -- Alguém de alguma dupla avançou hoje e eu ainda não.
    if not avancou and exists (
      select 1
        from public.pair_members meu
        join public.pair_members outro
          on outro.pair_id = meu.pair_id and outro.user_id <> meu.user_id
       where meu.user_id = p_user and meu.left_at is null and outro.left_at is null
         and public.advanced_on(outro.user_id, public.local_day_of(outro.user_id))
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
$fn$;

revoke all on function public.decide_notification(uuid) from public;
revoke all on function public.decide_notification(uuid) from anon;
revoke all on function public.decide_notification(uuid) from authenticated;

/*
  A fila de envio, com o nome do parceiro que o aviso realmente quer citar.

  O `limit 1` da 0050 pegava um parceiro qualquer. Com uma dupla dava no mesmo;
  com três, o aviso "a Carol avançou hoje" podia sair com o nome de quem não
  avançou, o que é o app afirmando algo falso. A ordenação passa a preferir
  quem avançou hoje, e o nome desempata o resto pra a fila ser estável entre
  duas execuções.

  O resto é igual à 0050.
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
as $fn$
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
      order by public.advanced_on(m2.user_id, public.local_day_of(m2.user_id)) desc, p2.name
      limit 1) as partner_name
  from candidatos c
 where c.kind is not null;
$fn$;

revoke all on function public.notifications_due() from public;
revoke all on function public.notifications_due() from anon;
revoke all on function public.notifications_due() from authenticated;
grant execute on function public.notifications_due() to service_role;
