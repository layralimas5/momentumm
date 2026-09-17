-- Momentumm — teste gratuito do PRO: 7 dias, sem cartão, sem cobrança.
--
-- Toda conta nova nasce com 7 dias de PRO. As contas que já existiam ganham
-- 7 dias contados de agora, uma vez só. O teste é uma linha em
-- `plan_trials`, e o plano da conta (`profiles.plan`) continua DERIVADO, só
-- que agora de duas fontes: a assinatura (0026) e o teste. A regra da 0013
-- segue de pé: o dono nunca edita o próprio plano; quem escreve o plano é o
-- banco, por `sync_plan_for_user`.
--
-- O que acontece no fim: `expire_due_trials()` fecha os testes vencidos e o
-- plano volta pro gratuito. Ela roda por `pg_cron` a cada 10 minutos e também
-- é chamada pelo app na abertura (`settle_my_plan`) e pela Momentumm AI antes
-- de responder, então o acesso PRO nunca sobrevive ao prazo mesmo que o
-- agendador atrase. Nada da pessoa é apagado: objetivos, hábitos, ações e
-- histórico continuam no banco; o que passa do limite do gratuito só deixa
-- de ser editável e volta inteiro quando ela assina.
--
-- Quem assina durante o teste: o webhook grava a assinatura, o sync vê a
-- assinatura antes do teste e marca o teste como `convertido`. O PRO pago só
-- nasce com PAYMENT_CONFIRMED do Asaas, como sempre foi.
--
-- Cortesia da equipe (`profiles.plan_courtesy_until`): PRO concedido à mão,
-- sem assinatura. Só service_role escreve. É o que mantém a conta da dona e
-- as contas de apoio no PRO sem depender de teste nem de cobrança.

-- ---------------------------------------------------------------------------
-- o teste
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.trial_status as enum ('ativo', 'encerrado', 'convertido');
exception when duplicate_object then null; end $$;

create table if not exists public.plan_trials (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       public.plan_tier not null default 'pro',
  started_at timestamptz not null default now(),
  ends_at    timestamptz not null,
  status     public.trial_status not null default 'ativo',
  ended_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_trials_window check (ends_at > started_at)
);

comment on table public.plan_trials is
  'Um teste por conta (a chave primária é o user_id). Início, fim e estado. Só o banco escreve.';

create index if not exists plan_trials_due_idx on public.plan_trials (ends_at) where status = 'ativo';

alter table public.plan_trials enable row level security;

drop policy if exists "dono lê o próprio teste" on public.plan_trials;
create policy "dono lê o próprio teste"
  on public.plan_trials for select
  to authenticated
  using (auth.uid() = user_id);

-- Sem política de escrita: inserção e encerramento acontecem nas funções abaixo.

alter table public.profiles
  add column if not exists plan_courtesy_until timestamptz;

comment on column public.profiles.plan_courtesy_until is
  'PRO concedido pela equipe até esta data (ou infinity). Só service_role escreve.';

/*
  A cortesia entra na mesma guarda do plano (0013/0026): a política de update
  do dono cobre a linha inteira, e sem isso qualquer pessoa gravaria
  `plan_courtesy_until = 'infinity'` no próprio perfil.
*/
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged boolean;
begin
  privileged := coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or coalesce(current_setting('momentumm.plan_sync', true), '') = '1'
    or public.is_admin();

  if new.plan is distinct from old.plan and not privileged then
    raise exception 'o plano da conta não é editável por aqui' using errcode = '42501';
  end if;

  if new.plan_courtesy_until is distinct from old.plan_courtesy_until and not privileged then
    raise exception 'a cortesia do plano não é editável por aqui' using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception 'o dono do perfil não pode ser alterado' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- o plano que a conta tem direito AGORA, olhando todas as fontes
-- ---------------------------------------------------------------------------

