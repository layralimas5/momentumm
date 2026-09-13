-- Momentumm — solicitações de suporte e acesso excepcional a conteúdo.
--
-- ## Solicitações
--
-- Toda conversa entre uma pessoa e a equipe passa por aqui: suporte,
-- exportação, exclusão, denúncia, pagamento, acesso, segurança, privacidade.
-- A pessoa abre, lê e responde à própria solicitação; a equipe (support,
-- admin, owner) trabalha por função. Analyst não enxerga nada disto.
--
-- O texto que a pessoa escreve na solicitação é conteúdo pessoal, e é o
-- ÚNICO conteúdo pessoal que a equipe lê — dentro da solicitação, e só.
--
-- ## Acesso excepcional
--
-- Nenhum papel lê objetivo, ação, review, registro, foto ou conversa com a
-- IA de ninguém. Quando resolver um problema exigir olhar um conteúdo, o
-- caminho é este, e ele exige tudo ao mesmo tempo: uma solicitação aberta
-- pela própria pessoa, o pedido de um membro da equipe com motivo e escopo,
-- o consentimento explícito da pessoa, prazo curto, verificação recente de
-- quem lê, e registro de cada leitura. A pessoa revoga quando quiser.
--
-- Um administrador não consegue liberar isso pra si: só a pessoa ativa.

