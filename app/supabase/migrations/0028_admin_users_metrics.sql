-- Momentumm — o que o painel lê e o que ele faz com contas.
--
-- Toda função aqui é `security definer` com papel checado na primeira linha
-- e revoke explícito ao `anon`. Nenhuma devolve conteúdo pessoal: título de
-- objetivo, texto de ação, nota, foto, prompt e review ficam fora de todos
-- os SELECTs deste arquivo — o que sai é contagem, data, estado e plano.
--
-- E-mail sai mascarado sempre. Id interno sai inteiro: o suporte precisa
-- dele pra achar a conta, e ele não identifica ninguém fora do sistema.

-- ---------------------------------------------------------------------------
-- estado da conta
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.account_state as enum ('ativa', 'suspensa', 'exclusao_solicitada');
exception when duplicate_object then null; end $$;

create table if not exists public.account_status (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  status        public.account_state not null default 'ativa',
  reason        text check (reason is null or char_length(reason) <= 280),
  request_id    uuid references public.support_requests (id) on delete set null,
  scheduled_for timestamptz,
  changed_by    uuid references auth.users (id) on delete set null,
  changed_at    timestamptz not null default now()
);

alter table public.account_status enable row level security;

drop policy if exists "dono lê o estado da própria conta" on public.account_status;
create policy "dono lê o estado da própria conta"
  on public.account_status for select
  to authenticated
  using (auth.uid() = user_id);

/* Quem esteve ativo no intervalo: qualquer evento de uso ou um login. */
create or replace function public.active_user_ids(p_from timestamptz, p_to timestamptz)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct e.user_id from public.product_events e
   where e.user_id is not null and e.created_at >= p_from and e.created_at < p_to
  union
  select u.id from auth.users u
   where u.last_sign_in_at >= p_from and u.last_sign_in_at < p_to;
$$;

revoke all on function public.active_user_ids(timestamptz, timestamptz) from public;
revoke all on function public.active_user_ids(timestamptz, timestamptz) from anon;
revoke all on function public.active_user_ids(timestamptz, timestamptz) from authenticated;

-- ---------------------------------------------------------------------------
-- ações sobre contas (owner e admin, com verificação recente)
-- ---------------------------------------------------------------------------

/* Suspender: bloqueia login e refresh no GoTrue e derruba as sessões abertas. */
create or replace function public.admin_suspend_user(p_user uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo da suspensão' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'não é possível suspender a própria conta' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = 'owner') then
    raise exception 'owner não pode ser suspenso por aqui' using errcode = '42501';
  end if;

  update auth.users set banned_until = now() + interval '100 years' where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;

  insert into public.account_status (user_id, status, reason, changed_by)
  values (p_user, 'suspensa', btrim(p_reason), auth.uid())
  on conflict (user_id) do update
    set status = 'suspensa', reason = excluded.reason, changed_by = excluded.changed_by, changed_at = now();

  perform public.record_admin_audit('user.suspend', 'user', p_user::text, p_user, 'ok', btrim(p_reason),
    null, null, p_context);
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text, jsonb) from public;
revoke all on function public.admin_suspend_user(uuid, text, jsonb) from anon;
grant execute on function public.admin_suspend_user(uuid, text, jsonb) to authenticated;