create or replace function public.plan_for_user(p_user uuid)
returns public.plan_tier
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user
         and public.plan_for_subscription_state(s.status, s.current_period_end) = 'pro'
    ) then 'pro'::public.plan_tier
    when exists (
      select 1 from public.profiles p
       where p.id = p_user and p.plan_courtesy_until is not null and p.plan_courtesy_until > now()
    ) then 'pro'
    when exists (
      select 1 from public.plan_trials t
       where t.user_id = p_user and t.status = 'ativo' and t.ends_at > now()
    ) then 'pro'
    else 'free'
  end;
$$;

revoke all on function public.plan_for_user(uuid) from public;
revoke all on function public.plan_for_user(uuid) from anon;
revoke all on function public.plan_for_user(uuid) from authenticated;
grant execute on function public.plan_for_user(uuid) to service_role;

/*
  Grava `profiles.plan` a partir de `plan_for_user`. Liga o flag de sessão
  que o trigger de guarda (0013/0026) reconhece, e só por isso consegue
  escrever. Também fecha o teste como `convertido` quando uma assinatura
  passa a valer: o teste cumpriu o papel dele.
*/
create or replace function public.sync_plan_for_user(p_user uuid)
returns public.plan_tier
language plpgsql
security definer
set search_path = public
as $$
declare
  next_plan public.plan_tier;
begin
  next_plan := public.plan_for_user(p_user);

  perform set_config('momentumm.plan_sync', '1', true);
  update public.profiles set plan = next_plan where id = p_user and plan is distinct from next_plan;
  perform set_config('momentumm.plan_sync', '', true);

  if exists (
    select 1 from public.subscriptions s
     where s.user_id = p_user
       and public.plan_for_subscription_state(s.status, s.current_period_end) = 'pro'
  ) then
    update public.plan_trials
       set status = 'convertido', ended_at = coalesce(ended_at, now()), updated_at = now()
     where user_id = p_user and status = 'ativo';
  end if;

  return next_plan;
end;
$$;

revoke all on function public.sync_plan_for_user(uuid) from public;
revoke all on function public.sync_plan_for_user(uuid) from anon;
revoke all on function public.sync_plan_for_user(uuid) from authenticated;
grant execute on function public.sync_plan_for_user(uuid) to service_role;

-- A assinatura passa a sincronizar pela função nova (mesmo trigger da 0026).
create or replace function public.sync_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_plan_for_user(new.user_id);
  return new;
end;
$$;

create or replace function public.sync_plan_from_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_plan_for_user(new.user_id);
  return new;
end;
$$;

drop trigger if exists plan_trials_sync_plan on public.plan_trials;
create trigger plan_trials_sync_plan
  after insert or update of status, ends_at on public.plan_trials
  for each row execute function public.sync_plan_from_trial();

-- ---------------------------------------------------------------------------
-- conceder: uma vez por conta, nunca reinicia
-- ---------------------------------------------------------------------------

create or replace function public.trial_days()
returns integer
language sql
immutable
as $$ select 7 $$;

create or replace function public.grant_pro_trial(p_user uuid, p_from timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  insert into public.plan_trials (user_id, started_at, ends_at)
  values (p_user, p_from, p_from + make_interval(days => public.trial_days()))
  on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

revoke all on function public.grant_pro_trial(uuid, timestamptz) from public;
revoke all on function public.grant_pro_trial(uuid, timestamptz) from anon;
revoke all on function public.grant_pro_trial(uuid, timestamptz) from authenticated;
grant execute on function public.grant_pro_trial(uuid, timestamptz) to service_role;

-- Conta nova: perfil e teste nascem juntos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  suffix integer := 0;
begin
  base_handle := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if char_length(base_handle) < 3 then
    base_handle := 'momentum' || base_handle;
  end if;
  base_handle := left(base_handle, 16);
  final_handle := base_handle;

  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  end loop;

  insert into public.profiles (id, handle, name)
  values (
    new.id,
    final_handle,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), initcap(base_handle))
  );

  perform public.grant_pro_trial(new.id, coalesce(new.created_at, now()));

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- encerrar: o prazo acabou, a conta volta pro gratuito
-- ---------------------------------------------------------------------------

