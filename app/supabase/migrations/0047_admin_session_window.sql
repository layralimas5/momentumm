-- Momentumm — a sessão do painel passa a durar um dia de trabalho.
--
-- A janela era fixa em 60 minutos, o que obrigava a abrir o autenticador
-- a cada hora pra continuar no mesmo painel. Esse atrito é o motivo real
-- pelo qual a verificação em duas etapas acabou desligada: quando a
-- proteção incomoda toda hora, ela vira a primeira coisa a sair.
--
-- Agora são 8 horas por padrão, e o valor fica em `admin.security`, junto
-- do interruptor, pra ser ajustado sem deploy.
--
-- O que NÃO muda: o step-up de 5 minutos. Suspender conta, conceder papel,
-- apagar auditoria ou mexer em configuração sensível continuam pedindo o
-- código na hora. É ali que o segundo fator importa de verdade, e ali ele
-- custa um código a cada bloco de ações, não um por hora de uso.

update public.product_settings
   set value = value || jsonb_build_object('sessionMinutes', 480),
       description = 'Exigir verificação em duas etapas pra entrar e agir no painel, e por quanto tempo a sessão vale.'
 where key = 'admin.security'
   and not (value ? 'sessionMinutes');

/* A janela vem da configuração; fora de faixa, volta pro padrão. */
create or replace function public.admin_session_max_age()
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select make_interval(mins => least(greatest(coalesce(
    (select (s.value ->> 'sessionMinutes')::int from public.product_settings s where s.key = 'admin.security'),
    480), 5), 1440));
$$;

revoke all on function public.admin_session_max_age() from public, anon;
grant execute on function public.admin_session_max_age() to authenticated, service_role;

/* A validação de forma aceita a chave nova, e recusa valor fora da faixa. */
create or replace function public.validate_setting(p_key text, p_value jsonb)
returns void
language plpgsql
immutable
as $$
  declare k text;
begin
  if p_key in ('plans.free', 'plans.pro') then
    for k in select jsonb_object_keys(p_value) loop
      if k not in ('activeObjectives', 'activeHabits', 'activePlans', 'actionsPerDay', 'historyDays') then
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
  elsif p_key = 'admin.security' then
    if jsonb_typeof(p_value -> 'requireMfa') <> 'boolean' then
      raise exception 'admin.security precisa de requireMfa booleano' using errcode = '22023';
    end if;
    if p_value ? 'sessionMinutes' then
      if jsonb_typeof(p_value -> 'sessionMinutes') <> 'number' then
        raise exception 'sessionMinutes precisa ser número' using errcode = '22023';
      end if;
      if (p_value ->> 'sessionMinutes')::int < 5 or (p_value ->> 'sessionMinutes')::int > 1440 then
        raise exception 'sessionMinutes vai de 5 minutos a 24 horas' using errcode = '22023';
      end if;
    end if;
  else
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;
end;
$$;