create or replace function public.admin_reactivate_user(p_user uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_step_up('owner', 'admin');

  update auth.users set banned_until = null where id = p_user;

  insert into public.account_status (user_id, status, reason, changed_by)
  values (p_user, 'ativa', btrim(p_reason), auth.uid())
  on conflict (user_id) do update
    set status = 'ativa', reason = excluded.reason, request_id = null, scheduled_for = null,
        changed_by = excluded.changed_by, changed_at = now();

  perform public.record_admin_audit('user.reactivate', 'user', p_user::text, p_user, 'ok', btrim(p_reason),
    null, null, p_context);
end;
$$;

revoke all on function public.admin_reactivate_user(uuid, text, jsonb) from public;
revoke all on function public.admin_reactivate_user(uuid, text, jsonb) from anon;
grant execute on function public.admin_reactivate_user(uuid, text, jsonb) to authenticated;

/* Derrubar todas as sessões: o que se faz quando há suspeita de conta invadida. */
create or replace function public.admin_revoke_sessions(p_user uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo' using errcode = '22023';
  end if;

  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;

  perform public.record_admin_audit('user.revoke_sessions', 'user', p_user::text, p_user, 'ok', btrim(p_reason),
    null, null, p_context);
end;
$$;

revoke all on function public.admin_revoke_sessions(uuid, text, jsonb) from public;
revoke all on function public.admin_revoke_sessions(uuid, text, jsonb) from anon;
grant execute on function public.admin_revoke_sessions(uuid, text, jsonb) to authenticated;

/*
  Iniciar a exclusão: só a partir de uma solicitação de exclusão ABERTA
  PELA PRÓPRIA PESSOA. Marca, bloqueia o login, derruba as sessões e agenda
  pra sete dias — a janela de arrependimento. A remoção física é da Edge
  Function `admin-actions` (`complete_deletion`), que apaga os arquivos e a
  conta com service role.
*/
create or replace function public.admin_start_deletion(p_user uuid, p_request uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  scheduled timestamptz := now() + interval '7 days';
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if not exists (
    select 1 from public.support_requests r
     where r.id = p_request and r.user_id = p_user and r.category = 'exclusao'
       and r.status not in ('resolvida', 'fechada')
  ) then
    raise exception 'a exclusão exige uma solicitação de exclusão aberta pela própria pessoa'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user) then
    raise exception 'remova o papel administrativo antes de excluir a conta' using errcode = '42501';
  end if;

  update auth.users set banned_until = now() + interval '100 years' where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;

  insert into public.account_status (user_id, status, reason, request_id, scheduled_for, changed_by)
  values (p_user, 'exclusao_solicitada', btrim(p_reason), p_request, scheduled, auth.uid())
  on conflict (user_id) do update
    set status = 'exclusao_solicitada', reason = excluded.reason, request_id = excluded.request_id,
        scheduled_for = excluded.scheduled_for, changed_by = excluded.changed_by, changed_at = now();

  update public.support_requests set status = 'em_andamento', updated_at = now() where id = p_request;
  insert into public.support_request_events (request_id, actor_id, actor_kind, type, note)
  values (p_request, auth.uid(), 'equipe', 'exclusao_iniciada', 'Exclusão agendada para ' || to_char(scheduled, 'DD/MM/YYYY'));

  perform public.record_admin_audit('user.deletion_start', 'user', p_user::text, p_user, 'ok', btrim(p_reason),
    null, jsonb_build_object('request_id', p_request, 'scheduled_for', scheduled), p_context);

  return jsonb_build_object('scheduled_for', scheduled);
end;
$$;

revoke all on function public.admin_start_deletion(uuid, uuid, text, jsonb) from public;
revoke all on function public.admin_start_deletion(uuid, uuid, text, jsonb) from anon;
grant execute on function public.admin_start_deletion(uuid, uuid, text, jsonb) to authenticated;

/* A Edge Function confirma que pode apagar: agendado, prazo vencido, e nada mudou. */
create or replace function public.deletion_ready(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_status s
     where s.user_id = p_user and s.status = 'exclusao_solicitada' and s.scheduled_for <= now()
  );
$$;

revoke all on function public.deletion_ready(uuid) from public;
revoke all on function public.deletion_ready(uuid) from anon;
revoke all on function public.deletion_ready(uuid) from authenticated;
grant execute on function public.deletion_ready(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- usuários: lista e detalhe
-- ---------------------------------------------------------------------------

/* O cartão administrativo de uma conta. Nada de conteúdo, só contagem e estado. */
create or replace function public.admin_user_card(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', u.id,
    'name', p.name,
    'handle', p.handle,
    'email_masked', public.mask_email(u.email),
    'plan', p.plan,
    'status', coalesce(s.status, 'ativa'),
    'status_reason', s.reason,
    'status_scheduled_for', s.scheduled_for,
    'created_at', u.created_at,
    'last_seen_at', greatest(u.last_sign_in_at, (select max(e.created_at) from public.product_events e where e.user_id = u.id)),
    'email_confirmed', u.email_confirmed_at is not null,
    'mfa_enabled', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    'onboarding_done', exists (select 1 from public.objectives o where o.user_id = u.id)
                       or exists (select 1 from public.product_events e where e.user_id = u.id and e.name = 'onboarding_completed'),
    'objectives_count', (select count(*) from public.objectives o where o.user_id = u.id and o.archived_at is null),
    'habits_count', (select count(*) from public.habits h where h.user_id = u.id and h.archived_at is null),
    'tasks_count', (select count(*) from public.tasks t where t.user_id = u.id),
    'tasks_completed_7d', (select count(*) from public.tasks t where t.user_id = u.id and t.status = 'feita' and t.completed_at > now() - interval '7 days'),
    'ai_calls_total', (select count(*) from public.ai_calls c where c.user_id = u.id and c.status = 'ok'),
    'ai_blocked_until', (select b.until from public.ai_blocks b where b.user_id = u.id and b.until > now()),
    'open_requests', (select count(*) from public.support_requests r where r.user_id = u.id and r.status not in ('resolvida', 'fechada')),
    'role', (select r.role from public.user_roles r where r.user_id = u.id)
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.account_status s on s.user_id = u.id
  where u.id = p_user;
$$;

revoke all on function public.admin_user_card(uuid) from public;
revoke all on function public.admin_user_card(uuid) from anon;
revoke all on function public.admin_user_card(uuid) from authenticated;

create or replace function public.admin_list_users(
  p_search text default null,
  p_plan public.plan_tier default null,
  p_status public.account_state default null,
  p_onboarding boolean default null,
  p_active_within_days integer default null,
  p_created_from date default null,
  p_created_to date default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
  term text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  return (
    with filtered as (
      select u.id, u.created_at
        from auth.users u
        left join public.profiles p on p.id = u.id
        left join public.account_status s on s.user_id = u.id
       where u.deleted_at is null
         and (term is null
              or p.name ilike '%' || term || '%'
              or p.handle ilike '%' || term || '%'
              or lower(u.email) = lower(term)
              or u.id::text = term)
         and (p_plan is null or p.plan = p_plan)
         and (p_status is null or coalesce(s.status, 'ativa') = p_status)
         and (p_onboarding is null or (
              exists (select 1 from public.objectives o where o.user_id = u.id)
              or exists (select 1 from public.product_events e where e.user_id = u.id and e.name = 'onboarding_completed')
             ) = p_onboarding)
         and (p_active_within_days is null or u.id in (
              select * from public.active_user_ids(now() - make_interval(days => p_active_within_days), now())))
         and (p_created_from is null or u.created_at >= p_created_from)
         and (p_created_to is null or u.created_at < p_created_to + 1)
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce((
        select jsonb_agg(public.admin_user_card(f.id) order by f.created_at desc)
          from (select * from filtered order by created_at desc limit size offset (page - 1) * size) f
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_users(text, public.plan_tier, public.account_state, boolean, integer, date, date, integer, integer) from public;
revoke all on function public.admin_list_users(text, public.plan_tier, public.account_state, boolean, integer, date, date, integer, integer) from anon;
grant execute on function public.admin_list_users(text, public.plan_tier, public.account_state, boolean, integer, date, date, integer, integer) to authenticated;

/*
  O detalhe. Support recebe o cartão, as solicitações e os pedidos de acesso;
  owner e admin recebem também assinatura (sem dado de cartão — ele nem
  existe aqui), uso da IA por tipo e a auditoria sobre a conta.
*/
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value public.app_role;
  card jsonb;
  result jsonb;
begin
  perform public.assert_admin_role('owner', 'admin', 'support');
  role_value := public.admin_role();

  card := public.admin_user_card(p_user);
  if card is null then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;

  result := card || jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'protocol', r.protocol, 'category', r.category,
        'status', r.status, 'priority', r.priority, 'subject', r.subject, 'opened_at', r.opened_at) order by r.opened_at desc)
      from public.support_requests r where r.user_id = p_user
    ), '[]'::jsonb),
    'access_grants', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'status', public.access_grant_effective_status(g),
        'scopes', g.scopes, 'expires_at', g.expires_at, 'requested_by', g.requested_by) order by g.requested_at desc)
      from public.support_access_grants g where g.user_id = p_user
    ), '[]'::jsonb)
  );

  if role_value in ('owner', 'admin') then
    result := result || jsonb_build_object(
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'provider', s.provider, 'plan', s.plan, 'interval', s.interval,
          'status', s.status, 'amount_cents', s.amount_cents, 'currency', s.currency, 'started_at', s.started_at,
          'current_period_end', s.current_period_end, 'canceled_at', s.canceled_at, 'trial_ends_at', s.trial_ends_at)
          order by s.created_at desc)
        from public.subscriptions s where s.user_id = p_user
      ), '[]'::jsonb),
      'subscription_events', coalesce((
        select jsonb_agg(jsonb_build_object('type', e.type, 'amount_cents', e.amount_cents, 'occurred_at', e.occurred_at)
          order by e.occurred_at desc)
        from public.subscription_events e where e.user_id = p_user
      ), '[]'::jsonb),
      'cancellations', coalesce((
        select jsonb_agg(jsonb_build_object('reason', c.reason, 'status', c.status, 'created_at', c.created_at,
          'tenure_days', c.tenure_days) order by c.created_at desc)
        from public.cancellation_requests c where c.user_id = p_user
      ), '[]'::jsonb),
      'ai_usage', coalesce((
        select jsonb_agg(jsonb_build_object('kind', k.kind, 'count', k.n) order by k.n desc)
        from (select kind, count(*) n from public.ai_calls where user_id = p_user and status = 'ok' group by kind) k
      ), '[]'::jsonb),
      'ai_calls_month', (select count(*) from public.ai_calls c where c.user_id = p_user and c.status = 'ok'
        and c.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'),
      'audit', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'result', a.result, 'reason', a.reason,
          'actor_role', a.actor_role, 'created_at', a.created_at) order by a.created_at desc)
        from (select * from public.audit_logs a where a.target_user_id = p_user order by a.created_at desc limit 50) a
      ), '[]'::jsonb)
    );
  end if;

  perform public.record_admin_audit('user.view', 'user', p_user::text, p_user);

  return result;
