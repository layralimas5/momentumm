-- Momentumm, o convite de clube: pelo link e pelo app.
--
-- A 0062 deixou o clube com uma porta só: o dono INSERIA a pessoa. Funciona
-- entre quem já se conhece, e não funciona pra mais nada. Faltavam as duas
-- portas que fazem uma comunidade crescer:
--
--   o link      um endereço que a pessoa abre, lê o que é o clube e decide
--               entrar. Vale inclusive pro clube por convite: quem tem o link
--               foi chamado, e é isso que o link significa.
--   o convite   nominal, pra quem JÁ tem conta aqui. Não coloca ninguém em
--               lugar nenhum: chega como aviso, e a pessoa aceita ou recusa.
--
-- ## Por que o convite nominal não entra direto
--
-- Entrar em grupo sem ter dito sim é a definição de spam. A 0062 permitia
-- isso ao dono, e este é o conserto: o dono passa a CHAMAR, e quem responde é
-- quem vai participar. A política de insert em `club_members` continua igual,
-- e a inserção pelo aceite passa por função, com o id de quem aceitou.
--
-- ## Por que o token do link fica em claro
--
-- Ao contrário do convite de dupla (0049), este token não é credencial de
-- ninguém: ele é o endereço de UM clube, compartilhado com muita gente de
-- propósito, e precisa ser relido pra ser reenviado. Guardar só o hash
-- obrigaria a trocar o link a cada vez que o dono quisesse copiá-lo de novo, e
-- o que ele abre é uma lista de nomes e um ranking de dias cumpridos. O dono
-- pode girar o token quando quiser, e o anterior morre na hora.

-- ---------------------------------------------------------------------------
-- o convite nominal
-- ---------------------------------------------------------------------------

create table if not exists public.club_invitations (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  invitee_id   uuid not null references public.profiles (id) on delete cascade,
  inviter_id   uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pendente'
               check (status in ('pendente', 'aceito', 'recusado')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,

  -- Um convite por pessoa por clube. Reconvidar reaproveita a linha: sem isso,
  -- o dono conseguiria encher a caixa de avisos de alguém com o mesmo clube.
  unique (club_id, invitee_id),
  constraint club_invitations_not_self check (invitee_id <> inviter_id)
);

comment on table public.club_invitations is
  'Convite nominal pra clube. Não coloca ninguém dentro: quem entra é quem aceita.';

create index if not exists club_invitations_invitee_idx
  on public.club_invitations (invitee_id, status, created_at desc);

create index if not exists club_invitations_club_idx
  on public.club_invitations (club_id, status);

alter table public.club_invitations enable row level security;

/*
  As duas pontas veem: quem foi chamado, e o dono do clube que chamou.

  Os outros membros não veem. Quem ainda não respondeu não deveria aparecer
  numa lista de "quase membros" pra gente que ela talvez nem conheça.
*/
drop policy if exists "vê o convite que recebeu, ou o do seu clube" on public.club_invitations;
create policy "vê o convite que recebeu, ou o do seu clube"
  on public.club_invitations for select
  to authenticated
  using (auth.uid() = invitee_id or public.owns_club(club_id, auth.uid()));

-- Sem política de insert nem de update: convidar e responder passam pelas
-- funções abaixo. Uma porta direta deixaria qualquer conta escrever um convite
-- em nome de outra, ou marcar como "aceito" um convite que não é dela.

/*
  Apagar: o aviso é de quem recebeu.

  Quem foi chamado pode sumir com o convite sem responder, e o dono pode
  cancelar o que mandou. Nenhum dos dois é obrigado a conviver com uma linha
  pendente pra sempre.
*/
drop policy if exists "apaga o convite que recebeu ou que mandou" on public.club_invitations;
create policy "apaga o convite que recebeu ou que mandou"
  on public.club_invitations for delete
  to authenticated
  using (auth.uid() = invitee_id or public.owns_club(club_id, auth.uid()));

/*
  Chamar alguém que já tem conta.

  Exige dono COM assinatura, o mesmo que a 0062 exige pra administrar. Quem já
  é membro não é chamado de novo, e o convite recusado pode ser refeito: mudar
  de ideia é normal, e a linha é reaproveitada pra não virar histórico infinito
  de pedidos.

  O teto de 40 convites por dia por conta é contra geração em massa. Um dono
  chamando o círculo dele não chega perto disso.
*/
create or replace function public.invite_to_club(p_club uuid, p_person uuid)
returns public.club_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  quem    uuid := auth.uid();
  clube   public.clubs;
  convite public.club_invitations;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select * into clube from public.clubs where id = p_club;

  if clube.id is null or clube.owner_id <> quem then
    raise exception 'esse clube não é seu' using errcode = '42501';
  end if;

  if clube.archived_at is not null then
    raise exception 'esse clube está arquivado' using errcode = '42501';
  end if;

  if not public.has_pro(quem) then
    raise exception 'convidar pro clube faz parte do Momentumm PRO' using errcode = 'P0001';
  end if;

  if p_person = quem then
    raise exception 'você já está no clube' using errcode = '23505';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_person) then
    raise exception 'essa pessoa não existe' using errcode = '42501';
  end if;

  if public.is_club_member(p_club, p_person) then
    raise exception 'essa pessoa já está no clube' using errcode = '23505';
  end if;

  if (select count(*) from public.club_invitations i
       where i.inviter_id = quem and i.created_at > now() - interval '1 day') >= 40 then
    raise exception 'muitos convites hoje' using errcode = '53400';
  end if;

  insert into public.club_invitations (club_id, invitee_id, inviter_id)
  values (p_club, p_person, quem)
  on conflict (club_id, invitee_id) do update
    set status       = 'pendente',
        inviter_id   = quem,
        created_at   = now(),
        responded_at = null
  returning * into convite;

  return convite;
