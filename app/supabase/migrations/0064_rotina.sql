-- ===========================================================================
-- 0064 — Rotina: o dia da pessoa, e não só o plano dela
-- ===========================================================================
--
-- O app sabia planejar (objetivo, etapa, ação) e sabia repetir (hábito). O que
-- ele não sabia era o resto do dia: acordar, café, trabalho, almoço, o dentista
-- de terça às 10:30. A vida em volta dos objetivos, que é onde eles acontecem.
--
-- ## Por que uma tabela nova, e não `habits` nem `tasks`
--
-- `habits` exige eixo e alvo numérico com versão mínima, e alimenta o Momentum
-- Score. "Acordar" não tem eixo nem meta, e doze itens de rotina virando hábito
-- seriam a maneira mais rápida de inflar o score marcando "acordei" — o
-- comportamento oposto ao que o produto defende.
--
-- `tasks` é de UMA data. O que se repete toda segunda, quarta e sexta viraria
-- uma linha nova por ocorrência, pra sempre, e "mudei o treino pras 19h" teria
-- que reescrever um número desconhecido de linhas futuras.
--
-- Então a recorrência mora na REGRA (`routine_items`) e a execução mora no DIA
-- (`routine_occurrences`), no mesmo desenho de `habits` + `habit_logs`. Duas
-- formas diferentes de dizer "fiz isso naquele dia" seriam duas contas
-- diferentes de constância seis meses depois.
--
-- ## A ocorrência só existe quando alguém toca
--
-- Não há gerador de linhas futuras. Um item diário de um ano não são 365 linhas
-- esperando: são zero até o primeiro check. Sem linha, o item está pendente.
--
-- ## Privacidade
--
-- Rotina é privada, ponto. As duas tabelas nascem com as quatro políticas do
-- molde `apply_owner_policies` (dono, `to authenticated`), e esta migration NÃO
-- cria nenhuma política que dê a outra pessoa `select` em qualquer uma delas.
-- Nada daqui atravessa perfil, círculo, clube ou feed: horário de casa, nome de
-- compromisso e observação são exatamente o tipo de dado que não pode vazar por
-- um recurso social ligado depois.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- tipos
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'routine_recurrence') then
    create type public.routine_recurrence as enum (
      'diario',
      'dias-semana',
      'uteis',
      'fim-semana',
      'unica'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'routine_status') then
    -- `pulado` NÃO é falha: pular a quarta não mexe na sexta, e a linha fica
    -- porque "eu pulei" é informação. `reagendado` guarda a decisão de mover,
    -- que é diferente de não ter feito.
    create type public.routine_status as enum (
      'pendente',
      'feito',
      'pulado',
      'reagendado'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- a regra
-- ---------------------------------------------------------------------------

create table if not exists public.routine_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 2 and 90),
  note          text check (note is null or char_length(note) <= 400),
  category      text check (category is null or char_length(category) <= 40),
  time_of_day   text check (time_of_day is null or time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  day_part      public.day_part not null default 'qualquer',
  duration_min  integer check (duration_min is null or (duration_min > 0 and duration_min <= 720)),
  recurrence    public.routine_recurrence not null default 'diario',
  -- Vazio significa "não se aplica". 0 = domingo, como no getDay() do JS e
  -- como já é em `habits.weekdays`.
  weekdays      smallint[] not null default '{}',
  -- A data, e só em `unica`. A constraint abaixo é o que impede um item
  -- recorrente de nascer preso a um dia.
  day           date,
  objective_id  uuid references public.objectives (id) on delete set null,
  -- Guardado desde já; o disparo do lembrete ainda não existe (ver o README
  -- das functions). Coluna sem uso é barata; migration a mais, não.
  reminder_min  smallint check (reminder_min is null or (reminder_min >= 0 and reminder_min <= 120)),
  "order"       smallint not null default 0,
  paused_at     timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),

  constraint routine_items_weekdays_range check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  -- `array_length` de um array vazio devolve NULL, e `null >= 1` é NULL, que a
  -- constraint aceita. Sem o coalesce, "dias específicos sem nenhum dia"
  -- passaria batido: o item nasceria recorrente em dia nenhum.
  constraint routine_items_dias_precisam_de_dia check (
    recurrence <> 'dias-semana' or coalesce(array_length(weekdays, 1), 0) >= 1
  ),
  constraint routine_items_unica_tem_data check (
    (recurrence = 'unica' and day is not null)
    or (recurrence <> 'unica' and day is null)
  )
);