end;
$$;

revoke all on function public.admin_user_detail(uuid) from public;
revoke all on function public.admin_user_detail(uuid) from anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

/* Exportar o que o painel sabe da conta (metadados). Verificação recente e motivo. */
create or replace function public.admin_export_user_admin_data(p_user uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_admin_step_up('owner', 'admin');
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo da exportação' using errcode = '22023';
  end if;

  result := public.admin_user_detail(p_user);
  result := jsonb_build_object('schema', 'momentumm.admin-export.v1', 'exported_at', now(), 'account', result);

  perform public.record_admin_audit('user.export_admin_data', 'user', p_user::text, p_user, 'ok', btrim(p_reason));
  return result;
end;
$$;

revoke all on function public.admin_export_user_admin_data(uuid, text) from public;
revoke all on function public.admin_export_user_admin_data(uuid, text) from anon;
grant execute on function public.admin_export_user_admin_data(uuid, text) to authenticated;

/* Logs da conta, inteiros. Owner e admin. */
create or replace function public.admin_user_logs(p_user uuid, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role('owner', 'admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'resource_type', a.resource_type,
      'resource_id', a.resource_id, 'result', a.result, 'reason', a.reason, 'actor_id', a.actor_id,
      'actor_role', a.actor_role, 'before', a.before, 'after', a.after, 'created_at', a.created_at)
      order by a.created_at desc)
    from (select * from public.audit_logs a where a.target_user_id = p_user or a.actor_id = p_user
           order by a.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) a
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_user_logs(uuid, integer) from public;
revoke all on function public.admin_user_logs(uuid, integer) from anon;
grant execute on function public.admin_user_logs(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- visão geral
-- ---------------------------------------------------------------------------

/* Um período, em números. Chamado duas vezes pela visão geral: atual e anterior. */
create or replace function public.admin_period_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'new_users', (select count(*) from auth.users u where u.created_at >= p_from and u.created_at < p_to and u.deleted_at is null),
    'active_users', (select count(*) from public.active_user_ids(p_from, p_to)),
    'new_subscriptions', (select count(*) from public.subscription_events e where e.type in ('criada', 'trial_convertido') and e.occurred_at >= p_from and e.occurred_at < p_to),
    'cancellations', (select count(*) from public.cancellation_requests c where c.created_at >= p_from and c.created_at < p_to),
    'ai_calls', (select count(*) from public.ai_calls c where c.status = 'ok' and c.created_at >= p_from and c.created_at < p_to),
    'ai_users', (select count(distinct c.user_id) from public.ai_calls c where c.status = 'ok' and c.created_at >= p_from and c.created_at < p_to),
    'errors', (select count(*) from public.app_error_occurrences o where o.created_at >= p_from and o.created_at < p_to),
    'requests_opened', (select count(*) from public.support_requests r where r.opened_at >= p_from and r.opened_at < p_to),
    'onboarding_completed', (select count(*) from public.product_events e where e.name = 'onboarding_completed' and e.created_at >= p_from and e.created_at < p_to),
    'activated', (
      select count(*) from auth.users u
       where u.created_at >= p_from and u.created_at < p_to
         and exists (select 1 from public.objectives o where o.user_id = u.id)
         and exists (select 1 from public.tasks t where t.user_id = u.id)
    ),
    'retention_rate', (
      with previous as (select * from public.active_user_ids(p_from - (p_to - p_from), p_from)),
           current_period as (select * from public.active_user_ids(p_from, p_to))
      select case when (select count(*) from previous) = 0 then null
             else round(100.0 * (select count(*) from previous pr where pr.active_user_ids in (select * from current_period))
                        / (select count(*) from previous), 1) end
    )
  );
$$;

revoke all on function public.admin_period_stats(timestamptz, timestamptz) from public;
revoke all on function public.admin_period_stats(timestamptz, timestamptz) from anon;
revoke all on function public.admin_period_stats(timestamptz, timestamptz) from authenticated;

create or replace function public.admin_mrr_cents()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when s.interval = 'mensal' then s.amount_cents else s.amount_cents / 12 end), 0)::bigint
    from public.subscriptions s
   where s.status in ('ativa', 'trial') and s.plan = 'pro';