-- ---------------------------------------------------------------------------
-- solicitações
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.support_category as enum
    ('suporte', 'exportacao', 'exclusao', 'denuncia', 'pagamento', 'acesso', 'seguranca', 'privacidade');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_priority as enum ('baixa', 'normal', 'alta', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_status as enum
    ('aberta', 'em_andamento', 'aguardando_usuario', 'resolvida', 'fechada');
exception when duplicate_object then null; end $$;

create sequence if not exists public.support_protocol_seq;

create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  protocol    text not null unique,
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    public.support_category not null,
  priority    public.support_priority not null default 'normal',
  status      public.support_status not null default 'aberta',
  subject     text not null check (char_length(subject) between 3 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  assignee_id uuid references auth.users (id) on delete set null,
  due_at      timestamptz not null,
  resolution  text check (resolution is null or char_length(resolution) <= 1000),
  opened_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz
);

comment on column public.support_requests.description is
  'Conteúdo pessoal. Visível só pro dono e pra equipe, dentro da solicitação.';

create index if not exists support_requests_user_idx on public.support_requests (user_id, opened_at desc);
create index if not exists support_requests_status_idx on public.support_requests (status, priority, due_at);
create index if not exists support_requests_assignee_idx on public.support_requests (assignee_id) where assignee_id is not null;

create table if not exists public.support_request_events (
  id         bigint generated always as identity primary key,
  request_id uuid not null references public.support_requests (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('usuario', 'equipe', 'sistema')),
  type       text not null check (type ~ '^[a-z_]{3,40}$'),
  note       text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists support_request_events_request_idx
  on public.support_request_events (request_id, created_at);

alter table public.support_requests enable row level security;
alter table public.support_request_events enable row level security;

/* A pessoa lê as próprias solicitações e o histórico delas. Escrita só por função. */
drop policy if exists "dono lê as próprias solicitações" on public.support_requests;
create policy "dono lê as próprias solicitações"
  on public.support_requests for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono lê o histórico das próprias solicitações" on public.support_request_events;
create policy "dono lê o histórico das próprias solicitações"
  on public.support_request_events for select
  to authenticated
  using (exists (
    select 1 from public.support_requests r
     where r.id = request_id and r.user_id = auth.uid()
  ));

/* Prazo pelo grau de prioridade. */
create or replace function public.support_due_for(p_priority public.support_priority)
returns interval
language sql
immutable
as $$
  select case p_priority
    when 'urgente' then interval '1 day'
    when 'alta' then interval '2 days'
    when 'normal' then interval '5 days'
    else interval '10 days'
  end;
$$;

create or replace function public.next_support_protocol()
returns text
language sql
volatile
as $$
  select 'MM-' || to_char(now() at time zone 'utc', 'YYYYMM') || '-'
         || lpad(nextval('public.support_protocol_seq')::text, 5, '0');
$$;

/* A pessoa abre a solicitação. Cinco por dia: acima disso é loop, não pedido. */
create or replace function public.open_support_request(
  p_category public.support_category,
  p_subject text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.support_requests%rowtype;
  priority public.support_priority;
begin
  if auth.uid() is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;

  if (select count(*) from public.support_requests r
       where r.user_id = auth.uid() and r.opened_at > now() - interval '1 day') >= 5 then
    raise exception 'limite de solicitações por dia atingido' using errcode = '22023';
  end if;

  priority := case p_category
    when 'seguranca' then 'urgente'::public.support_priority
    when 'acesso' then 'alta'
    when 'exclusao' then 'alta'
    when 'pagamento' then 'alta'
    else 'normal'
  end;

  insert into public.support_requests (protocol, user_id, category, priority, subject, description, due_at)
  values (
    public.next_support_protocol(), auth.uid(), p_category, priority,
    btrim(p_subject), btrim(p_description), now() + public.support_due_for(priority)
  )
  returning * into created;

  insert into public.support_request_events (request_id, actor_id, actor_kind, type)
  values (created.id, auth.uid(), 'usuario', 'aberta');

  return jsonb_build_object('id', created.id, 'protocol', created.protocol);
end;
$$;

revoke all on function public.open_support_request(public.support_category, text, text) from public;
revoke all on function public.open_support_request(public.support_category, text, text) from anon;
grant execute on function public.open_support_request(public.support_category, text, text) to authenticated;

/* A pessoa responde na própria solicitação. */
create or replace function public.add_support_message(p_request uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.support_requests r
     where r.id = p_request and r.user_id = auth.uid() and r.status <> 'fechada'
  ) then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  insert into public.support_request_events (request_id, actor_id, actor_kind, type, note)
  values (p_request, auth.uid(), 'usuario', 'mensagem', btrim(p_note));

  update public.support_requests
     set updated_at = now(),
         status = case when status = 'aguardando_usuario' then 'em_andamento' else status end
   where id = p_request;
end;
$$;

revoke all on function public.add_support_message(uuid, text) from public;
revoke all on function public.add_support_message(uuid, text) from anon;
grant execute on function public.add_support_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- a equipe trabalha a solicitação
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_requests(
  p_status public.support_status default null,
  p_category public.support_category default null,
  p_assignee uuid default null,
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
    'total', (
      select count(*) from public.support_requests r
       where (p_status is null or r.status = p_status)
         and (p_category is null or r.category = p_category)
         and (p_assignee is null or r.assignee_id = p_assignee)
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'protocol', r.protocol,
        'user_id', r.user_id,
        'user_name', p.name,
        'category', r.category,
        'priority', r.priority,
        'status', r.status,
        'subject', r.subject,
        'assignee_id', r.assignee_id,
        'assignee_name', ap.name,
        'opened_at', r.opened_at,
        'due_at', r.due_at,
        'overdue', r.status in ('aberta', 'em_andamento') and r.due_at < now(),
        'updated_at', r.updated_at
      ) order by
        case r.status when 'aberta' then 0 when 'em_andamento' then 1 when 'aguardando_usuario' then 2 else 3 end,
        r.priority desc, r.due_at)
      from (
        select * from public.support_requests r
         where (p_status is null or r.status = p_status)
           and (p_category is null or r.category = p_category)
           and (p_assignee is null or r.assignee_id = p_assignee)
         order by
           case r.status when 'aberta' then 0 when 'em_andamento' then 1 when 'aguardando_usuario' then 2 else 3 end,
           r.priority desc, r.due_at
         limit size offset (page - 1) * size
      ) r
      left join public.profiles p on p.id = r.user_id
      left join public.profiles ap on ap.id = r.assignee_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_requests(public.support_status, public.support_category, uuid, integer, integer) from public;
revoke all on function public.admin_list_requests(public.support_status, public.support_category, uuid, integer, integer) from anon;
grant execute on function public.admin_list_requests(public.support_status, public.support_category, uuid, integer, integer) to authenticated;

/* A solicitação inteira, com histórico e o texto da pessoa. Só aqui o texto aparece. */
create or replace function public.admin_get_request(p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  select jsonb_build_object(
    'id', r.id,
    'protocol', r.protocol,
    'user_id', r.user_id,
    'user_name', p.name,
    'user_email_masked', public.mask_email(u.email),
    'user_plan', p.plan,
    'category', r.category,
    'priority', r.priority,
    'status', r.status,
    'subject', r.subject,
    'description', r.description,
    'assignee_id', r.assignee_id,
    'assignee_name', ap.name,
    'opened_at', r.opened_at,
    'due_at', r.due_at,
    'updated_at', r.updated_at,
    'resolved_at', r.resolved_at,
    'resolution', r.resolution,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'actor_kind', e.actor_kind, 'actor_name', ep.name,
        'type', e.type, 'note', e.note, 'created_at', e.created_at
      ) order by e.created_at)
      from public.support_request_events e
      left join public.profiles ep on ep.id = e.actor_id
      where e.request_id = r.id
    ), '[]'::jsonb),
    'access_grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'status', g.status, 'scopes', g.scopes, 'reason', g.reason,
        'requested_by', g.requested_by, 'requested_at', g.requested_at,
        'consented_at', g.consented_at, 'expires_at', g.expires_at, 'revoked_at', g.revoked_at,
        'active', g.status = 'ativo' and g.expires_at > now()
      ) order by g.requested_at desc)
      from public.support_access_grants g where g.request_id = r.id
    ), '[]'::jsonb)
  ) into result
  from public.support_requests r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.assignee_id
  where r.id = p_request;

  if result is null then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  perform public.record_admin_audit('request.view', 'support_request', p_request::text,
    (result ->> 'user_id')::uuid);

  return result;