create index if not exists routine_items_user_idx
  on public.routine_items (user_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- a execução
-- ---------------------------------------------------------------------------

create table if not exists public.routine_occurrences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  item_id       uuid not null references public.routine_items (id) on delete cascade,
  day           date not null,
  status        public.routine_status not null default 'pendente',
  -- O horário que a regra previa, congelado no dia. Sem ele, mudar o horário do
  -- item em janeiro reescreveria o histórico de dezembro.
  planned_time  text check (planned_time is null or planned_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Horário trocado só neste dia ("reagendar pra mais tarde").
  time_override text check (time_override is null or time_override ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Movido pra outro dia: o item some daqui e aparece lá.
  moved_to_day  date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),

  constraint routine_occurrences_one_per_day unique (item_id, day),
  constraint routine_occurrences_nao_move_pro_mesmo_dia check (
    moved_to_day is null or moved_to_day <> day
  )
);

create index if not exists routine_occurrences_user_day_idx
  on public.routine_occurrences (user_id, day);

create index if not exists routine_occurrences_movidas_idx
  on public.routine_occurrences (user_id, moved_to_day)
  where moved_to_day is not null;

-- ---------------------------------------------------------------------------
-- a ocorrência é do dono do item, sempre
-- ---------------------------------------------------------------------------

/*
  O `user_id` da ocorrência não é confiado ao cliente.

  Ele é carimbado a partir do DONO DO ITEM. Sem isso, a política de insert
  aceitaria `user_id = auth.uid()` apontando pra um `item_id` de outra pessoa:
  a linha seria minha, o item seria dela, e a rotina dela passaria a ter uma
  ocorrência que ela não escreveu. É a mesma lição de `record_audit`, que
  carimba o autor em vez de aceitá-lo por parâmetro.
*/
create or replace function public.routine_occurrence_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  select user_id into dono from public.routine_items where id = new.item_id;

  if dono is null then
    raise exception 'item de rotina inexistente' using errcode = '23503';
  end if;

  if dono <> auth.uid() and auth.uid() is not null then
    raise exception 'esse item de rotina não é seu' using errcode = '42501';
  end if;

  new.user_id := dono;

  -- Concluir carimba a hora; desmarcar apaga. Estado e carimbo discordando é
  -- como um histórico começa a mentir.
  if new.status = 'feito' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'feito' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.routine_occurrence_owner() from public;
revoke all on function public.routine_occurrence_owner() from anon;

drop trigger if exists routine_occurrences_owner on public.routine_occurrences;
create trigger routine_occurrences_owner
  before insert or update on public.routine_occurrences
  for each row execute function public.routine_occurrence_owner();

-- ---------------------------------------------------------------------------
-- RLS pelo molde da 0015: quatro políticas, `to authenticated`
-- ---------------------------------------------------------------------------

select public.apply_owner_policies('routine_items');
select public.apply_owner_policies('routine_occurrences');

-- ---------------------------------------------------------------------------
-- as duas tabelas entram na exportação e no recomeço
-- ---------------------------------------------------------------------------

/*
  Dado que a pessoa escreveu e não sai na exportação é dado que ela não
  consegue levar embora. A rotina é dela como o resto.

  A função é reescrita inteira, e não estendida: `export_my_data` é um `select`
  único de propósito, pra rodar com a RLS de quem pede, e encadear versões dela
  seria criar uma pilha que ninguém consegue ler daqui a três migrations.
*/
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'format', 'momentumm.export.v1',
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
    'legal_acceptances', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id') from public.legal_acceptances l where l.user_id = auth.uid()), '[]'::jsonb),
    'activity_types', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id') from public.activity_types t where t.user_id = auth.uid()), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id') from public.activities a where a.user_id = auth.uid()), '[]'::jsonb),
    'objectives', coalesce((select jsonb_agg(to_jsonb(o) - 'user_id') from public.objectives o where o.user_id = auth.uid()), '[]'::jsonb),
    'plan_stages', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.plan_stages s where s.user_id = auth.uid()), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id') from public.goals g where g.user_id = auth.uid()), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(h) - 'user_id') from public.habits h where h.user_id = auth.uid()), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(hl) - 'user_id') from public.habit_logs hl where hl.user_id = auth.uid()), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(k) - 'user_id') from public.tasks k where k.user_id = auth.uid()), '[]'::jsonb),
    'check_ins', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id') from public.check_ins c where c.user_id = auth.uid()), '[]'::jsonb),
    'wins', coalesce((select jsonb_agg(to_jsonb(w) - 'user_id') from public.wins w where w.user_id = auth.uid()), '[]'::jsonb),
    'weekly_reviews', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.weekly_reviews r where r.user_id = auth.uid()), '[]'::jsonb),
    'journey_events', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id') from public.journey_events e where e.user_id = auth.uid()), '[]'::jsonb),
    'challenges', coalesce((select jsonb_agg(to_jsonb(ch) - 'owner_id') from public.challenges ch where ch.owner_id = auth.uid()), '[]'::jsonb),
    'challenge_participations', coalesce((select jsonb_agg(to_jsonb(cp) - 'user_id') from public.challenge_participants cp where cp.user_id = auth.uid()), '[]'::jsonb),
    'friendships', coalesce((select jsonb_agg(jsonb_build_object('status', f.status, 'created_at', f.created_at, 'requested_by_me', f.requester_id = auth.uid())) from public.friendships f where f.requester_id = auth.uid() or f.addressee_id = auth.uid()), '[]'::jsonb),
    'ai_calls', coalesce((select jsonb_agg(to_jsonb(ai) - 'user_id') from public.ai_calls ai where ai.user_id = auth.uid()), '[]'::jsonb),
    'routine_items', coalesce((select jsonb_agg(to_jsonb(ri) - 'user_id') from public.routine_items ri where ri.user_id = auth.uid()), '[]'::jsonb),
    'routine_occurrences', coalesce((select jsonb_agg(to_jsonb(ro) - 'user_id') from public.routine_occurrences ro where ro.user_id = auth.uid()), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('path', so.name, 'size', (so.metadata ->> 'size')::bigint, 'mimetype', so.metadata ->> 'mimetype', 'created_at', so.created_at)) from storage.objects so where so.bucket_id = 'user-media' and (storage.foldername(so.name))[1] = auth.uid()::text), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_data() from public;
