-- Momentumm — quem tem cortesia não recebe o aviso de fim do teste.
--
-- A 0040 já tirava da fila quem tem assinatura paga, com a justificativa certa:
-- "seu teste acaba amanhã, assine" depois de a pessoa ter assinado é o tipo de
-- e-mail que faz ela desconfiar da cobrança.
--
-- Faltava o mesmo cuidado com a CORTESIA. Toda conta nova nasce com sete dias
-- de teste (0034), inclusive a de quem opera o produto, e owner e admin também
-- ganham cortesia infinita (0051). As duas coisas convivem na mesma conta, e
-- então o job das 12h manda pra dona do produto um e-mail avisando que o PRO
-- dela acaba amanhã. Não acaba.
--
-- A regra é a mesma que a tela passou a usar (`planAccessOf`, em
-- `domain/billing/trial.ts`): o aviso é do teste, então ele só vale pra quem o
-- teste realmente sustenta. A comparação é entre as DATAS e não entre papéis:
-- cortesia que termina ANTES do teste não sustenta nada, e ali o aviso continua
-- fazendo sentido.

create or replace function public.trial_notices_due(p_hours integer default 36)
returns table (
  user_id    uuid,
  email      text,
  first_name text,
  ends_at    timestamptz,
  hours_left integer
)
language sql
security definer
set search_path = public
stable
as $fn$
  select
    t.user_id,
    u.email,
    nullif(split_part(coalesce(p.name, ''), ' ', 1), ''),
    t.ends_at,
    greatest(0, ceil(extract(epoch from (t.ends_at - now())) / 3600))::integer
  from public.plan_trials t
  join auth.users u on u.id = t.user_id
  left join public.profiles p on p.id = t.user_id
  where t.status = 'ativo'
    and t.notice_sent_at is null
    and t.ends_at > now()
    and t.ends_at <= now() + make_interval(hours => greatest(1, coalesce(p_hours, 36)))
    and u.deleted_at is null
    and u.email is not null
    and not exists (
      select 1
        from public.subscriptions s
       where s.user_id = t.user_id
         and public.plan_for_subscription_state(s.status, s.current_period_end) = 'pro'
    )
    -- A cortesia que vai além do fim do teste: pra essa conta, nada acaba.
    and not (p.plan_courtesy_until is not null and p.plan_courtesy_until >= t.ends_at);
$fn$;

revoke all on function public.trial_notices_due(integer) from public, anon, authenticated;
grant execute on function public.trial_notices_due(integer) to service_role;
