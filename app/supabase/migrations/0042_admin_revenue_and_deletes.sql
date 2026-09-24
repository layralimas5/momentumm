-- Momentumm — o dinheiro no painel, e as duas exclusões que faltavam.
--
-- 1. `admin_mrr_cents` contava trial como receita. Trial não paga nada: com
--    o teste de 7 dias no ar, o MRR subia com gente que ainda não decidiu.
--    Agora só 'ativa' entra, e o anual divide em numérico (12990/12 em
--    inteiro trunca centavo a cada assinatura).
-- 2. `admin_revenue` responde "quanto entrou": soma os eventos de cobrança
--    que o webhook do Asaas escreveu, menos reembolso. É caixa do período,
--    não projeção — MRR já é a projeção.
-- 3. `admin_delete_quiz_lead` esquece o contato de quem pediu, sem apagar a
--    sessão: o funil de meses passados não pode mudar porque um contato saiu.
-- 4. `admin_force_deletion` é a exclusão que a dona manda fazer, sem esperar
--    a solicitação da pessoa. O caminho comum continua sendo o da 0028 (a
--    pessoa pede, corre o prazo de 7 dias); este é o atalho do owner, com
--    step-up, motivo e auditoria própria.

-- ---------------------------------------------------------------------------
-- MRR: só quem paga
-- ---------------------------------------------------------------------------

create or replace function public.admin_mrr_cents()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case when s.interval = 'mensal' then s.amount_cents
         else round(s.amount_cents::numeric / 12) end
  ), 0)::bigint
    from public.subscriptions s
   where s.status = 'ativa' and s.plan = 'pro';
$$;

revoke all on function public.admin_mrr_cents() from public;
revoke all on function public.admin_mrr_cents() from anon;
revoke all on function public.admin_mrr_cents() from authenticated;

-- ---------------------------------------------------------------------------
-- faturamento do período
-- ---------------------------------------------------------------------------

/* Os eventos que representam dinheiro entrando. Reembolso sai à parte. */
create or replace function public.revenue_event_types()
returns public.subscription_event_type[]
language sql
immutable
as $$
  select array['criada', 'renovada', 'upgrade', 'trial_convertido']::public.subscription_event_type[];
$$;

create or replace function public.admin_revenue(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := p_from::timestamptz;
  to_ts timestamptz := (p_to + 1)::timestamptz;
  gross bigint;
  refunds bigint;
begin
  perform public.assert_admin_role('owner', 'admin', 'analyst');

  if p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  select coalesce(sum(e.amount_cents), 0)::bigint into gross
    from public.subscription_events e
   where e.type = any (public.revenue_event_types())
     and e.amount_cents is not null
     and e.occurred_at >= from_ts and e.occurred_at < to_ts;

  select coalesce(sum(e.amount_cents), 0)::bigint into refunds
    from public.subscription_events e
   where e.type = 'reembolso'
     and e.amount_cents is not null
     and e.occurred_at >= from_ts and e.occurred_at < to_ts;

  return jsonb_build_object(
    'gross_cents', gross,
    'refunds_cents', refunds,
    'net_cents', gross - refunds,
    'payments', (
      select count(*) from public.subscription_events e
       where e.type = any (public.revenue_event_types())
         and e.amount_cents is not null
         and e.occurred_at >= from_ts and e.occurred_at < to_ts
    ),
    'paying_users', (
      select count(distinct e.user_id) from public.subscription_events e
       where e.type = any (public.revenue_event_types())
         and e.amount_cents is not null
         and e.occurred_at >= from_ts and e.occurred_at < to_ts
    ),
    'ticket_cents', (
      select round(avg(e.amount_cents))::bigint from public.subscription_events e
       where e.type = any (public.revenue_event_types())
         and e.amount_cents is not null
         and e.occurred_at >= from_ts and e.occurred_at < to_ts
    ),
    'by_cycle', coalesce((
      select jsonb_object_agg(c.interval, c.total)
        from (
          select s.interval::text as interval, sum(e.amount_cents)::bigint total
            from public.subscription_events e
            join public.subscriptions s on s.id = e.subscription_id
           where e.type = any (public.revenue_event_types())
             and e.amount_cents is not null
             and e.occurred_at >= from_ts and e.occurred_at < to_ts
           group by s.interval
        ) c
    ), '{}'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.dia, 'cents', d.cents) order by d.dia)
        from (
          select e.occurred_at::date as dia, sum(e.amount_cents)::bigint as cents
            from public.subscription_events e
           where e.type = any (public.revenue_event_types())
             and e.amount_cents is not null
             and e.occurred_at >= from_ts and e.occurred_at < to_ts
           group by 1
        ) d
    ), '[]'::jsonb),
    'mrr_cents', public.admin_mrr_cents(),
    'arr_cents', public.admin_mrr_cents() * 12,
    'trials_active', (
      select count(*) from public.subscriptions s
       where s.status = 'trial' and s.plan = 'pro'
    )
  );