$$;

revoke all on function public.admin_mrr_cents() from public;
revoke all on function public.admin_mrr_cents() from anon;
revoke all on function public.admin_mrr_cents() from authenticated;

create or replace function public.admin_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  span interval := to_ts - from_ts;
  today_start timestamptz := date_trunc('day', now());
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  if p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'current', public.admin_period_stats(from_ts, to_ts),
    'previous', public.admin_period_stats(from_ts - span, from_ts),
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users u where u.deleted_at is null),
      'free_users', (select count(*) from public.profiles p where p.plan = 'free'),
      'pro_users', (select count(*) from public.profiles p where p.plan = 'pro'),
      'active_today', (select count(*) from public.active_user_ids(today_start, now())),
      'active_7d', (select count(*) from public.active_user_ids(now() - interval '7 days', now())),
      'active_30d', (select count(*) from public.active_user_ids(now() - interval '30 days', now())),
      'active_subscriptions', (select count(*) from public.subscriptions s where s.status in ('ativa', 'trial')),
      'conversion_rate', (
        select case when count(*) = 0 then null else round(100.0 * count(*) filter (where p.plan = 'pro') / count(*), 1) end
          from public.profiles p
      ),
      'mrr_cents', public.admin_mrr_cents(),
      'errors_24h', (select count(*) from public.app_error_occurrences o where o.created_at > now() - interval '24 hours'),
      'errors_open', (select count(*) from public.app_errors e where e.status in ('novo', 'analisando')),
      'requests_pending', (select count(*) from public.support_requests r where r.status in ('aberta', 'em_andamento')),
      'requests_overdue', (select count(*) from public.support_requests r where r.status in ('aberta', 'em_andamento') and r.due_at < now()),
      'active_access_grants', (select count(*) from public.support_access_grants g where g.status = 'ativo' and g.expires_at > now())
    ),
    'health', jsonb_build_object(
      'database', 'ok',
      'ai_enabled', coalesce((public.setting_value('ai.limits') ->> 'enabled')::boolean, true),
      'ai_error_rate_24h', (
        select case when count(*) = 0 then null else round(100.0 * count(*) filter (where c.status = 'erro') / count(*), 1) end
          from public.ai_calls c where c.created_at > now() - interval '24 hours'
      ),
      'ai_avg_ms_24h', (select round(avg(c.duration_ms)) from public.ai_calls c where c.status = 'ok' and c.created_at > now() - interval '24 hours'),
      'critical_errors_24h', (
        select count(*) from public.app_error_occurrences o join public.app_errors e on e.id = o.error_id
         where e.severity = 'critica' and o.created_at > now() - interval '24 hours'
      ),
      'maintenance', coalesce((public.setting_value('maintenance') ->> 'enabled')::boolean, false),
      'availability_7d', (
        with hours as (
          select generate_series(date_trunc('hour', now()) - interval '7 days', date_trunc('hour', now()), interval '1 hour') h
        ), bad as (
          select distinct date_trunc('hour', o.created_at) h
            from public.app_error_occurrences o join public.app_errors e on e.id = o.error_id
           where e.severity = 'critica' and o.created_at > now() - interval '7 days'
        )
        select round(100.0 * (select count(*) from hours where h not in (select h from bad)) / (select count(*) from hours), 2)
      )
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'active', d.active, 'new_users', d.new_users, 'ai_calls', d.ai_calls, 'errors', d.errors) order by d.day)
      from (
        select g.day::date as day,
          (select count(*) from public.active_user_ids(g.day, g.day + interval '1 day')) active,
          (select count(*) from auth.users u where u.created_at >= g.day and u.created_at < g.day + interval '1 day') new_users,
          (select count(*) from public.ai_calls c where c.status = 'ok' and c.created_at >= g.day and c.created_at < g.day + interval '1 day') ai_calls,
          (select count(*) from public.app_error_occurrences o where o.created_at >= g.day and o.created_at < g.day + interval '1 day') errors
        from generate_series(from_ts, to_ts - interval '1 day', interval '1 day') g(day)
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_overview(date, date) from public;
revoke all on function public.admin_overview(date, date) from anon;
grant execute on function public.admin_overview(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- assinaturas
-- ---------------------------------------------------------------------------

create or replace function public.admin_subscription_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from public.subscriptions group by status) s), '{}'::jsonb),
    'by_interval', coalesce((select jsonb_object_agg(s.interval, s.n) from (select interval, count(*) n from public.subscriptions where status in ('ativa', 'trial') group by interval) s), '{}'::jsonb),
    'free_users', (select count(*) from public.profiles where plan = 'free'),
    'pro_users', (select count(*) from public.profiles where plan = 'pro'),
    'mrr_cents', public.admin_mrr_cents(),
    'arr_cents', public.admin_mrr_cents() * 12,
    'events', coalesce((
      select jsonb_object_agg(e.type, e.n)
        from (select type, count(*) n from public.subscription_events where occurred_at >= from_ts and occurred_at < to_ts group by type) e
    ), '{}'::jsonb),
    'trials_active', (select count(*) from public.subscriptions where status = 'trial'),
    'conversion_rate', (
      select case when count(*) = 0 then null else round(100.0 * count(*) filter (where p.plan = 'pro') / count(*), 1) end from public.profiles p
    ),
    'period_conversion', (
      select count(distinct e.user_id) from public.subscription_events e
       where e.type in ('criada', 'trial_convertido') and e.occurred_at >= from_ts and e.occurred_at < to_ts
    ),
    'cancel_reasons', coalesce((
      select jsonb_object_agg(c.reason, c.n)
        from (select reason, count(*) n from public.cancellation_requests where created_at >= from_ts and created_at < to_ts group by reason) c
    ), '{}'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'new', d.new_subs, 'canceled', d.canceled, 'failed', d.failed) order by d.day)
      from (
        select g.day::date as day,
          (select count(*) from public.subscription_events e where e.type in ('criada', 'trial_convertido') and e.occurred_at >= g.day and e.occurred_at < g.day + interval '1 day') new_subs,
          (select count(*) from public.subscription_events e where e.type = 'cancelada' and e.occurred_at >= g.day and e.occurred_at < g.day + interval '1 day') canceled,
          (select count(*) from public.subscription_events e where e.type = 'pagamento_falhou' and e.occurred_at >= g.day and e.occurred_at < g.day + interval '1 day') failed
        from generate_series(from_ts, to_ts - interval '1 day', interval '1 day') g(day)
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_subscription_metrics(date, date) from public;
revoke all on function public.admin_subscription_metrics(date, date) from anon;
grant execute on function public.admin_subscription_metrics(date, date) to authenticated;

create or replace function public.admin_list_subscriptions(
  p_status public.subscription_status default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  return jsonb_build_object(
    'total', (select count(*) from public.subscriptions s where p_status is null or s.status = p_status),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'user_id', s.user_id, 'user_name', p.name, 'email_masked', public.mask_email(u.email),
        'provider', s.provider, 'plan', s.plan, 'interval', s.interval, 'status', s.status,
        'amount_cents', s.amount_cents, 'currency', s.currency, 'started_at', s.started_at,
        'current_period_end', s.current_period_end, 'canceled_at', s.canceled_at, 'trial_ends_at', s.trial_ends_at
      ) order by s.created_at desc)
      from (select * from public.subscriptions s where p_status is null or s.status = p_status
             order by s.created_at desc limit size offset (page - 1) * size) s
      join auth.users u on u.id = s.user_id
      left join public.profiles p on p.id = s.user_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_subscriptions(public.subscription_status, integer, integer) from public;
revoke all on function public.admin_list_subscriptions(public.subscription_status, integer, integer) from anon;
grant execute on function public.admin_list_subscriptions(public.subscription_status, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelamentos
-- ---------------------------------------------------------------------------

create or replace function public.admin_cancellations(p_from date, p_to date, p_page integer default 1, p_page_size integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  role_value public.app_role;
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');
  role_value := public.admin_role();

  -- Retenção limitada do comentário: limpa o vencido antes de listar.
  perform public.purge_expired_cancellation_comments();

  return jsonb_build_object(
    'count', (select count(*) from public.cancellation_requests c where c.created_at >= from_ts and c.created_at < to_ts),
    'rate', (
      select case when (select count(*) from public.subscriptions where status in ('ativa', 'trial', 'cancelada')) = 0 then null
             else round(100.0 * (select count(*) from public.cancellation_requests c where c.created_at >= from_ts and c.created_at < to_ts)
                        / (select count(*) from public.subscriptions where status in ('ativa', 'trial', 'cancelada')), 1) end
    ),
    'by_reason', coalesce((select jsonb_object_agg(c.reason, c.n) from (select reason, count(*) n from public.cancellation_requests where created_at >= from_ts and created_at < to_ts group by reason) c), '{}'::jsonb),
    'by_plan_interval', coalesce((select jsonb_object_agg(coalesce(c.interval::text, 'sem_assinatura'), c.n) from (select interval, count(*) n from public.cancellation_requests where created_at >= from_ts and created_at < to_ts group by interval) c), '{}'::jsonb),
    'avg_tenure_days', (select round(avg(tenure_days)) from public.cancellation_requests where created_at >= from_ts and created_at < to_ts),
    'retention_attempts', (select count(*) from public.cancellation_requests where retention_attempted and created_at >= from_ts and created_at < to_ts),
    'retained', (select count(*) from public.cancellation_requests where status = 'retido' and created_at >= from_ts and created_at < to_ts),
    'features_before', coalesce((
      select jsonb_object_agg(f.feature, f.n)
        from (select unnest(features_used) feature, count(*) n from public.cancellation_requests where created_at >= from_ts and created_at < to_ts group by 1) f
    ), '{}'::jsonb),
    'by_hour', coalesce((
      select jsonb_object_agg(h.hour::text, h.n) from (select extract(hour from created_at)::int as hour, count(*) n from public.cancellation_requests where created_at >= from_ts and created_at < to_ts group by 1) h
    ), '{}'::jsonb),
    'items', case when role_value = 'analyst' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'user_id', c.user_id, 'user_name', p.name, 'plan', c.plan, 'interval', c.interval,
        'reason', c.reason, 'tenure_days', c.tenure_days, 'created_at', c.created_at, 'status', c.status,
        'retention_attempted', c.retention_attempted, 'access_until', c.access_until, 'features_used', c.features_used,
        'comment', case when role_value in ('owner', 'admin') then c.comment else null end
      ) order by c.created_at desc)
      from (select * from public.cancellation_requests c where c.created_at >= from_ts and c.created_at < to_ts
             order by c.created_at desc limit size offset (page - 1) * size) c
      left join public.profiles p on p.id = c.user_id
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.admin_cancellations(date, date, integer, integer) from public;
revoke all on function public.admin_cancellations(date, date, integer, integer) from anon;
grant execute on function public.admin_cancellations(date, date, integer, integer) to authenticated;

create or replace function public.admin_update_cancellation(p_id uuid, p_status public.cancellation_status, p_retention_attempted boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous public.cancellation_requests%rowtype;
begin
  perform public.assert_admin_role('owner', 'admin', 'support');
  select * into previous from public.cancellation_requests where id = p_id;
  if previous.id is null then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;

  update public.cancellation_requests
     set status = coalesce(p_status, status),
         retention_attempted = coalesce(p_retention_attempted, retention_attempted)
   where id = p_id;

  perform public.record_admin_audit('cancellation.update', 'cancellation_request', p_id::text, previous.user_id, 'ok', p_reason,
    jsonb_build_object('status', previous.status, 'retention_attempted', previous.retention_attempted),
    jsonb_build_object('status', coalesce(p_status, previous.status), 'retention_attempted', coalesce(p_retention_attempted, previous.retention_attempted)));
end;
$$;

revoke all on function public.admin_update_cancellation(uuid, public.cancellation_status, boolean, text) from public;
revoke all on function public.admin_update_cancellation(uuid, public.cancellation_status, boolean, text) from anon;
grant execute on function public.admin_update_cancellation(uuid, public.cancellation_status, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Momentumm AI
-- ---------------------------------------------------------------------------

create or replace function public.admin_ai_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  limits jsonb := public.setting_value('ai.limits');
  in_rate numeric := (limits ->> 'costPerMillionInputUsd')::numeric;
  out_rate numeric := (limits ->> 'costPerMillionOutputUsd')::numeric;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'users', (select count(distinct user_id) from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts),
    'calls', (select count(*) from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts),
    'attempts', (select count(*) from public.ai_calls where created_at >= from_ts and created_at < to_ts),
    'errors', (select count(*) from public.ai_calls where status = 'erro' and created_at >= from_ts and created_at < to_ts),
    'limits_hit', (select count(*) from public.ai_calls where status = 'limite' and created_at >= from_ts and created_at < to_ts),
    'blocked', (select count(*) from public.ai_calls where status = 'bloqueado' and created_at >= from_ts and created_at < to_ts),
    'success_rate', (
      select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'ok') / count(*), 1) end
        from public.ai_calls where created_at >= from_ts and created_at < to_ts
    ),
    'avg_duration_ms', (select round(avg(duration_ms)) from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts),
    'p95_duration_ms', (select percentile_cont(0.95) within group (order by duration_ms) from public.ai_calls where status = 'ok' and duration_ms is not null and created_at >= from_ts and created_at < to_ts),
    'input_tokens', (select coalesce(sum(input_tokens), 0) from public.ai_calls where created_at >= from_ts and created_at < to_ts),
    'output_tokens', (select coalesce(sum(output_tokens), 0) from public.ai_calls where created_at >= from_ts and created_at < to_ts),
    'estimated_cost_usd', (
      select case when in_rate is null or out_rate is null then null
             else round((coalesce(sum(input_tokens), 0) * in_rate + coalesce(sum(output_tokens), 0) * out_rate) / 1000000.0, 2) end
        from public.ai_calls where created_at >= from_ts and created_at < to_ts
    ),
    'calls_per_user', (
      select case when count(distinct user_id) = 0 then null else round(count(*)::numeric / count(distinct user_id), 1) end
        from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts
    ),
    'by_kind', coalesce((
      select jsonb_object_agg(k.kind, jsonb_build_object('ok', k.ok, 'errors', k.errors, 'limits', k.limits, 'avg_ms', k.avg_ms))
        from (select kind, count(*) filter (where status = 'ok') ok, count(*) filter (where status = 'erro') errors,
                     count(*) filter (where status = 'limite') limits, round(avg(duration_ms) filter (where status = 'ok')) avg_ms
                from public.ai_calls where created_at >= from_ts and created_at < to_ts group by kind) k
    ), '{}'::jsonb),
    'by_error', coalesce((
      select jsonb_object_agg(e.error_code, e.n) from (select coalesce(error_code, 'desconhecido') error_code, count(*) n from public.ai_calls where status <> 'ok' and created_at >= from_ts and created_at < to_ts group by 1) e
    ), '{}'::jsonb),
    'by_model', coalesce((
      select jsonb_object_agg(m.model, m.n) from (select model, count(*) n from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts group by model) m
    ), '{}'::jsonb),
    'blocks_active', (select count(*) from public.ai_blocks where until > now()),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'calls', d.calls, 'users', d.users, 'errors', d.errors) order by d.day)
      from (
        select g.day::date as day,
          (select count(*) from public.ai_calls c where c.status = 'ok' and c.created_at >= g.day and c.created_at < g.day + interval '1 day') calls,
          (select count(distinct c.user_id) from public.ai_calls c where c.status = 'ok' and c.created_at >= g.day and c.created_at < g.day + interval '1 day') users,
          (select count(*) from public.ai_calls c where c.status <> 'ok' and c.created_at >= g.day and c.created_at < g.day + interval '1 day') errors
        from generate_series(from_ts, to_ts - interval '1 day', interval '1 day') g(day)
      ) d
    ), '[]'::jsonb),
    'limits', limits
  );
