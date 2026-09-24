-- Momentumm — o Juntos entra no ar, e o gratuito ganha um teto de verdade.
--
-- Duas coisas, e as duas precisam da mesma migration: ligar o recurso sem o
-- teto deixaria o plano gratuito com a dupla inteira por um deploy.
--
-- 1. A flag `juntos` passa a `true`. A 0049 a criou desligada de propósito,
--    pra comparar quem tem dupla com quem não tem. A decisão agora é outra:
--    o recurso abre pra base toda, e o corte social das métricas
--    (`admin_pair_comparison`) continua respondendo à mesma pergunta com os
--    dados de uso real.
--
-- 2. O incentivo passa a ter limite por dia e por plano, aplicado aqui. A
--    faixa de dias que o gratuito VÊ é recorte de leitura e vive no app
--    (`plan.ts`, `pairDays`): esconder ponto no desenho não é permissão, e
--    fingir que é encheria o servidor de regra que não protege nada. Mandar
--    incentivo, ao contrário, ESCREVE — então o teto é aqui.

-- ---------------------------------------------------------------------------
-- 1. a flag
-- ---------------------------------------------------------------------------

update public.product_settings
   set value = value || jsonb_build_object('juntos', true),
       updated_at = now()
 where key = 'features';

-- ---------------------------------------------------------------------------
-- 2. o teto, como configuração
-- ---------------------------------------------------------------------------

/*
  O número mora em `plans.*` e não no corpo da função.

  É o mesmo lugar dos outros limites que o servidor aplica, então mudar de 1
  pra 2 amanhã é um `admin_update_setting` com motivo e auditoria, não um
  deploy. `null` continua querendo dizer "sem limite".
*/
update public.product_settings
   set value = value || jsonb_build_object('pairEncouragementsPerDay', 1),
       updated_at = now()
 where key = 'plans.free';

update public.product_settings
   set value = value || jsonb_build_object('pairEncouragementsPerDay', null),
       updated_at = now()
 where key = 'plans.pro';

/*
  O validador precisa conhecer a chave nova, senão a próxima gravação de
  `plans.free` pelo painel é recusada com "chave desconhecida". A função é
  recriada inteira porque o Postgres não altera pedaço de corpo de função: o
  resto dela é igual à 0027, linha por linha.
*/
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
                   'historyDays', 'pairEncouragementsPerDay') then
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
-- 3. o teto aplicado no envio
-- ---------------------------------------------------------------------------

/*
  Igual à 0049, com o limite do plano antes do insert.

  A contagem é por DIA LOCAL de quem manda, o mesmo `local_day_of` que o
  registro do dia usa: contado em UTC, quem manda às 22h de Brasília gastaria
  a vaga do dia seguinte.

  Reenviar o MESMO gesto continua não custando vaga: a busca pelo registro de
  hoje acontece ANTES da checagem, então quem clica duas vezes achando que não
  enviou recebe de volta o que já existia, como na 0049.
*/
create or replace function public.pair_send_encouragement(p_kind public.encouragement_kind)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  quem   uuid := auth.uid();
  qual   uuid;
  outro  uuid;
  novo   uuid;
  dia    date;
  plano  public.plan_tier;
  teto   int;
  usados int;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  qual := public.my_pair_id();
  if qual is null then
    raise exception 'você não está em uma dupla' using errcode = '22023';
  end if;

  select m.user_id into outro from public.pair_members m
   where m.pair_id = qual and m.left_at is null and m.user_id <> quem
   limit 1;

  if outro is null then
    raise exception 'sua dupla está incompleta' using errcode = '22023';
  end if;

  dia := public.local_day_of(quem);

  select id into novo from public.pair_encouragements
   where pair_id = qual and sender_id = quem and kind = p_kind and day = dia;

  if novo is not null then
    return novo;
  end if;

  plano := public.plan_for_user(quem);
  select (value ->> 'pairEncouragementsPerDay')::int into teto
    from public.product_settings
   where key = 'plans.' || plano::text;

  if teto is not null then
    select count(*) into usados from public.pair_encouragements
     where pair_id = qual and sender_id = quem and day = dia;

    if usados >= teto then
      /*
        O texto é escrito pra ser LIDO na tela.

        O 22023 sobe como `DomainError` com a mensagem original (ver
        `infrastructure/supabase/rpc.ts`), então o que estiver aqui é o que a
        pessoa vê. Nada de código interno, e o plural montado à mão porque o
        teto é configurável e um dia pode ser 2.
      */
      raise exception 'No teu plano cabe % por dia. Os três gestos, todo dia, fazem parte do PRO.',
        case when teto = 1 then '1 incentivo' else teto || ' incentivos' end
        using errcode = '22023';
    end if;
  end if;

  insert into public.pair_encouragements (pair_id, sender_id, recipient_id, kind, day)
  values (qual, quem, outro, p_kind, dia)
  on conflict (pair_id, sender_id, kind, day) do nothing
  returning id into novo;

  if novo is null then
    select id into novo from public.pair_encouragements
     where pair_id = qual and sender_id = quem and kind = p_kind and day = dia;
  end if;

  return novo;
end;
$fn$;

revoke all on function public.pair_send_encouragement(public.encouragement_kind) from public;
revoke all on function public.pair_send_encouragement(public.encouragement_kind) from anon;
grant execute on function public.pair_send_encouragement(public.encouragement_kind) to authenticated;
