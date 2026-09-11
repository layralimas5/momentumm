-- Momentumm — o registro das chamadas da Momentumm AI.
--
-- A IA de verdade passa por uma Edge Function (`momentumm-ai`): chave de LLM
-- no front é chave pública, e o único lugar de onde ela pode sair é o
-- servidor. Esta tabela é o que a função escreve a cada chamada, e ela existe
-- por três motivos:
--
--   1. Teto diário por plano. Sem ele, um loop no cliente (ou uma pessoa com
--      o devtools aberto) vira uma fatura. O teto é lido pela função ANTES de
--      chamar o modelo, via `ai_calls_today`.
--   2. Custo. `input_tokens` e `output_tokens` vêm da resposta do modelo, e é
--      com eles que se sabe quanto cada recurso custa de verdade.
--   3. Auditoria. O que a pessoa pediu (`kind`) e quando, nunca o conteúdo:
--      o contexto da conta e a resposta não são guardados aqui. Guardar seria
--      copiar hábitos, reviews e objetivos pra uma segunda tabela, com outra
--      política, pra ninguém ler.
--
-- Quem grava é SÓ a função, com service role. Não existe política de insert,
-- update nem delete pra API pública — e a ausência é a proteção, pela mesma
-- regra de `audit_logs`: com RLS ligada, o que não tem política é negado. O
-- dono lê as próprias linhas (é o que permite a tela mostrar "3 de 5 leituras
-- hoje"), e mais nada.

create table if not exists public.ai_calls (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('plan', 'progress', 'review')),
  model         text not null,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at    timestamptz not null default now()
);

-- O teto conta por (pessoa, dia): é essa a busca.
create index if not exists ai_calls_user_day_idx
  on public.ai_calls (user_id, created_at desc);

alter table public.ai_calls enable row level security;

drop policy if exists ai_calls_owner_select on public.ai_calls;
create policy ai_calls_owner_select
  on public.ai_calls
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Sem insert/update/delete de propósito. Ver o cabeçalho.

-- Quantas chamadas a conta já fez hoje (UTC). `security definer` porque a
-- função da IA chama isto com o JWT da pessoa antes de decidir se chama o
-- modelo, e a política de leitura já limita ao próprio dono — o `definer` só
-- evita depender de o papel `authenticated` ter grant na tabela inteira.
create or replace function public.ai_calls_today(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ai_calls
  where user_id = p_user
    and user_id = auth.uid()
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
$$;

-- Lição da 0010: toda função `security definer` nasce chamável por `anon`
-- por causa dos DEFAULT PRIVILEGES do Supabase. Revoke explícito.
revoke all on function public.ai_calls_today(uuid) from public;
revoke all on function public.ai_calls_today(uuid) from anon;
grant execute on function public.ai_calls_today(uuid) to authenticated;
grant execute on function public.ai_calls_today(uuid) to service_role;
