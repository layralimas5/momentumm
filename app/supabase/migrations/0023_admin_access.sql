-- Momentumm — controle de acesso do painel administrativo.
--
-- O que esta migration decide:
--
--   1. Um papel por conta. `user_roles` aceitava (user, role) repetido; o
--      painel precisa de UMA resposta pra "quem é essa pessoa aqui dentro".
--   2. A sessão administrativa tem prazo. `aal2` diz que o segundo fator
--      foi verificado ALGUM DIA nessa sessão; o painel exige que tenha sido
--      na última hora. O carimbo vem do `amr` do JWT (método + timestamp),
--      que o GoTrue assina e o cliente não escreve.
--   3. Ação crítica exige verificação recente: o mesmo carimbo, com janela
--      de cinco minutos. Reautenticar é verificar o TOTP de novo, o que
--      renova o carimbo no token.
--   4. A auditoria ganha alvo, motivo, contexto e antes/depois. Continua sem
--      política de escrita: quem grava é função definer, e o autor é sempre
--      `auth.uid()`.
--
-- Tudo re-executável.

-- ---------------------------------------------------------------------------
-- um papel por conta
-- ---------------------------------------------------------------------------

create unique index if not exists user_roles_one_per_user on public.user_roles (user_id);

alter table public.user_roles
  add column if not exists reason text check (reason is null or char_length(reason) <= 280);

-- ---------------------------------------------------------------------------
-- as perguntas que o painel faz sobre a sessão
-- ---------------------------------------------------------------------------

/* O papel da sessão atual, ou nulo. Não exige MFA: é a função que a tela
   usa pra saber se deve PEDIR o segundo fator. */
create or replace function public.admin_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select r.role from public.user_roles r where r.user_id = auth.uid() limit 1;
$$;

revoke all on function public.admin_role() from public;
revoke all on function public.admin_role() from anon;
grant execute on function public.admin_role() to authenticated;