create or replace function public.expire_due_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed integer;
begin
  with done as (
    update public.plan_trials
       set status = 'encerrado', ended_at = now(), updated_at = now()
     where status = 'ativo' and ends_at <= now()
    returning user_id
  )
  select count(*) into closed from done;
  -- O trigger de `plan_trials` já sincronizou o plano de cada uma.
  return closed;
end;
$$;

revoke all on function public.expire_due_trials() from public;
revoke all on function public.expire_due_trials() from anon;
revoke all on function public.expire_due_trials() from authenticated;
grant execute on function public.expire_due_trials() to service_role;

/*
  O que o app chama ao abrir a sessão. Fecha o próprio teste se venceu,
  garante que `profiles.plan` reflete a verdade e devolve o estado do teste
  pra tela mostrar "PRO de teste até <data>". Só age sobre a conta da sessão.
*/
create or replace function public.settle_my_plan()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current_plan public.plan_tier;
  t public.plan_trials%rowtype;
begin
  if me is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  update public.plan_trials
     set status = 'encerrado', ended_at = now(), updated_at = now()
   where user_id = me and status = 'ativo' and ends_at <= now();

  current_plan := public.sync_plan_for_user(me);

  select * into t from public.plan_trials where user_id = me;

  return jsonb_build_object(
    'plan', current_plan,
    'trial', case when t.user_id is null then null else jsonb_build_object(
      'started_at', t.started_at,
      'ends_at', t.ends_at,
      'status', t.status
    ) end
  );
end;
$$;

revoke all on function public.settle_my_plan() from public;
revoke all on function public.settle_my_plan() from anon;
grant execute on function public.settle_my_plan() to authenticated;

-- ---------------------------------------------------------------------------
-- agendador: a cada 10 minutos, sem depender de ninguém abrir o app
-- ---------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'momentumm-expire-trials';
  perform cron.schedule('momentumm-expire-trials', '*/10 * * * *', 'select public.expire_due_trials()');
exception when others then
  raise notice 'pg_cron indisponível (%): o app e a Momentumm AI fecham os testes vencidos na abertura.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- quem já estava aqui: 7 dias a partir de agora, uma vez só
-- ---------------------------------------------------------------------------

/*
  Owner e admin ganham cortesia permanente em vez de teste: são as contas
  que operam o produto e não podem cair pro gratuito no oitavo dia. As
  demais contas existentes recebem o teste contado da implantação. Quem já
  tem assinatura valendo nem percebe: a assinatura vem antes do teste.
*/
select set_config('momentumm.plan_sync', '1', false);

update public.profiles p
   set plan_courtesy_until = 'infinity'
 where p.plan_courtesy_until is null
   and exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('owner', 'admin'));

insert into public.plan_trials (user_id, started_at, ends_at)
select p.id, now(), now() + make_interval(days => public.trial_days())
  from public.profiles p
 where not exists (select 1 from public.plan_trials t where t.user_id = p.id)
on conflict (user_id) do nothing;

-- Acerta o plano de todo mundo uma vez (o trigger já cuidou de quem recebeu teste agora).
select public.sync_plan_for_user(p.id) from public.profiles p;

select set_config('momentumm.plan_sync', '', false);

-- ---------------------------------------------------------------------------
-- evento de uso: o fim do teste é sinal de conversão pro painel
-- ---------------------------------------------------------------------------

create or replace function public.product_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    'session_start', 'feature_view', 'onboarding_completed',
    'objective_created', 'task_created', 'task_completed', 'habit_logged',
    'review_completed', 'momentum_viewed', 'ai_call', 'recovery_started',
    'share_exported', 'record_created', 'cancellation_requested', 'support_opened',
    'plan_limit_hit', 'checkout_started', 'subscription_canceled',
    'trial_started', 'trial_ended'
  ];
$$;