revoke all on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- e o recomeço leva a rotina junto
-- ---------------------------------------------------------------------------

create or replace function public.reset_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := auth.uid();
begin
  if quem is null then
    raise exception 'sessão inválida' using errcode = '42501';
  end if;

  perform public.record_audit('conta.recomecar', 'account', quem::text, 'ok', '{}'::jsonb);

  -- Sociais primeiro: o que a pessoa criou some; o que ela recebeu de amigos
  -- (participação em desafio de outra pessoa, apoio de outra pessoa) some
  -- junto porque aponta pra um momento ou desafio que deixa de existir.
  delete from public.challenge_participants where user_id = quem;
  delete from public.challenges where owner_id = quem;
  delete from public.journey_event_supports where user_id = quem;
  delete from public.journey_events where user_id = quem;

  -- O ciclo do produto. As etapas caem com o objetivo e os logs com o hábito.
  delete from public.tasks where user_id = quem;
  delete from public.objectives where user_id = quem;
  delete from public.goals where user_id = quem;
  delete from public.habits where user_id = quem;
  delete from public.activities where user_id = quem;
  delete from public.check_ins where user_id = quem;
  delete from public.wins where user_id = quem;
  delete from public.weekly_reviews where user_id = quem;

  -- A rotina (0064). As ocorrencias caem com o item, pela cascata.
  delete from public.routine_items where user_id = quem;

  -- Os eixos que ela criou. Os de fábrica não têm dono e ficam.
  delete from public.activity_types where user_id = quem;

  -- A evolução volta ao nível 1: recomeçar é recomeçar.
  delete from public.xp_transactions where user_id = quem;
  delete from public.user_achievements where user_id = quem;
  delete from public.user_evolution where user_id = quem;

  -- O álbum do dia (0060) cai junto com os arquivos: a linha guarda o caminho
  -- do que está prestes a ser apagado, e caminho sem arquivo é foto quebrada.
  delete from public.day_photos where user_id = quem;

  -- Os arquivos. Mesmo contrato da exclusão: o cliente já limpa pela API
  -- antes, e aqui é a garantia caso o storage aceite.
  begin
    delete from storage.objects
     where bucket_id = 'user-media'
       and (storage.foldername(name))[1] = quem::text;
  exception
    when others then
      raise warning 'reset_my_data: storage recusou apagar a pasta de % (%).', quem, sqlerrm;
  end;
end;
$$;

revoke all on function public.reset_my_data() from public;
revoke all on function public.reset_my_data() from anon;
grant execute on function public.reset_my_data() to authenticated;