end;
$$;

revoke all on function public.admin_ai_metrics(date, date) from public;
revoke all on function public.admin_ai_metrics(date, date) from anon;
grant execute on function public.admin_ai_metrics(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- erros e saúde
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_errors(
  p_status public.error_status default null,
  p_severity public.error_severity default null,
  p_module text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'total', (select count(*) from public.app_errors e
               where (p_status is null or e.status = p_status) and (p_severity is null or e.severity = p_severity)
                 and (p_module is null or e.module = p_module)),
    'items', coalesce((
      select jsonb_agg(to_jsonb(e) - 'fingerprint' order by e.last_seen_at desc)
      from (select * from public.app_errors e
             where (p_status is null or e.status = p_status) and (p_severity is null or e.severity = p_severity)
               and (p_module is null or e.module = p_module)
             order by e.last_seen_at desc limit size offset (page - 1) * size) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_errors(public.error_status, public.error_severity, text, integer, integer) from public;
revoke all on function public.admin_list_errors(public.error_status, public.error_severity, text, integer, integer) from anon;
grant execute on function public.admin_list_errors(public.error_status, public.error_severity, text, integer, integer) to authenticated;

create or replace function public.admin_error_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'occurrences', (select count(*) from public.app_error_occurrences o where o.created_at >= from_ts and o.created_at < to_ts),
    'affected_users', (select count(distinct o.user_hash) from public.app_error_occurrences o where o.user_hash is not null and o.created_at >= from_ts and o.created_at < to_ts),
    'by_module', coalesce((
      select jsonb_object_agg(m.module, m.n)
        from (select e.module, count(*) n from public.app_error_occurrences o join public.app_errors e on e.id = o.error_id
               where o.created_at >= from_ts and o.created_at < to_ts group by e.module) m
    ), '{}'::jsonb),
    'by_severity', coalesce((
      select jsonb_object_agg(s.severity, s.n)
        from (select e.severity, count(*) n from public.app_error_occurrences o join public.app_errors e on e.id = o.error_id
               where o.created_at >= from_ts and o.created_at < to_ts group by e.severity) s
    ), '{}'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from public.app_errors group by status) s), '{}'::jsonb),
    'ai_failures', (select count(*) from public.ai_calls where status = 'erro' and created_at >= from_ts and created_at < to_ts),
    'ai_avg_ms', (select round(avg(duration_ms)) from public.ai_calls where status = 'ok' and created_at >= from_ts and created_at < to_ts),
    'payment_failures', (select count(*) from public.subscription_events where type = 'pagamento_falhou' and occurred_at >= from_ts and occurred_at < to_ts),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'occurrences', d.n, 'critical', d.critical) order by d.day)
      from (
        select g.day::date as day,
          (select count(*) from public.app_error_occurrences o where o.created_at >= g.day and o.created_at < g.day + interval '1 day') n,
          (select count(*) from public.app_error_occurrences o join public.app_errors e on e.id = o.error_id
            where e.severity = 'critica' and o.created_at >= g.day and o.created_at < g.day + interval '1 day') critical
        from generate_series(from_ts, to_ts - interval '1 day', interval '1 day') g(day)
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_error_metrics(date, date) from public;
revoke all on function public.admin_error_metrics(date, date) from anon;
grant execute on function public.admin_error_metrics(date, date) to authenticated;

create or replace function public.admin_set_error_status(p_error uuid, p_status public.error_status, p_severity public.error_severity default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous public.app_errors%rowtype;
begin
  perform public.assert_admin_role('owner', 'admin');
  select * into previous from public.app_errors where id = p_error;
  if previous.id is null then
    raise exception 'erro não encontrado' using errcode = 'P0002';
  end if;

  update public.app_errors
     set status = p_status,
         severity = coalesce(p_severity, severity),
         resolved_at = case when p_status = 'resolvido' then now() else null end,
         resolved_by = case when p_status = 'resolvido' then auth.uid() else null end
   where id = p_error;

  perform public.record_admin_audit('error.update', 'app_error', p_error::text, null, 'ok', null,
    jsonb_build_object('status', previous.status, 'severity', previous.severity),
    jsonb_build_object('status', p_status, 'severity', coalesce(p_severity, previous.severity)));
end;
$$;

revoke all on function public.admin_set_error_status(uuid, public.error_status, public.error_severity) from public;
revoke all on function public.admin_set_error_status(uuid, public.error_status, public.error_severity) from anon;
grant execute on function public.admin_set_error_status(uuid, public.error_status, public.error_severity) to authenticated;

-- ---------------------------------------------------------------------------
-- retenção e comportamento
-- ---------------------------------------------------------------------------

/* Retido no dia N: ativo em [N, N+3) dias depois do cadastro. */
create or replace function public.retained_at(p_user uuid, p_created timestamptz, p_day integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.product_events e
     where e.user_id = p_user
       and e.created_at >= p_created + make_interval(days => p_day)
       and e.created_at < p_created + make_interval(days => p_day + 3)
  ) or exists (
    select 1 from auth.users u
     where u.id = p_user
       and u.last_sign_in_at >= p_created + make_interval(days => p_day)
       and u.last_sign_in_at < p_created + make_interval(days => p_day + 3)
  );
$$;

revoke all on function public.retained_at(uuid, timestamptz, integer) from public;
revoke all on function public.retained_at(uuid, timestamptz, integer) from anon;
revoke all on function public.retained_at(uuid, timestamptz, integer) from authenticated;

create or replace function public.admin_retention(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'cohorts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week', c.week, 'size', c.size,
        'd1', c.d1, 'd7', c.d7, 'd14', c.d14, 'd30', c.d30,
        'activated', c.activated
      ) order by c.week)
      from (
        select date_trunc('week', u.created_at)::date week,
               count(*) size,
               round(100.0 * count(*) filter (where public.retained_at(u.id, u.created_at, 1)) / count(*), 1) d1,
               round(100.0 * count(*) filter (where u.created_at < now() - interval '7 days' and public.retained_at(u.id, u.created_at, 7))
                     / nullif(count(*) filter (where u.created_at < now() - interval '7 days'), 0), 1) d7,
               round(100.0 * count(*) filter (where u.created_at < now() - interval '14 days' and public.retained_at(u.id, u.created_at, 14))
                     / nullif(count(*) filter (where u.created_at < now() - interval '14 days'), 0), 1) d14,
               round(100.0 * count(*) filter (where u.created_at < now() - interval '30 days' and public.retained_at(u.id, u.created_at, 30))
                     / nullif(count(*) filter (where u.created_at < now() - interval '30 days'), 0), 1) d30,
               round(100.0 * count(*) filter (where exists (select 1 from public.objectives o where o.user_id = u.id)
                                                  and exists (select 1 from public.tasks t where t.user_id = u.id)) / count(*), 1) activated
          from auth.users u
         where u.created_at >= from_ts and u.created_at < to_ts and u.deleted_at is null
         group by 1
      ) c
    ), '[]'::jsonb),
    'by_plan', coalesce((
      select jsonb_object_agg(p.plan, jsonb_build_object('users', p.n, 'active_30d', p.active))
        from (select pr.plan, count(*) n,
                     count(*) filter (where pr.id in (select * from public.active_user_ids(now() - interval '30 days', now()))) active
                from public.profiles pr group by pr.plan) p
    ), '{}'::jsonb),
    'active', jsonb_build_object(
      'today', (select count(*) from public.active_user_ids(date_trunc('day', now()), now())),
      'd7', (select count(*) from public.active_user_ids(now() - interval '7 days', now())),
      'd30', (select count(*) from public.active_user_ids(now() - interval '30 days', now()))
    ),
    'frequency', coalesce((
      select jsonb_object_agg(f.bucket, f.n)
        from (
          select case when days = 1 then '1' when days <= 3 then '2-3' when days <= 7 then '4-7' when days <= 15 then '8-15' else '16+' end bucket,
                 count(*) n
            from (select user_id, count(distinct day) days from public.product_events
                   where user_id is not null and created_at >= from_ts and created_at < to_ts group by user_id) d
           group by 1
        ) f
    ), '{}'::jsonb),
    'time_to', jsonb_build_object(
      'onboarding_hours', (
        select round(percentile_cont(0.5) within group (order by extract(epoch from (e.first_at - u.created_at)) / 3600)::numeric, 1)
          from auth.users u
          join (select user_id, min(created_at) first_at from public.product_events where name = 'onboarding_completed' group by user_id) e on e.user_id = u.id
         where u.created_at >= from_ts and u.created_at < to_ts
      ),
      'first_objective_hours', (
        select round(percentile_cont(0.5) within group (order by extract(epoch from (o.first_at - u.created_at)) / 3600)::numeric, 1)
          from auth.users u
          join (select user_id, min(created_at) first_at from public.objectives group by user_id) o on o.user_id = u.id
         where u.created_at >= from_ts and u.created_at < to_ts
      ),
      'first_action_hours', (
        select round(percentile_cont(0.5) within group (order by extract(epoch from (t.first_at - u.created_at)) / 3600)::numeric, 1)
          from auth.users u
          join (select user_id, min(completed_at) first_at from public.tasks where completed_at is not null group by user_id) t on t.user_id = u.id
         where u.created_at >= from_ts and u.created_at < to_ts
      )
    ),
    'comebacks', (select count(distinct user_id) from public.journey_events where type = 'comeback' and created_at >= from_ts and created_at < to_ts),
    'recovery_started', (select count(*) from public.product_events where name = 'recovery_started' and created_at >= from_ts and created_at < to_ts),
    'recovery_users', (select count(distinct user_id) from public.product_events where name = 'recovery_started' and created_at >= from_ts and created_at < to_ts),
    'conversions', (select count(distinct user_id) from public.subscription_events where type in ('criada', 'trial_convertido') and occurred_at >= from_ts and occurred_at < to_ts),
    'cancellations', (select count(*) from public.cancellation_requests where created_at >= from_ts and created_at < to_ts),
    'churned_users', (
      select count(*) from public.active_user_ids(from_ts - (to_ts - from_ts), from_ts) prev
       where prev.active_user_ids not in (select * from public.active_user_ids(from_ts, to_ts))
    )
  );
