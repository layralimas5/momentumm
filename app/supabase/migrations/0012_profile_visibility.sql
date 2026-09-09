-- Momentumm — visibilidade do perfil.
--
-- Até aqui `profiles` tinha uma política de leitura `using (true)`: qualquer
-- pessoa autenticada lia o perfil de qualquer outra. Não vazava número nenhum
-- da jornada (esses estão em tabelas com RLS própria), mas expunha nome, @, bio
-- e foto de toda a base — e é sobre isso que a pessoa passa a decidir aqui.
--
-- ## Três degraus, e o padrão é o mais fechado
--
--   privado  (default) — só o dono lê a linha inteira
--   amigos             — mais quem tem amizade ACEITA com ele
--   publico            — qualquer pessoa autenticada
--
-- ## Por que a busca pelo @ exato continua achando todo mundo
--
-- Perfil nasce privado. Se a busca respeitasse a visibilidade sem exceção,
-- ninguém conseguiria mandar pedido de amizade pra ninguém — todo mundo nasce
-- invisível — e o Círculo seria uma tela que nunca sai do zero.
--
-- A saída é a mesma do Instagram com conta fechada: o @ EXATO encontra a
-- pessoa e devolve só o cartão de visita (id, nome, @, foto). É uma função
-- `security definer` com um retorno estreito e sem busca parcial: dá pra
-- confirmar quem você já conhece, não pra varrer a base atrás de gente.
--
-- ## Sobre `avatar_url` no cartão de visita
--
-- A foto entra porque sem ela o resultado da busca vira uma lista de nomes
-- iguais, e a pessoa não consegue distinguir a Marina que ela conhece da outra.
-- É o mesmo dado que o pedido de amizade já mostra hoje.

create type public.profile_visibility as enum ('privado', 'amigos', 'publico');

alter table public.profiles
  add column if not exists profile_visibility public.profile_visibility not null default 'privado';

-- ---------------------------------------------------------------------------
-- quem lê o perfil
-- ---------------------------------------------------------------------------

-- Vínculo entre duas pessoas: amizade aceita OU pedido em aberto, nos dois
-- sentidos. O pedido conta porque a tela de convites precisa dizer QUEM está
-- chamando — um card "alguém quer te adicionar" é impossível de responder.
--
-- `security definer` com `search_path` fixo e revoke explícito ao `anon`, pela
-- lição da 0010: o Supabase concede execute a `anon` e `authenticated` em toda
-- função nova do schema `public`, direto ao papel, e o `revoke ... from public`
-- não alcança isso.
create or replace function public.has_profile_link(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.friendships f
     where (f.requester_id = viewer and f.addressee_id = target)
        or (f.requester_id = target and f.addressee_id = viewer)
  );
$$;

revoke all on function public.has_profile_link(uuid, uuid) from public;
revoke all on function public.has_profile_link(uuid, uuid) from anon;
grant execute on function public.has_profile_link(uuid, uuid) to authenticated;

drop policy if exists "perfis são legíveis por todos" on public.profiles;

create policy "perfil visível conforme a escolha da pessoa"
  on public.profiles for select
  using (
    auth.uid() = id
    or profile_visibility = 'publico'
    or (profile_visibility = 'amigos' and public.are_friends(auth.uid(), id))
    or public.has_profile_link(auth.uid(), id)
  );

-- ---------------------------------------------------------------------------
-- o cartão de visita por @ exato
-- ---------------------------------------------------------------------------

create or replace function public.find_profile_by_handle(target_handle text)
returns table (id uuid, name text, handle text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.handle, p.avatar_url
    from public.profiles p
   -- Igualdade, nunca `like`: com `%` isso viraria a varredura que a política
   -- acima existe pra impedir.
   where lower(p.handle) = lower(btrim(target_handle))
     and p.id <> auth.uid()
   limit 1;
$$;

revoke all on function public.find_profile_by_handle(text) from public;
revoke all on function public.find_profile_by_handle(text) from anon;
grant execute on function public.find_profile_by_handle(text) to authenticated;

-- A busca por parte do nome continua existindo pelo SELECT normal, e agora ela
-- só enxerga quem escolheu `publico` — que é exatamente o que "público"
-- significa. O índice serve a ela.
create index if not exists profiles_public_handle_idx
  on public.profiles (handle)
  where profile_visibility = 'publico';
