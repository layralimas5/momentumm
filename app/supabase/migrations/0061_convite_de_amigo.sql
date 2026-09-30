-- Momentumm — o convite de amigo, com quem veio de quem.
--
-- A tela social do app já sabia convidar por @: a pessoa procurava alguém que
-- JÁ ESTAVA aqui dentro. O que faltava era a outra metade, que é a que faz o
-- produto crescer: chamar quem ainda não conhece.
--
-- Esta migration guarda a atribuição — quem convidou quem — e libera os
-- eventos do funil de convite. Ela NÃO cria recompensa por indicação: nenhum
-- XP, nenhum desconto, nenhuma vantagem de ranking. Se um dia existir, a
-- decisão é de produto e virá em outra migration, com as validações que
-- recompensa exige (conta ativada, autoindicação, teto, fraude).
--
-- ## Por que não existe tabela de códigos
--
-- O código do convite é o @ de quem convidou. Ele já é único, já é público,
-- já é o endereço da pessoa, e cabe num link que dá pra ler em voz alta:
-- `momentumm.app/convite/layra`. Uma tabela de tokens acrescentaria expiração,
-- uso único e limpeza de órfão pra resolver um problema que não existe — o
-- link de convite aqui não é credencial: ele não dá acesso a nada, só diz de
-- onde a pessoa veio.

-- ---------------------------------------------------------------------------
-- a atribuição
-- ---------------------------------------------------------------------------

/*
  Uma linha por pessoa CONVIDADA, e a chave primária é ela.

  Quem entra pelo link de alguém entra uma vez: a primeira atribuição vale e as
  seguintes são ignoradas. Sem isso, abrir o link de outra pessoa semanas
  depois reescreveria a origem da conta, e o funil passaria a contar a última
  visita em vez da porta de entrada.
*/
create table if not exists public.referrals (
  invitee_id uuid primary key references public.profiles (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint referrals_not_self check (invitee_id <> inviter_id)
);

comment on table public.referrals is
  'Quem convidou quem. Só atribuição de origem: não concede recompensa nenhuma.';

create index if not exists referrals_inviter_idx on public.referrals (inviter_id, created_at desc);

alter table public.referrals enable row level security;

/*
  As duas pontas veem a própria linha: quem convidou, pra saber que o convite
  deu certo; quem foi convidado, pra saber de onde veio. Mais ninguém.
*/
drop policy if exists "vê os próprios convites" on public.referrals;
create policy "vê os próprios convites"
  on public.referrals for select
  to authenticated
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

-- Sem política de insert: a gravação passa pela função abaixo, que é quem
-- aplica as regras. Uma porta de escrita direta permitiria à pessoa escolher
-- quem "a convidou", inclusive alguém que ela nunca viu.

/*
  Registrar de onde a conta veio.

  Regras, e cada uma existe por um motivo:

    conta nova          a atribuição só vale nos primeiros 30 dias. Abrir o
                        link de um amigo meses depois não reescreve a origem de
                        uma conta que já existia.
    uma vez             a primeira atribuição vale; as seguintes não fazem nada.
    nunca a si mesma    o @ da própria pessoa é ignorado em silêncio.
    @ que não existe    também em silêncio: a tela de convite não deve vazar
                        quem tem ou não conta aqui.

  Silêncio em vez de erro porque isto roda no primeiro segundo de vida da conta,
  e nenhuma dessas condições é problema DA PESSOA — quem abre o app pela
  primeira vez não pode ver uma falha por causa de um parâmetro de link.
*/
create or replace function public.register_referral(inviter_handle text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  quem    uuid := auth.uid();
  origem  uuid;
  nascida timestamptz;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select p.created_at into nascida from public.profiles p where p.id = quem;
  if nascida is null or nascida < now() - interval '30 days' then
    return false;
  end if;

  if exists (select 1 from public.referrals r where r.invitee_id = quem) then
    return false;
  end if;

  select p.id into origem
    from public.profiles p
   -- Igualdade, nunca `like`: com `%` isto viraria uma varredura da base.
   where lower(p.handle) = lower(btrim(inviter_handle))
   limit 1;

  if origem is null or origem = quem then
    return false;
  end if;

  insert into public.referrals (invitee_id, inviter_id) values (quem, origem);
  return true;
end;
$$;

revoke all on function public.register_referral(text) from public;
revoke all on function public.register_referral(text) from anon;
grant execute on function public.register_referral(text) to authenticated;

-- ---------------------------------------------------------------------------
-- os eventos do funil social
-- ---------------------------------------------------------------------------

/*
  A lista da 0056, com os eventos do convite e do limite do gratuito.

  Nenhum deles carrega texto escrito por ninguém: o payload continua fechado
  por chave em `product_event_metadata_keys`.

  `free_friend_limit_reached` é o que responde a pergunta comercial desta
  entrega — o teto de dois amigos no gratuito produz conversa sobre o PRO ou
  produz abandono? Sem esse evento, a resposta seria opinião.
*/
create or replace function public.product_event_names()
returns text[]
language sql
immutable
as $$
  select array[
    -- base (0024/0036)
    'session_start', 'feature_view', 'onboarding_completed',
    'objective_created', 'task_created', 'task_completed', 'habit_logged',
    'review_completed', 'momentum_viewed', 'ai_call', 'recovery_started',
    'share_exported', 'record_created', 'cancellation_requested', 'support_opened',
    'plan_limit_hit', 'checkout_started', 'subscription_canceled',
    'trial_started', 'trial_ended', 'reminder_enabled', 'reminder_disabled',

    -- o laço individual
    'primary_action_viewed', 'action_started', 'day_completed',
    'day_adapt_requested', 'day_adapt_completed',
    'recovery_shown', 'recovery_completed',
    'review_started', 'achievement_unlocked',

    -- Juntos (dupla de accountability)
    'pair_invite_created', 'pair_invite_opened', 'pair_invite_accepted',
    'pair_created', 'pair_viewed', 'encouragement_sent', 'encouragement_received',
    'pair_return_started', 'pair_left',

    -- gatilhos de retorno. Não existe evento de agendamento: nada é agendado
    -- com antecedência, o aviso é decidido na hora do envio.
    'notification_sent', 'notification_opened', 'notification_converted',
    'notification_failed',

    -- a permissão e o aparelho: onde a fila do push quebra
    'notification_permission_prompted', 'notification_permission_granted',
    'notification_permission_denied', 'push_subscription_created',

    -- instalação do app
    'pwa_install_prompted', 'pwa_installed', 'ios_install_shown',

    -- convite de amigo e o teto social do gratuito (0061)
    'friend_invite_started', 'friend_invite_shared', 'friend_invite_opened',
    'friend_invite_accepted', 'friend_added', 'friend_ranking_viewed',
    'free_friend_limit_reached'
  ];
$$;