end;
$$;

revoke all on function public.invite_to_club(uuid, uuid) from public;
revoke all on function public.invite_to_club(uuid, uuid) from anon;
grant execute on function public.invite_to_club(uuid, uuid) to authenticated;

/*
  Responder ao convite. Só quem recebeu responde.

  O aceite insere a linha de membro aqui dentro, na mesma transação: aceitar e
  não entrar deixaria a pessoa com um convite "aceito" e nenhum clube.

  Recusar não apaga a linha, marca. Assim o dono não reenvia o mesmo convite
  achando que a mensagem se perdeu.
*/
create or replace function public.respond_club_invitation(p_invitation uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  quem    uuid := auth.uid();
  convite public.club_invitations;
  clube   public.clubs;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select * into convite
    from public.club_invitations
   where id = p_invitation
     for update;

  if convite.id is null or convite.invitee_id <> quem then
    raise exception 'esse convite não é seu' using errcode = '42501';
  end if;

  if convite.status <> 'pendente' then
    return false;
  end if;

  if p_accept then
    select * into clube from public.clubs where id = convite.club_id;

    if clube.id is null or clube.archived_at is not null then
      raise exception 'esse clube não está mais no ar' using errcode = '42501';
    end if;

    insert into public.club_members (club_id, user_id, role)
    values (convite.club_id, quem, 'membro')
    on conflict (club_id, user_id) do nothing;
  end if;

  update public.club_invitations
     set status = case when p_accept then 'aceito' else 'recusado' end,
         responded_at = now()
   where id = convite.id;

  return true;
end;
$$;

revoke all on function public.respond_club_invitation(uuid, boolean) from public;
revoke all on function public.respond_club_invitation(uuid, boolean) from anon;
grant execute on function public.respond_club_invitation(uuid, boolean) to authenticated;

/*
  Os convites que esperam por mim, prontos pra virar aviso na tela.

  `security definer` e retorno estreito pelo mesmo motivo do `club_ranking`: um
  clube por convite não é legível por quem ainda não entrou, e o perfil de quem
  convidou também não. Sem esta função, o aviso seria "alguém te chamou pra um
  clube" sem nome nenhum, que é um aviso que ninguém consegue responder.
*/
create or replace function public.my_club_invitations()
returns table (
  id             uuid,
  club_id        uuid,
  club_name      text,
  club_category  text,
  club_cover     text,
  inviter_name   text,
  inviter_avatar text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id,
         c.id,
         c.name,
         c.category,
         c.cover,
         p.name,
         p.avatar_url,
         i.created_at
    from public.club_invitations i
    join public.clubs c on c.id = i.club_id
    join public.profiles p on p.id = i.inviter_id
   where i.invitee_id = auth.uid()
     and i.status = 'pendente'
     and c.archived_at is null
   order by i.created_at desc;
$$;

revoke all on function public.my_club_invitations() from public;
revoke all on function public.my_club_invitations() from anon;
grant execute on function public.my_club_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- o link do clube
-- ---------------------------------------------------------------------------

create table if not exists public.club_invite_links (
  club_id    uuid primary key references public.clubs (id) on delete cascade,
  token      text not null unique check (token ~ '^[a-f0-9]{24,64}$'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.club_invite_links is
  'Um link vivo por clube. Token em claro: é endereço de grupo, não credencial de pessoa.';

alter table public.club_invite_links enable row level security;

-- Sem política nenhuma: ler e escrever aqui passa pelas funções abaixo. Uma
-- leitura direta entregaria o link de qualquer clube a qualquer conta.

/*
  O link do clube. Cria na primeira vez e devolve o mesmo depois.

  `p_rotate` gera outro e mata o anterior, que é o que se faz quando o link
  vazou pra onde não devia. Sem sobrecarga de função de propósito: duas
  assinaturas com o mesmo nome viram duas verdades no dia em que uma mudar.
*/
create or replace function public.club_invite_token(p_club uuid, p_rotate boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := auth.uid();
  clube public.clubs;
  atual text;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select * into clube from public.clubs where id = p_club;

  if clube.id is null or clube.owner_id <> quem then
    raise exception 'esse clube não é seu' using errcode = '42501';
  end if;

  if clube.archived_at is not null then
    raise exception 'esse clube está arquivado' using errcode = '42501';
  end if;

  if not public.has_pro(quem) then
    raise exception 'o link do clube faz parte do Momentumm PRO' using errcode = 'P0001';
  end if;

  if not coalesce(p_rotate, false) then
    select token into atual from public.club_invite_links where club_id = p_club;
    if atual is not null then
      return atual;
    end if;
  end if;

  atual := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.club_invite_links (club_id, token, created_by)
  values (p_club, atual, quem)
  on conflict (club_id) do update
    set token = excluded.token, created_by = excluded.created_by, created_at = now();

  return atual;
end;
$$;

revoke all on function public.club_invite_token(uuid, boolean) from public;
revoke all on function public.club_invite_token(uuid, boolean) from anon;
grant execute on function public.club_invite_token(uuid, boolean) to authenticated;

/*
  O que quem abre o link vê ANTES de entrar, com ou sem conta.

  Nome, descrição, categoria, capa e quantas pessoas. Nenhum nome de membro e
  nenhum número de ninguém: quem tem o link ainda não é do clube, e o ranking é
  de dentro. Pública porque quem recebe o link quase nunca tem conta, e mandar
  essa pessoa pro cadastro sem dizer do que se trata é perder o convite.
*/
create or replace function public.club_invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clube  public.clubs;
  quem   uuid := auth.uid();
  quantos integer;
begin
  select c.* into clube
    from public.club_invite_links l
    join public.clubs c on c.id = l.club_id
   where l.token = coalesce(p_token, '');

  if clube.id is null then
    return jsonb_build_object('status', 'invalido');
  end if;

  if clube.archived_at is not null then
    return jsonb_build_object('status', 'arquivado', 'name', clube.name);
  end if;

  select count(*) into quantos from public.club_members where club_id = clube.id;

  return jsonb_build_object(
    'status', 'valido',
    'club_id', clube.id,
    'name', clube.name,
    'description', clube.description,
    'category', clube.category,
    'cover', clube.cover,
    'members', quantos,
    /* A tela usa os dois pra escolher entre "entrar", "abrir" e "criar conta". */
    'already_member', quem is not null and public.is_club_member(clube.id, quem),
    'can_join', quem is not null
  );
end;
$$;

revoke all on function public.club_invite_preview(text) from public;
grant execute on function public.club_invite_preview(text) to anon;
grant execute on function public.club_invite_preview(text) to authenticated;

/*
  Entrar pelo link.

  Aqui está a diferença em relação à política da 0062, e ela é intencional: o
  link entra em clube POR CONVITE também. Ter o link É o convite, e um link que
  só funciona em clube aberto não serviria pra nada que o botão "entrar" já não
  resolvesse.

  Quem já é membro recebe o id de volta sem erro: abrir duas vezes o mesmo link
  não é falha de ninguém.
*/
create or replace function public.join_club_by_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := auth.uid();
  clube public.clubs;
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  select c.* into clube
    from public.club_invite_links l
    join public.clubs c on c.id = l.club_id
   where l.token = coalesce(p_token, '');

  if clube.id is null then
    raise exception 'esse link não vale mais' using errcode = '42501';
  end if;

  if clube.archived_at is not null then
    raise exception 'esse clube está arquivado' using errcode = '42501';
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (clube.id, quem, 'membro')
  on conflict (club_id, user_id) do nothing;

  -- Entrou pelo link: um convite nominal pendente pro mesmo clube perde o
  -- sentido, e deixá-lo pendente deixaria um aviso pedindo o que já aconteceu.
  update public.club_invitations
     set status = 'aceito', responded_at = now()
   where club_id = clube.id and invitee_id = quem and status = 'pendente';

  return clube.id;
end;
$$;

revoke all on function public.join_club_by_token(text) from public;
revoke all on function public.join_club_by_token(text) from anon;
grant execute on function public.join_club_by_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- os eventos do convite de clube
-- ---------------------------------------------------------------------------

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

    -- gatilhos de retorno
    'notification_sent', 'notification_opened', 'notification_converted',
    'notification_failed',

    -- a permissão e o aparelho
    'notification_permission_prompted', 'notification_permission_granted',
    'notification_permission_denied', 'push_subscription_created',

    -- instalação do app
    'pwa_install_prompted', 'pwa_installed', 'ios_install_shown',

    -- convite de amigo e o teto social do gratuito (0061)
    'friend_invite_started', 'friend_invite_shared', 'friend_invite_opened',
    'friend_invite_accepted', 'friend_added', 'friend_ranking_viewed',
    'free_friend_limit_reached',

    -- clubes (0062)
    'club_creation_paywall_viewed', 'club_creation_upgrade_clicked',
    'club_created', 'club_joined', 'club_left', 'club_ranking_viewed',

    -- convite de clube (0063)
    'club_invite_sent', 'club_invite_accepted', 'club_invite_declined',
    'club_invite_link_created', 'club_invite_link_opened'
  ];
$$;
