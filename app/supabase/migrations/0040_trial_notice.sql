-- Momentumm — o aviso de que o teste do PRO está acabando.
--
-- O teste de 7 dias (0034) acabava sem avisar: no oitavo dia a conta voltava
-- pro gratuito e a pessoa descobria pela ausência da IA e do histórico. A
-- faixa dentro do app (`TrialBanner`) só alcança quem abriu o app, e é
-- justamente quem não abriu que precisa do aviso.
--
-- Aqui fica só o QUEM e o QUANDO. O envio é da função de borda
-- `trial-ending`, que manda o e-mail pelo mesmo SMTP dos e-mails de conta.
--
-- Um aviso por teste, no sexto dia (24 a 36 horas antes do fim), e nunca
-- pra quem já assinou: `notice_sent_at` é o carimbo que impede a segunda
-- tentativa, e a assinatura ativa tira a pessoa da fila mesmo que o teste
-- ainda conste como ativo.

alter table public.plan_trials
  add column if not exists notice_sent_at timestamptz;

comment on column public.plan_trials.notice_sent_at is
  'Quando o aviso de fim do teste foi enviado. Nulo = ainda não avisado; um por teste.';

create index if not exists plan_trials_notice_idx
  on public.plan_trials (ends_at)
  where status = 'ativo' and notice_sent_at is null;

-- ---------------------------------------------------------------------------
-- quem avisar agora
-- ---------------------------------------------------------------------------

/*
  Testes que terminam nas próximas `p_hours` horas e ainda não foram
  avisados. Com o padrão de 36 horas e o job rodando uma vez por dia, o
  aviso cai no sexto dia de um teste de sete.

  Quem já tem assinatura paga em pé não entra: receber "seu teste acaba
  amanhã, assine" depois de ter assinado é o tipo de e-mail que faz a pessoa
  desconfiar da cobrança.
*/
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
as $$
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
    );
$$;

revoke all on function public.trial_notices_due(integer) from public, anon, authenticated;
grant execute on function public.trial_notices_due(integer) to service_role;

/*
  Carimba o que foi enviado. Em lote porque o envio também é em lote, e
  `notice_sent_at is null` no filtro garante que uma corrida não reescreva
  um carimbo que já existe.
*/
create or replace function public.mark_trial_notice_sent(p_users uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  update public.plan_trials
     set notice_sent_at = now(), updated_at = now()
   where user_id = any (coalesce(p_users, array[]::uuid[]))
     and notice_sent_at is null;
  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke all on function public.mark_trial_notice_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_trial_notice_sent(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- agendador: uma vez por dia, de manhã
-- ---------------------------------------------------------------------------
--
-- Pré-requisitos, uma vez, no SQL editor do projeto:
--
--   select vault.create_secret('<mesmo valor de TRIAL_NOTICE_TOKEN>', 'trial_notice_token');
--
-- E os segredos da função de borda:
--
--   supabase secrets set TRIAL_NOTICE_TOKEN=<32+ caracteres>
--   supabase secrets set SMTP_HOSTNAME=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true
--   supabase secrets set SMTP_USERNAME=momentumm.suport@gmail.com SMTP_PASSWORD=<senha de app>
--   supabase functions deploy trial-ending --no-verify-jwt
--
-- 12h UTC = 9h em Brasília: e-mail que chega de manhã é lido no mesmo dia.

create or replace function public.call_trial_ending()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
  base_url text := 'https://hsgjlxetdopomeibdbho.supabase.co';
begin
  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'trial_notice_token'
  limit 1;

  if token is null then
    raise notice 'trial_notice_token ausente no Vault: aviso de fim de teste não enviado.';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/trial-ending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notice-token', token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.call_trial_ending() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'momentumm-trial-ending';
  perform cron.schedule('momentumm-trial-ending', '0 12 * * *', 'select public.call_trial_ending()');
exception when others then
  raise notice 'pg_cron/pg_net indisponível (%): agendar a função trial-ending pelo painel do Supabase.', sqlerrm;
end $$;