end;
$$;

revoke all on function public.admin_get_request(uuid) from public;
revoke all on function public.admin_get_request(uuid) from anon;
grant execute on function public.admin_get_request(uuid) to authenticated;

/*
  Atualizar: status, prioridade, responsável, prazo, resolução e uma nota.
  Support pode tudo isso — é o trabalho dele. O que support NÃO pode está
  em outras funções (plano, configuração, papel), e cada uma checa o papel.
*/
create or replace function public.admin_update_request(
  p_request uuid,
  p_status public.support_status default null,
  p_priority public.support_priority default null,
  p_assignee uuid default null,
  p_due_at timestamptz default null,
  p_resolution text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.support_requests%rowtype;
begin
  perform public.assert_admin_role('owner', 'admin', 'support');

  select * into current_row from public.support_requests where id = p_request;
  if current_row.id is null then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  if p_assignee is not null and not exists (
    select 1 from public.user_roles r where r.user_id = p_assignee
  ) then
    raise exception 'responsável precisa ser da equipe' using errcode = '22023';
  end if;

  update public.support_requests
     set status = coalesce(p_status, status),
         priority = coalesce(p_priority, priority),
         assignee_id = coalesce(p_assignee, assignee_id),
         due_at = coalesce(p_due_at, due_at),
         resolution = coalesce(p_resolution, resolution),
         resolved_at = case
           when coalesce(p_status, status) in ('resolvida', 'fechada') then coalesce(resolved_at, now())
           else null
         end,
         updated_at = now()
   where id = p_request;

  insert into public.support_request_events (request_id, actor_id, actor_kind, type, note)
  values (
    p_request, auth.uid(), 'equipe',
    case
      when p_status is not null and p_status <> current_row.status then 'status_' || p_status::text
      when p_assignee is not null and p_assignee is distinct from current_row.assignee_id then 'atribuida'
      else 'nota'
    end,
    nullif(btrim(coalesce(p_note, '')), '')
  );

  perform public.record_admin_audit(
    'request.update', 'support_request', p_request::text, current_row.user_id, 'ok', null,
    jsonb_build_object('status', current_row.status, 'priority', current_row.priority,
                       'assignee_id', current_row.assignee_id, 'due_at', current_row.due_at),
    jsonb_build_object('status', coalesce(p_status, current_row.status),
                       'priority', coalesce(p_priority, current_row.priority),
                       'assignee_id', coalesce(p_assignee, current_row.assignee_id),
                       'due_at', coalesce(p_due_at, current_row.due_at))
  );
end;
$$;

revoke all on function public.admin_update_request(uuid, public.support_status, public.support_priority, uuid, timestamptz, text, text) from public;
revoke all on function public.admin_update_request(uuid, public.support_status, public.support_priority, uuid, timestamptz, text, text) from anon;
grant execute on function public.admin_update_request(uuid, public.support_status, public.support_priority, uuid, timestamptz, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- acesso excepcional a conteúdo
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.content_scope as enum
    ('objetivos', 'acoes', 'habitos', 'reviews', 'registros', 'midia', 'ia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.access_grant_status as enum ('pendente', 'ativo', 'expirado', 'revogado', 'negado');
exception when duplicate_object then null; end $$;

create table if not exists public.support_access_grants (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.support_requests (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  requested_by   uuid not null references auth.users (id) on delete cascade,
  reason         text not null check (char_length(reason) between 10 and 280),
  scopes         public.content_scope[] not null check (cardinality(scopes) between 1 and 7),
  duration_hours integer not null default 24 check (duration_hours between 1 and 72),
  status         public.access_grant_status not null default 'pendente',
  requested_at   timestamptz not null default now(),
  consented_at   timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid references auth.users (id) on delete set null,
  -- Ninguém pede acesso ao próprio conteúdo por aqui, e ninguém se autoriza.
  constraint support_access_grants_not_self check (requested_by <> user_id)
);

create index if not exists support_access_grants_user_idx on public.support_access_grants (user_id, status);
create index if not exists support_access_grants_request_idx on public.support_access_grants (request_id);

alter table public.support_access_grants enable row level security;

/* A pessoa vê os pedidos sobre o conteúdo dela. Decide por função. */
drop policy if exists "dono lê os pedidos de acesso ao próprio conteúdo" on public.support_access_grants;
create policy "dono lê os pedidos de acesso ao próprio conteúdo"
  on public.support_access_grants for select
  to authenticated
  using (auth.uid() = user_id);

/* Estado efetivo: ativo que passou do prazo é expirado, mesmo antes da limpeza. */
create or replace function public.access_grant_effective_status(g public.support_access_grants)
returns public.access_grant_status
language sql
stable
as $$
  select case
    when g.status = 'ativo' and g.expires_at <= now() then 'expirado'::public.access_grant_status
    else g.status
  end;
$$;

/* Equipe pede. Precisa de solicitação aberta pela própria pessoa. */
create or replace function public.admin_request_content_access(
  p_request uuid,
  p_reason text,
  p_scopes public.content_scope[],
  p_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.support_requests%rowtype;
  created_id uuid;
begin
  perform public.assert_admin_step_up('owner', 'admin', 'support');

  select * into req from public.support_requests where id = p_request;
  if req.id is null then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;
  if req.status in ('resolvida', 'fechada') then
    raise exception 'a solicitação precisa estar aberta' using errcode = '22023';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'não é possível pedir acesso ao próprio conteúdo' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.support_access_grants g
     where g.request_id = p_request
       and public.access_grant_effective_status(g) in ('pendente', 'ativo')
  ) then
    raise exception 'já existe um pedido de acesso em aberto nesta solicitação' using errcode = '22023';
  end if;

  insert into public.support_access_grants (request_id, user_id, requested_by, reason, scopes, duration_hours)
  values (p_request, req.user_id, auth.uid(), btrim(p_reason), p_scopes, coalesce(p_hours, 24))
  returning id into created_id;

  insert into public.support_request_events (request_id, actor_id, actor_kind, type, note)
  values (p_request, auth.uid(), 'equipe', 'acesso_solicitado',
          'Pedido de acesso a: ' || array_to_string(p_scopes::text[], ', '));

  update public.support_requests set status = 'aguardando_usuario', updated_at = now() where id = p_request;

  perform public.record_admin_audit(
    'content_access.request', 'support_access_grant', created_id::text, req.user_id, 'ok', btrim(p_reason),
    null, jsonb_build_object('scopes', p_scopes, 'hours', coalesce(p_hours, 24))
  );

  return jsonb_build_object('id', created_id);
end;
$$;

revoke all on function public.admin_request_content_access(uuid, text, public.content_scope[], integer) from public;
revoke all on function public.admin_request_content_access(uuid, text, public.content_scope[], integer) from anon;
grant execute on function public.admin_request_content_access(uuid, text, public.content_scope[], integer) to authenticated;

/* A pessoa decide: consente (o prazo começa agora), nega ou revoga a qualquer momento. */
create or replace function public.respond_content_access(p_grant uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.support_access_grants%rowtype;
begin
  select * into g from public.support_access_grants where id = p_grant and user_id = auth.uid();
  if g.id is null then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;

  if p_decision = 'consentir' then
    if g.status <> 'pendente' then
      raise exception 'esse pedido já foi respondido' using errcode = '22023';
    end if;
    update public.support_access_grants
       set status = 'ativo', consented_at = now(),
           expires_at = now() + make_interval(hours => duration_hours)
     where id = p_grant;
    insert into public.support_request_events (request_id, actor_id, actor_kind, type)
    values (g.request_id, auth.uid(), 'usuario', 'acesso_consentido');
    update public.support_requests set status = 'em_andamento', updated_at = now() where id = g.request_id;

  elsif p_decision = 'negar' then
    if g.status <> 'pendente' then
      raise exception 'esse pedido já foi respondido' using errcode = '22023';
    end if;
    update public.support_access_grants set status = 'negado', revoked_at = now(), revoked_by = auth.uid()
     where id = p_grant;
    insert into public.support_request_events (request_id, actor_id, actor_kind, type)
    values (g.request_id, auth.uid(), 'usuario', 'acesso_negado');
    update public.support_requests set status = 'em_andamento', updated_at = now() where id = g.request_id;

  elsif p_decision = 'revogar' then
    if public.access_grant_effective_status(g) <> 'ativo' then
      raise exception 'esse acesso não está ativo' using errcode = '22023';
    end if;
    update public.support_access_grants set status = 'revogado', revoked_at = now(), revoked_by = auth.uid()
     where id = p_grant;
    insert into public.support_request_events (request_id, actor_id, actor_kind, type)
    values (g.request_id, auth.uid(), 'usuario', 'acesso_revogado');

  else
    raise exception 'decisão inválida' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.respond_content_access(uuid, text) from public;
revoke all on function public.respond_content_access(uuid, text) from anon;
grant execute on function public.respond_content_access(uuid, text) to authenticated;

/* Os pedidos sobre o conteúdo da pessoa, com quem pediu e por quê. */
create or replace function public.my_content_access_grants()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'protocol', r.protocol,
    'subject', r.subject,
    'reason', g.reason,
    'scopes', g.scopes,
    'duration_hours', g.duration_hours,
    'status', public.access_grant_effective_status(g),
    'requested_at', g.requested_at,
    'expires_at', g.expires_at,
    'requested_by_name', p.name
  ) order by g.requested_at desc), '[]'::jsonb)
  from public.support_access_grants g
  join public.support_requests r on r.id = g.request_id
  left join public.profiles p on p.id = g.requested_by
  where g.user_id = auth.uid();
$$;

revoke all on function public.my_content_access_grants() from public;
revoke all on function public.my_content_access_grants() from anon;
grant execute on function public.my_content_access_grants() to authenticated;

/*
  A leitura em si.

  Só quem pediu lê, só enquanto o acesso está ativo, só o escopo consentido,
  com verificação recente do segundo fator, e cada leitura vira uma linha de
  auditoria com o escopo lido. O que sai é o MÍNIMO por escopo — títulos e
  estados, últimos 30 dias — e não a tabela inteira.
*/
create or replace function public.admin_read_scoped_content(p_grant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.support_access_grants%rowtype;
  result jsonb := '{}'::jsonb;
  since date := (now() at time zone 'utc')::date - 30;
begin
  perform public.assert_admin_step_up('owner', 'admin', 'support');

  select * into g from public.support_access_grants where id = p_grant;
  if g.id is null then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  -- A recusa é uma exceção, e exceção desfaz a transação inteira — inclusive
  -- uma linha de auditoria gravada antes dela. Por isso a tentativa negada
  -- NÃO fica registrada aqui; o que fica é toda leitura que aconteceu.
  if g.requested_by <> auth.uid() then
    raise exception 'só quem pediu o acesso pode ler' using errcode = '42501';
  end if;
  if public.access_grant_effective_status(g) <> 'ativo' then
    raise exception 'esse acesso não está ativo' using errcode = '42501';
  end if;

  if 'objetivos' = any (g.scopes) then
    result := result || jsonb_build_object('objetivos', coalesce((
      select jsonb_agg(jsonb_build_object('title', o.title, 'axis', o.axis_slug, 'deadline', o.deadline,
        'completed', o.completed_at is not null, 'archived', o.archived_at is not null) order by o.created_at desc)
      from public.objectives o where o.user_id = g.user_id), '[]'::jsonb));
  end if;
  if 'acoes' = any (g.scopes) then
    result := result || jsonb_build_object('acoes', coalesce((
      select jsonb_agg(jsonb_build_object('title', t.title, 'day', t.day, 'status', t.status) order by t.day desc)
      from public.tasks t where t.user_id = g.user_id and t.day >= since), '[]'::jsonb));
  end if;
  if 'habitos' = any (g.scopes) then
    result := result || jsonb_build_object('habitos', coalesce((
      select jsonb_agg(jsonb_build_object('name', h.name, 'axis', h.axis_slug, 'archived', h.archived_at is not null))
      from public.habits h where h.user_id = g.user_id), '[]'::jsonb));
  end if;
  if 'reviews' = any (g.scopes) then
    result := result || jsonb_build_object('reviews', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' - 'id' order by w.created_at desc)
      from (select * from public.weekly_reviews w where w.user_id = g.user_id order by w.created_at desc limit 4) w
    ), '[]'::jsonb));
  end if;
  if 'registros' = any (g.scopes) then
    result := result || jsonb_build_object('registros', coalesce((
      select jsonb_agg(jsonb_build_object('type', a.type_slug, 'value', a.value, 'unit', a.unit,
        'day', a.day, 'note', a.note, 'source', a.source) order by a.day desc)
      from public.activities a where a.user_id = g.user_id and a.day >= since), '[]'::jsonb));
  end if;
  if 'midia' = any (g.scopes) then
    result := result || jsonb_build_object('midia', coalesce((
      select jsonb_agg(jsonb_build_object('path', so.name, 'size', (so.metadata ->> 'size')::bigint,
        'mimetype', so.metadata ->> 'mimetype', 'created_at', so.created_at))
      from storage.objects so
      where so.bucket_id = 'user-media' and (storage.foldername(so.name))[1] = g.user_id::text), '[]'::jsonb));
  end if;
  if 'ia' = any (g.scopes) then
    -- Não existe conversa guardada: a IA nunca persistiu prompt nem resposta.
    result := result || jsonb_build_object('ia', coalesce((
      select jsonb_agg(jsonb_build_object('kind', c.kind, 'status', c.status, 'created_at', c.created_at) order by c.created_at desc)
      from public.ai_calls c where c.user_id = g.user_id and c.created_at > now() - interval '30 days'), '[]'::jsonb));
  end if;

  perform public.record_admin_audit('content_access.read', 'support_access_grant', p_grant::text,
    g.user_id, 'ok', g.reason, null, jsonb_build_object('scopes', g.scopes));

  return result;
end;
$$;

revoke all on function public.admin_read_scoped_content(uuid) from public;
revoke all on function public.admin_read_scoped_content(uuid) from anon;
grant execute on function public.admin_read_scoped_content(uuid) to authenticated;

/* Marca como expirado o que passou do prazo. O estado efetivo já não depende disto. */
create or replace function public.expire_content_access()
returns integer
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.support_access_grants
       set status = 'expirado'
     where status = 'ativo' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function public.expire_content_access() from public;
revoke all on function public.expire_content_access() from anon;
revoke all on function public.expire_content_access() from authenticated;
grant execute on function public.expire_content_access() to service_role;