end;
$$;

revoke all on function public.admin_retention(date, date) from public;
revoke all on function public.admin_retention(date, date) from anon;
grant execute on function public.admin_retention(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- recursos mais usados
-- ---------------------------------------------------------------------------

create or replace function public.admin_feature_usage(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
begin
  perform public.assert_admin_role('owner', 'admin', 'support', 'analyst');

  return jsonb_build_object(
    'features', coalesce((
      select jsonb_agg(jsonb_build_object(
        'feature', f.feature,
        'users', f.users,
        'total', f.total,
        'per_user', case when f.users = 0 then null else round(f.total::numeric / f.users, 1) end,
        'free_users', f.free_users,
        'pro_users', f.pro_users,
        'retention', f.retention
      ) order by f.users desc)
      from (
        select e.feature,
               count(distinct e.user_id) users,
               count(*) total,
               count(distinct e.user_id) filter (where e.plan = 'free') free_users,
               count(distinct e.user_id) filter (where e.plan = 'pro') pro_users,
               -- Quem usou o recurso na primeira semana do período e seguiu ativo na última.
               round(100.0 * count(distinct e.user_id) filter (
                   where e.created_at < from_ts + interval '7 days'
                     and e.user_id in (select * from public.active_user_ids(to_ts - interval '7 days', to_ts)))
                 / nullif(count(distinct e.user_id) filter (where e.created_at < from_ts + interval '7 days'), 0), 1) retention
          from public.product_events e
         where e.feature is not null and e.created_at >= from_ts and e.created_at < to_ts
         group by e.feature
      ) f
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', s.day, 'feature', s.feature, 'users', s.users) order by s.day, s.feature)
      from (select e.day, e.feature, count(distinct e.user_id) users from public.product_events e
             where e.feature is not null and e.created_at >= from_ts and e.created_at < to_ts group by e.day, e.feature) s
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_object_agg(r.kind, r.n)
        from (select coalesce(metadata ->> 'kind', 'texto') kind, count(*) n from public.product_events
               where name = 'record_created' and created_at >= from_ts and created_at < to_ts group by 1) r
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_feature_usage(date, date) from public;
revoke all on function public.admin_feature_usage(date, date) from anon;
grant execute on function public.admin_feature_usage(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- auditoria
-- ---------------------------------------------------------------------------

create or replace function public.admin_audit_list(
  p_action text default null,
  p_actor uuid default null,
  p_target uuid default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  size integer := least(greatest(coalesce(p_page_size, 50), 1), 200);
  page integer := greatest(coalesce(p_page, 1), 1);
begin
  perform public.assert_admin_role('owner', 'admin');

  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs a
               where (p_action is null or a.action like p_action || '%')
                 and (p_actor is null or a.actor_id = p_actor)
                 and (p_target is null or a.target_user_id = p_target)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'resource_type', a.resource_type, 'resource_id', a.resource_id,
        'actor_id', a.actor_id, 'actor_name', ap.name, 'actor_role', a.actor_role,
        'target_user_id', a.target_user_id, 'target_name', tp.name,
        'result', a.result, 'reason', a.reason, 'before', a.before, 'after', a.after,
        'context', a.context, 'created_at', a.created_at
      ) order by a.created_at desc)
      from (select * from public.audit_logs a
             where (p_action is null or a.action like p_action || '%')
               and (p_actor is null or a.actor_id = p_actor)
               and (p_target is null or a.target_user_id = p_target)
             order by a.created_at desc limit size offset (page - 1) * size) a
      left join public.profiles ap on ap.id = a.actor_id
      left join public.profiles tp on tp.id = a.target_user_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_audit_list(text, uuid, uuid, integer, integer) from public;
revoke all on function public.admin_audit_list(text, uuid, uuid, integer, integer) from anon;
grant execute on function public.admin_audit_list(text, uuid, uuid, integer, integer) to authenticated;
