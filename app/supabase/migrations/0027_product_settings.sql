-- Momentumm — configurações do produto.
--
-- Uma tabela chave/valor, com as chaves FECHADAS: só o owner escreve, cada
-- chave tem um validador de forma, e toda mudança grava antes e depois na
-- auditoria. As chaves públicas (manutenção, mensagem do sistema, recursos
-- ligados, versão dos termos) saem por `public_settings()` pra qualquer
-- sessão; o resto só o painel lê.
--
-- Os limites de plano em `domain/entities/plan.ts` continuam sendo o que o
-- app conhece em tempo de build. O que mora aqui é o que o SERVIDOR aplica:
-- a franquia da IA, o teto diário de segurança, o desligamento geral da IA.
-- A Edge Function lê `ai.limits` antes de cada chamada.

create table if not exists public.product_settings (
  key         text primary key check (key ~ '^[a-z_.]{3,40}$'),
  value       jsonb not null,
  description text not null,
  public      boolean not null default false,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint product_settings_value_size check (pg_column_size(value) <= 4096)
);

alter table public.product_settings enable row level security;
-- Sem política: leitura pelo painel por função; escrita por função do owner.

insert into public.product_settings (key, value, description, public) values
  ('plans.free', jsonb_build_object(
      'activeObjectives', 2, 'activeHabits', 5, 'activePlans', 1, 'actionsPerDay', 5, 'historyDays', 15
    ), 'Limites do plano gratuito aplicados no servidor.', false),
  ('plans.pro', jsonb_build_object(
      'activeObjectives', null, 'activeHabits', null, 'activePlans', null, 'actionsPerDay', null, 'historyDays', null
    ), 'Limites do plano PRO (nulo = sem limite).', false),
  ('ai.limits', jsonb_build_object(
      'enabled', true,
      'monthlyPerPlan', jsonb_build_object('free', 0, 'pro', 150),
      'dailySafetyLimit', 25,
      'perMinute', 5,
      'costAlertUsd', 50,
      'costPerMillionInputUsd', null,
      'costPerMillionOutputUsd', null,
      'abuseBlockMinutes', 60,
      'kinds', jsonb_build_object('plan', true, 'day', true, 'progress', true, 'review_draft', true, 'recovery', true)
    ), 'Franquia, teto diário, bloqueio e disponibilidade da Momentumm AI.', false),
  ('features', jsonb_build_object(
      'ai', true, 'share', true, 'circle', true, 'challenges', true, 'recovery', true, 'adaptiveDay', true
    ), 'Recursos ligados pra todo mundo.', true),
  ('experimental', jsonb_build_object(), 'Recursos experimentais, por chave.', true),
  ('maintenance', jsonb_build_object('enabled', false, 'message', ''), 'Manutenção temporária.', true),
  ('system.message', jsonb_build_object('enabled', false, 'text', '', 'tone', 'info'), 'Aviso geral no topo do app.', true),
  ('legal.versions', jsonb_build_object('termos', '2026-09-11', 'privacidade', '2026-09-11'), 'Versões vigentes dos Termos e da Política.', true)
on conflict (key) do nothing;

/* O que qualquer sessão pode ler: só chaves públicas. */
create or replace function public.public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
    from public.product_settings s
   where s.public;
$$;

revoke all on function public.public_settings() from public;
grant execute on function public.public_settings() to anon;
grant execute on function public.public_settings() to authenticated;

/* Uma chave, pra função da IA e pro painel. Nunca pra API pública. */
create or replace function public.setting_value(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.value from public.product_settings s where s.key = p_key;
$$;

revoke all on function public.setting_value(text) from public;
revoke all on function public.setting_value(text) from anon;
revoke all on function public.setting_value(text) from authenticated;
grant execute on function public.setting_value(text) to service_role;

create or replace function public.admin_get_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role('owner', 'admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', s.key, 'value', s.value, 'description', s.description, 'public', s.public,
      'updated_at', s.updated_at, 'updated_by_name', p.name
    ) order by s.key)
    from public.product_settings s
    left join public.profiles p on p.id = s.updated_by
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_get_settings() from public;
revoke all on function public.admin_get_settings() from anon;
grant execute on function public.admin_get_settings() to authenticated;

/*
  Validação de forma por chave. Valor que não bate é recusado antes de
  gravar — o painel também valida, mas a regra que vale é esta.
*/
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
  else
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;
end;
$$;

/* Owner, com verificação recente, com motivo, com antes e depois. */
create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous jsonb;
begin
  perform public.assert_admin_step_up('owner');

  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo da alteração' using errcode = '22023';
  end if;

  perform public.validate_setting(p_key, p_value);

  select value into previous from public.product_settings where key = p_key;
  if previous is null then
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;

  update public.product_settings
     set value = p_value, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  perform public.record_admin_audit(
    'setting.update', 'product_setting', p_key, null, 'ok', btrim(p_reason), previous, p_value
  );
end;
$$;

revoke all on function public.admin_update_setting(text, jsonb, text) from public;
revoke all on function public.admin_update_setting(text, jsonb, text) from anon;
grant execute on function public.admin_update_setting(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- bloqueio de IA por abuso (owner e admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_block_ai(p_user uuid, p_minutes integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if p_minutes is null or p_minutes < 1 or p_minutes > 43200 then
    raise exception 'duração entre 1 minuto e 30 dias' using errcode = '22023';
  end if;

  insert into public.ai_blocks (user_id, until, reason, created_by)
  values (p_user, now() + make_interval(mins => p_minutes), btrim(p_reason), auth.uid())
  on conflict (user_id) do update
    set until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();

  perform public.record_admin_audit('ai.block', 'ai_block', p_user::text, p_user, 'ok', btrim(p_reason),
    null, jsonb_build_object('minutes', p_minutes));
end;
$$;

revoke all on function public.admin_block_ai(uuid, integer, text) from public;
revoke all on function public.admin_block_ai(uuid, integer, text) from anon;
grant execute on function public.admin_block_ai(uuid, integer, text) to authenticated;

create or replace function public.admin_unblock_ai(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role('owner', 'admin');
  delete from public.ai_blocks where user_id = p_user;
  perform public.record_admin_audit('ai.unblock', 'ai_block', p_user::text, p_user, 'ok', btrim(p_reason));
end;
$$;

revoke all on function public.admin_unblock_ai(uuid, text) from public;
revoke all on function public.admin_unblock_ai(uuid, text) from anon;
grant execute on function public.admin_unblock_ai(uuid, text) to authenticated;