/*
  Quando o segundo fator foi verificado pela última vez nesta sessão.

  Lê `amr` do JWT: uma lista de {method, timestamp} que o GoTrue assina.
  Sem entrada `totp`, a resposta é nula — e nulo nunca passa em nenhuma das
  comparações abaixo. Falhar pro lado de menos privilégio.
*/
create or replace function public.admin_mfa_verified_at()
returns timestamptz
language sql
stable
as $$
  select max(to_timestamp((entry ->> 'timestamp')::double precision))
    from jsonb_array_elements(
      case
        when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr'
        else '[]'::jsonb
      end
    ) as entry
   where entry ->> 'method' = 'totp'
     and (entry ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$';
$$;

revoke all on function public.admin_mfa_verified_at() from public;
revoke all on function public.admin_mfa_verified_at() from anon;
grant execute on function public.admin_mfa_verified_at() to authenticated;

/* Os dois prazos, num lugar só. */
create or replace function public.admin_session_max_age()
returns interval language sql immutable as $$ select interval '60 minutes' $$;

create or replace function public.admin_step_up_max_age()
returns interval language sql immutable as $$ select interval '5 minutes' $$;

/* A sessão pode agir como administrativa AGORA: aal2 e fator verificado há menos de uma hora. */
create or replace function public.admin_session_valid()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and coalesce(public.admin_mfa_verified_at() > now() - public.admin_session_max_age(), false);
$$;

revoke all on function public.admin_session_valid() from public;
revoke all on function public.admin_session_valid() from anon;
grant execute on function public.admin_session_valid() to authenticated;

/* Verificação recente o bastante pra uma ação crítica. */
create or replace function public.admin_step_up_valid()
returns boolean
language sql
stable
as $$
  select public.admin_session_valid()
     and coalesce(public.admin_mfa_verified_at() > now() - public.admin_step_up_max_age(), false);
$$;

revoke all on function public.admin_step_up_valid() from public;
revoke all on function public.admin_step_up_valid() from anon;
grant execute on function public.admin_step_up_valid() to authenticated;

/* Sessão válida E papel dentro da lista. */
create or replace function public.has_admin_role(variadic allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_session_valid()
     and exists (
       select 1 from public.user_roles r
        where r.user_id = auth.uid()
          and r.role = any (allowed)
     );
$$;

revoke all on function public.has_admin_role(public.app_role[]) from public;
revoke all on function public.has_admin_role(public.app_role[]) from anon;
grant execute on function public.has_admin_role(public.app_role[]) to authenticated;

/*
  A versão que explode, pras funções privilegiadas.

  Quatro mensagens distintas, em ordem de custo pra quem chama: sem papel,
  sem segundo fator, sessão administrativa vencida, papel insuficiente. As
  três primeiras são acionáveis; a última não diz mais nada de propósito.
*/
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

  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'esta operação exige verificação em duas etapas'
      using errcode = '42501';
  end if;

  if not coalesce(public.admin_mfa_verified_at() > now() - public.admin_session_max_age(), false) then
    raise exception 'sessão administrativa expirada: confirme o segundo fator de novo'
      using errcode = '42501';
  end if;

  if not (current_role_value = any (allowed)) then
    raise exception 'sem permissão para esta operação' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin_role(public.app_role[]) from public;
revoke all on function public.assert_admin_role(public.app_role[]) from anon;
grant execute on function public.assert_admin_role(public.app_role[]) to authenticated;

/* Ação crítica: além do papel, o fator verificado nos últimos cinco minutos. */
create or replace function public.assert_admin_step_up(variadic allowed public.app_role[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role(variadic allowed);

  if not coalesce(public.admin_mfa_verified_at() > now() - public.admin_step_up_max_age(), false) then
    raise exception 'ação crítica: confirme o segundo fator novamente'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin_step_up(public.app_role[]) from public;
revoke all on function public.assert_admin_step_up(public.app_role[]) from anon;
grant execute on function public.assert_admin_step_up(public.app_role[]) to authenticated;

/*
  `is_admin` e `assert_admin` (0013) continuam existindo — o trigger do
  plano e a política de auditoria leem daí — e passam a significar "owner ou
  admin, com sessão administrativa válida". Quem era admin continua admin;
  o que muda é que a sessão vence em uma hora.
*/
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin_role('owner', 'admin');
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_role('owner', 'admin');
end;
$$;

-- ---------------------------------------------------------------------------
-- auditoria: alvo, motivo, contexto, antes e depois
-- ---------------------------------------------------------------------------

alter table public.audit_logs
  add column if not exists target_user_id uuid references auth.users (id) on delete set null,
  add column if not exists actor_role text check (actor_role is null or actor_role in ('owner', 'admin', 'support', 'analyst', 'system')),
  add column if not exists reason text check (reason is null or char_length(reason) <= 280),
  add column if not exists context jsonb not null default '{}'::jsonb,
  add column if not exists before jsonb,
  add column if not exists after jsonb;

alter table public.audit_logs drop constraint if exists audit_logs_context_size;
alter table public.audit_logs
  add constraint audit_logs_context_size check (pg_column_size(context) <= 1024);

alter table public.audit_logs drop constraint if exists audit_logs_diff_size;
alter table public.audit_logs
  add constraint audit_logs_diff_size
  check (coalesce(pg_column_size(before), 0) + coalesce(pg_column_size(after), 0) <= 4096);

comment on column public.audit_logs.before is
  'Estado anterior, só de configuração não sensível. Nunca conteúdo pessoal.';
comment on column public.audit_logs.context is
  'IP e agente, quando permitido. Nada além disso.';

create index if not exists audit_logs_target_idx
  on public.audit_logs (target_user_id, created_at desc)
  where target_user_id is not null;

/*
  Leitura: owner e admin. Support e analyst não leem auditoria.
  Escrita, edição e exclusão continuam sem política pra ninguém.
*/
drop policy if exists "auditoria é legível por admin autenticado em dois fatores"
  on public.audit_logs;
drop policy if exists "auditoria é legível por owner e admin" on public.audit_logs;
create policy "auditoria é legível por owner e admin"
  on public.audit_logs for select
  to authenticated
  using (public.has_admin_role('owner', 'admin'));

/*
  A porta de escrita do painel.

  Só quem tem papel grava, o autor é `auth.uid()`, o papel é lido de
  `user_roles` na hora (não do parâmetro), e o tamanho é limitado pelas
  constraints. Não valida "resultado" além do check da tabela: o registro de
  uma tentativa NEGADA é tão importante quanto o de uma bem-sucedida.
*/
create or replace function public.record_admin_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_target_user uuid default null,
  p_result text default 'ok',
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role_value public.app_role;
begin
  select r.role into actor_role_value from public.user_roles r where r.user_id = auth.uid();

  if actor_role_value is null and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'sem permissão para esta operação' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, target_user_id,
    result, reason, before, after, context
  ) values (
    auth.uid(),
    coalesce(actor_role_value::text, 'system'),
    p_action, p_resource_type, p_resource_id, p_target_user,
    p_result, p_reason, p_before, p_after, coalesce(p_context, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_admin_audit(text, text, text, uuid, text, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.record_admin_audit(text, text, text, uuid, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.record_admin_audit(text, text, text, uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.record_admin_audit(text, text, text, uuid, text, text, jsonb, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- mascaramento
-- ---------------------------------------------------------------------------

/*
  `la***@gm***.com`. Dois caracteres do usuário, dois do domínio e a
  extensão: o suficiente pra reconhecer a conta numa conversa de suporte,
  insuficiente pra enviar um e-mail.
*/
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else
      left(split_part(p_email, '@', 1), 2) || '***@'
      || left(split_part(split_part(p_email, '@', 2), '.', 1), 2) || '***'
      || case
           when position('.' in split_part(p_email, '@', 2)) > 0
             then substring(split_part(p_email, '@', 2) from position('.' in split_part(p_email, '@', 2)))
           else ''
         end
  end;
$$;

-- ---------------------------------------------------------------------------
-- gestão de administradores (owner)
-- ---------------------------------------------------------------------------

/*
  Conceder papel: owner, com verificação recente, com motivo.

  Regras que o banco impõe, e não a tela:
    - owner não concede pra si mesmo (não há o que conceder, e a linha da
      auditoria ficaria com autor e alvo iguais)
    - a pessoa precisa existir e ter e-mail confirmado
    - a pessoa precisa ter um fator MFA verificado: papel sem segundo fator
      é uma conta comum com um alvo pintado nas costas
*/
create or replace function public.admin_grant_role(
  p_email text,
  p_role public.app_role,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target auth.users%rowtype;
  previous public.app_role;
begin
  perform public.assert_admin_step_up('owner');

  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo da concessão' using errcode = '22023';
  end if;

  select * into target from auth.users u where lower(u.email) = lower(btrim(p_email));
  if target.id is null then
    raise exception 'nenhuma conta com esse e-mail' using errcode = 'P0002';
  end if;
  if target.id = auth.uid() then
    raise exception 'o próprio papel não se altera por aqui' using errcode = '42501';
  end if;
  if target.email_confirmed_at is null then
    raise exception 'a conta precisa ter o e-mail confirmado' using errcode = '22023';
  end if;
  if not exists (
    select 1 from auth.mfa_factors f where f.user_id = target.id and f.status = 'verified'
  ) then
    raise exception 'a conta precisa ter verificação em duas etapas ativa' using errcode = '22023';
  end if;

  select r.role into previous from public.user_roles r where r.user_id = target.id;

  insert into public.user_roles (user_id, role, granted_by, reason)
  values (target.id, p_role, auth.uid(), btrim(p_reason))
  on conflict (user_id) do update
    set role = excluded.role, granted_by = excluded.granted_by, reason = excluded.reason,
        created_at = now();

  perform public.record_admin_audit(
    'role.grant', 'user_role', target.id::text, target.id, 'ok', btrim(p_reason),
    jsonb_build_object('role', previous), jsonb_build_object('role', p_role)
  );

  return jsonb_build_object('user_id', target.id, 'role', p_role);
end;
$$;

revoke all on function public.admin_grant_role(text, public.app_role, text) from public;
revoke all on function public.admin_grant_role(text, public.app_role, text) from anon;
grant execute on function public.admin_grant_role(text, public.app_role, text) to authenticated;

/* Revogar: owner, verificação recente, e nunca o último owner. */
create or replace function public.admin_revoke_role(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous public.app_role;
begin
  perform public.assert_admin_step_up('owner');

  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'informe o motivo da revogação' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'o próprio papel não se altera por aqui' using errcode = '42501';
  end if;

  select r.role into previous from public.user_roles r where r.user_id = p_user;
  if previous is null then
    raise exception 'essa conta não tem papel administrativo' using errcode = 'P0002';
  end if;

  if previous = 'owner'
     and (select count(*) from public.user_roles where role = 'owner') <= 1 then
    raise exception 'não é possível remover o último owner' using errcode = '22023';
  end if;

  delete from public.user_roles where user_id = p_user;

  perform public.record_admin_audit(
    'role.revoke', 'user_role', p_user::text, p_user, 'ok', btrim(p_reason),
    jsonb_build_object('role', previous), jsonb_build_object('role', null)
  );
end;
$$;

revoke all on function public.admin_revoke_role(uuid, text) from public;
revoke all on function public.admin_revoke_role(uuid, text) from anon;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;

/* Lista de administradores: owner e admin leem; só owner altera. */
create or replace function public.admin_list_admins()
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
      'user_id', r.user_id,
      'role', r.role,
      'name', p.name,
      'email_masked', public.mask_email(u.email),
      'granted_by', r.granted_by,
      'granted_at', r.created_at,
      'reason', r.reason,
      'mfa_enabled', exists (
        select 1 from auth.mfa_factors f where f.user_id = r.user_id and f.status = 'verified'
      )
    ) order by r.role, r.created_at)
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    left join public.profiles p on p.id = r.user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_admins() from public;
revoke all on function public.admin_list_admins() from anon;
grant execute on function public.admin_list_admins() to authenticated;

-- ---------------------------------------------------------------------------
-- "quem sou eu aqui dentro": o que a tela lê antes de desenhar o painel
-- ---------------------------------------------------------------------------

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
    'mfa_verified_at', public.admin_mfa_verified_at(),
    'session_valid', public.admin_session_valid(),
    'session_expires_at', public.admin_mfa_verified_at() + public.admin_session_max_age(),
    'step_up_valid', public.admin_step_up_valid(),
    'step_up_expires_at', public.admin_mfa_verified_at() + public.admin_step_up_max_age()
  );
$$;

revoke all on function public.admin_me() from public;
revoke all on function public.admin_me() from anon;
grant execute on function public.admin_me() to authenticated;
