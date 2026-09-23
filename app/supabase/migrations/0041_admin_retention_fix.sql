-- Momentumm — conserta a aba Retenção.
--
-- `admin_retention` nunca respondeu: `churned_users` lia
-- `prev.active_user_ids` de uma função com alias `prev`. Quando uma função
-- `setof` de tipo escalar ganha alias, a COLUNA passa a se chamar pelo alias
-- — `prev.active_user_ids` não existe, e o 42703 derrubava a resposta
-- inteira. Na tela isso virava "Não consegui salvar agora", que nem erro de
-- salvar era.
--
-- A correção nomeia a coluna explicitamente (`prev(user_id)`), que é o que
-- torna a intenção óbvia na próxima leitura, e troca o `not in` por
-- `not exists`: com `not in`, um único nulo na subconsulta zera o resultado
-- sem avisar.
--
-- Só `churned_users` muda. O resto da função é o mesmo da 0028.

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
      select count(*)
        from public.active_user_ids(from_ts - (to_ts - from_ts), from_ts) as prev(user_id)
       where not exists (
         select 1 from public.active_user_ids(from_ts, to_ts) as atual(user_id)
          where atual.user_id = prev.user_id
       )
    )
  );
end;
$$;

revoke all on function public.admin_retention(date, date) from public;
revoke all on function public.admin_retention(date, date) from anon;
grant execute on function public.admin_retention(date, date) to authenticated;
