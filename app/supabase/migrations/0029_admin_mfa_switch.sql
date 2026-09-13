-- Momentumm — interruptor da exigência de MFA no painel.
--
-- `admin.security.requireMfa` (product_settings) decide se o painel exige
-- o segundo fator. LIGADO é o padrão e é o que a 0023 sempre fez: aal2,
-- sessão de 60 min, step-up de 5 min. DESLIGADO deixa qualquer sessão com
-- papel entrar e agir — serve pro começo, com uma pessoa só operando, e
-- fica visível em vermelho no painel enquanto durar.
--
-- Só o owner muda (pelo `admin_update_setting`, com auditoria). O sentido
-- da regra continua no banco: a tela lê `admin_me()` pra saber qual porta
-- mostrar, mas quem decide é `admin_mfa_required()` dentro de cada função.

insert into public.product_settings (key, value, description, public)
values ('admin.security', jsonb_build_object('requireMfa', true),
        'Exigir verificação em duas etapas pra entrar e agir no painel.', false)
on conflict (key) do nothing;

create or replace function public.admin_mfa_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((s.value ->> 'requireMfa')::boolean, true)
    from public.product_settings s
   where s.key = 'admin.security';
$$;

revoke all on function public.admin_mfa_required() from public;
revoke all on function public.admin_mfa_required() from anon;
grant execute on function public.admin_mfa_required() to authenticated;
grant execute on function public.admin_mfa_required() to service_role;

create or replace function public.admin_session_valid()
returns boolean
language sql
stable
as $$
  select (not public.admin_mfa_required())
      or (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          and coalesce(public.admin_mfa_verified_at() > now() - public.admin_session_max_age(), false));
$$;

create or replace function public.admin_step_up_valid()
returns boolean
language sql
stable
as $$
  select (not public.admin_mfa_required())
      or (public.admin_session_valid()
          and coalesce(public.admin_mfa_verified_at() > now() - public.admin_step_up_max_age(), false));
$$;

create or replace function public.assert_admin_role(variadic allowed public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role_value public.app_role;
begin
  select r.role into current_role_value
    from public.user_roles r
   where r.user_id = auth.uid();

  if current_role_value is null then
    raise exception 'sem permissão para esta operação' using errcode = '42501';
  end if;

  if public.admin_mfa_required() then
    if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'esta operação exige verificação em duas etapas'
        using errcode = '42501';
    end if;

    if not coalesce(public.admin_mfa_verified_at() > now() - public.admin_session_max_age(), false) then
      raise exception 'sessão administrativa expirada: confirme o segundo fator de novo'
        using errcode = '42501';
    end if;
  end if;

  if not (current_role_value = any (allowed)) then
    raise exception 'sem permissão para esta operação' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_admin_step_up(variadic allowed public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role(variadic allowed);

  if public.admin_mfa_required()
     and not coalesce(public.admin_mfa_verified_at() > now() - public.admin_step_up_max_age(), false) then
    raise exception 'ação crítica: confirme o segundo fator novamente'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'role', public.admin_role(),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'mfa_required', public.admin_mfa_required(),
    'mfa_verified_at', public.admin_mfa_verified_at(),
    'session_valid', public.admin_session_valid(),
    'session_expires_at', public.admin_mfa_verified_at() + public.admin_session_max_age(),
    'step_up_valid', public.admin_step_up_valid(),
    'step_up_expires_at', public.admin_mfa_verified_at() + public.admin_step_up_max_age()
  );
$$;

/* A validação de forma ganha a chave nova. */
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
  else
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;
end;
$$;