end;
$$;

revoke all on function public.admin_revenue(date, date) from public, anon;
grant execute on function public.admin_revenue(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- esquecer o contato de um lead do quiz
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_quiz_lead(p_session uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo public.quiz_sessions;
begin
  perform public.assert_admin_step_up('owner', 'admin');

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'o motivo é obrigatório' using errcode = '22023';
  end if;

  select * into alvo from public.quiz_sessions where id = p_session;
  if not found or alvo.lead_email is null then
    raise exception 'contato não encontrado' using errcode = 'P0002';
  end if;

  /*
    A sessão fica, o contato vai embora.

    Apagar a linha inteira reescreveria o funil de um mês que já foi
    reportado. O que a pessoa pediu pra sumir é o dado dela, e é só isso
    que some.
  */
  update public.quiz_sessions
     set lead_name = null,
         lead_email = null,
         lead_phone = null,
         lead_age = null,
         lead_consent_at = null,
         updated_at = now()
   where id = p_session;

  perform public.record_admin_audit(
    'quiz_lead.delete', 'quiz_session', p_session::text, alvo.user_id, 'ok', btrim(p_reason),
    jsonb_build_object('tinha_contato', true), null, p_context
  );
end;
$$;

revoke all on function public.admin_delete_quiz_lead(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_delete_quiz_lead(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- exclusão imediata de conta, pela dona
-- ---------------------------------------------------------------------------

create or replace function public.admin_force_deletion(p_user uuid, p_reason text, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  /* Só o owner. Admin continua limitado ao fluxo com solicitação e prazo. */
  perform public.assert_admin_step_up('owner');

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'o motivo é obrigatório' using errcode = '22023';
  end if;

  if p_user = auth.uid() then
    raise exception 'não dá pra excluir a própria conta pelo painel' using errcode = '42501';
  end if;

  if exists (select 1 from public.user_roles r where r.user_id = p_user) then
    raise exception 'remova o papel administrativo antes de excluir a conta' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;

  update auth.users set banned_until = now() + interval '100 years' where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;

  /*
    `scheduled_for = now()` faz `deletion_ready` liberar na hora, e a Edge
    Function conclui com o mesmo caminho da exclusão comum: apaga a mídia do
    Storage e depois a conta, que leva o domínio junto por cascata.
  */
  insert into public.account_status (user_id, status, reason, scheduled_for, changed_by)
  values (p_user, 'exclusao_solicitada', btrim(p_reason), now(), auth.uid())
  on conflict (user_id) do update
    set status = 'exclusao_solicitada', reason = excluded.reason, request_id = null,
        scheduled_for = now(), changed_by = excluded.changed_by, changed_at = now();

  perform public.record_admin_audit('user.deletion_force', 'user', p_user::text, p_user, 'ok', btrim(p_reason),
    null, jsonb_build_object('imediata', true), p_context);

  return jsonb_build_object('ready', true);
end;
$$;

revoke all on function public.admin_force_deletion(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_force_deletion(uuid, text, jsonb) to authenticated;
