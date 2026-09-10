-- Momentumm — papéis, privilégio e auditoria.
--
-- ## A vulnerabilidade que motivou esta migration
--
-- `profiles.plan` é uma coluna de `profiles`, e a política de update era
-- `using (auth.uid() = id) with check (auth.uid() = id)`. Isso significa que
-- qualquer conta autenticada podia mandar
--
--   PATCH /rest/v1/profiles?id=eq.<o próprio id>   {"plan": "pro"}
--
-- direto na API e virar PRO. O front nunca envia esse campo — e é exatamente
-- por isso que o problema passava despercebido: a proteção estava no cliente,
-- que é o lugar onde ela não vale nada.
--
-- A regra que sai daqui vale pra qualquer coluna de privilégio que apareça
-- depois: **entitlement não mora em coluna que o dono edita**. Quem muda plano
-- é o backend (webhook de pagamento, com service_role); quem muda papel é
-- outro admin, e com MFA.
--
-- ## Papel fica FORA de profiles
--
-- `user_roles` é uma tabela à parte, sem nenhuma política de escrita pro
-- cliente. Guardar `role` em `profiles` repetiria o erro do `plan` com um
-- prêmio maior, e uma coluna que o dono da linha nunca pode tocar não pertence
-- à tabela que ele edita.

-- ---------------------------------------------------------------------------
-- papéis
-- ---------------------------------------------------------------------------

/*
  Tudo aqui é re-executável.

  O caminho real de aplicação é colar no SQL Editor, e um script que estoura
  na metade deixa o banco MEIO protegido — com a tabela de papéis criada e o
  trigger que fecha o plano ainda não. Metade de uma camada de segurança é
  pior que nenhuma, porque parece pronta.
*/
do $$
begin
  create type public.app_role as enum ('admin', 'support');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- Só leitura, e só do próprio papel: a tela precisa saber se deve mostrar a
-- área administrativa. Nenhuma política de insert, update ou delete —
-- conceder papel é operação de service_role, fora do alcance da API pública.
drop policy if exists "usuário lê o próprio papel" on public.user_roles;
create policy "usuário lê o próprio papel"
  on public.user_roles for select
  using (auth.uid() = user_id);

create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------------
-- as duas perguntas que o resto do banco faz
-- ---------------------------------------------------------------------------

/*
  `is_admin` responde "essa sessão pode agir como admin AGORA".

  Duas condições, e as duas são obrigatórias:

    1. existe linha em user_roles com papel admin
    2. a sessão está em aal2 — ou seja, passou pelo segundo fator

  O `aal` vem do próprio JWT emitido pelo GoTrue e não é escrevível pelo
  cliente: quem tem MFA registrado e não completou o desafio recebe aal1, e
  cai fora daqui. É assim que "MFA obrigatório pra conta administrativa" deixa
  de ser uma tela que dá pra pular e vira condição de leitura no banco.
*/
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles r
     where r.user_id = auth.uid()
       and r.role = 'admin'
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

/*
  A mesma pergunta, mas explodindo em vez de devolver falso.

  Serve às funções privilegiadas: uma checagem que devolve `false` silencioso
  vira `update ... where false`, que responde 200 com zero linhas — e o app
  acha que deu certo. Falhar alto é o comportamento correto num caminho
  sensível.

  As duas mensagens são distintas de propósito: "precisa de segundo fator" é
  acionável, "sem permissão" não deveria dizer mais nada.
*/
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid() and r.role = 'admin'
  ) then
    raise exception 'sem permissão para esta operação' using errcode = '42501';
  end if;

  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'esta operação exige verificação em duas etapas'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin() from public;
revoke all on function public.assert_admin() from anon;
grant execute on function public.assert_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- auditoria
-- ---------------------------------------------------------------------------

/*
  O que entra: quem, o quê, sobre qual recurso, quando e com que resultado.

  O que NÃO entra: conteúdo pessoal. `metadata` existe pra contexto de
  operação (motivo, plano antigo e novo, contagem), e a coluna carrega um
  comentário dizendo isso porque em seis meses alguém vai querer jogar o texto
  da nota do usuário aqui dentro pra "facilitar o suporte".
*/
create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null check (char_length(action) between 3 and 60),
  resource_type text not null check (char_length(resource_type) between 2 and 40),
  resource_id   text check (resource_id is null or char_length(resource_id) <= 100),
  result        text not null default 'ok' check (result in ('ok', 'negado', 'erro')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  -- Teto duro: log é registro de operação, não depósito de payload.
  constraint audit_logs_metadata_size check (pg_column_size(metadata) <= 2048)
);

comment on column public.audit_logs.metadata is
  'Contexto da operação. Proibido conteúdo pessoal: nota, bio, mensagem, prompt, foto.';

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

/*
  Uma política só, de leitura, e só pra admin com MFA.

  Não existe política de insert, update nem delete — e a ausência é a
  proteção: com RLS ligada, o que não tem política é negado. O frontend não
  consegue escrever nem apagar linha de auditoria nem sendo admin; quem grava
  é `record_audit`, que roda como definer.
*/
drop policy if exists "auditoria é legível por admin autenticado em dois fatores"
  on public.audit_logs;
create policy "auditoria é legível por admin autenticado em dois fatores"
  on public.audit_logs for select
  using (public.is_admin());

/*
  A única porta de escrita.

  `security definer` pra atravessar a ausência de política de insert, mas com
  o autor carimbado pelo servidor (`auth.uid()`), nunca recebido por
  parâmetro: um log em que o autor é informado por quem chama é um log que se
  falsifica.
*/
create or replace function public.record_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_result text default 'ok',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, result, metadata)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_result, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.record_audit(text, text, text, text, jsonb) from public;
revoke all on function public.record_audit(text, text, text, text, jsonb) from anon;
grant execute on function public.record_audit(text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- fechando a coluna de privilégio em profiles
-- ---------------------------------------------------------------------------

/*
  A trava é um trigger, não uma política.

  RLS enxerga a linha, não a coluna: `with check (auth.uid() = id)` continua
  verdadeiro depois de trocar o plano, porque o dono continua o mesmo. Postgres
  tem grant por coluna, mas o PostgREST usa um papel único (`authenticated`)
  pra toda a base, então revogar a coluna tiraria o plano de todo mundo,
  inclusive do webhook. O trigger é o único ponto que vê valor antigo e novo.

  Quem pode mudar: `service_role` (o webhook de pagamento) e admin com MFA.
*/
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan then
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
      raise exception 'o plano da conta não é editável por aqui' using errcode = '42501';
    end if;
  end if;

  -- O dono da linha também não muda. A política já garante isso; aqui a
  -- garantia sobrevive a alguém reescrever a política amanhã.
  if new.id is distinct from old.id then
    raise exception 'o dono do perfil não pode ser alterado' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- limites de tamanho que faltavam
-- ---------------------------------------------------------------------------

/*
  `avatar_url` guarda um data URI de 256px (~20KB). A coluna era `text` sem
  teto: dava pra empurrar megabytes por conta, direto na API, e inflar toda
  leitura de perfil — inclusive a dos amigos. 64KB é três vezes o avatar real
  e ainda assim um teto.
*/
alter table public.profiles drop constraint if exists profiles_avatar_size;
alter table public.profiles
  add constraint profiles_avatar_size
  check (avatar_url is null or char_length(avatar_url) <= 65536);
