-- Momentumm — quantos objetivos cabem na mesma área, e isso passa a ser o
-- plano que decide.
--
-- Até aqui era UM objetivo ativo por eixo, pra todo mundo, garantido por índice
-- único (`objectives_one_active_per_axis`, 0003). A regra de produto mudou: o
-- gratuito continua com um por área, o PRO passa a poder manter quantos quiser
-- no mesmo eixo — "Projeto → lançar o app", "Projeto → criar o curso" e
-- "Projeto → aumentar o faturamento" convivem.
--
-- ## O que NÃO muda
--
-- O teto de objetivos ATIVOS continua existindo e continua sendo dois no
-- gratuito (`plans.free.activeObjectives`, 0027). Soltar o eixo não solta a
-- quantidade.
--
-- O progresso continua saindo das `activities` do eixo, sem tabela de vínculo.
-- É a regra de ouro do produto e ela não muda aqui. A consequência é real e
-- está registrada: dois objetivos PRO no mesmo eixo somam das MESMAS
-- atividades, então cada um mede "volume registrado naquela área dentro da
-- janela dele", não esforço atribuído a ele. Atribuição por objetivo é outra
-- decisão de produto e pede tabela nova — não é o que esta migration faz.
--
-- ## Por que o índice único sai
--
-- Ele era a regra. Sem ele, o limite passa a ser do trigger, e trigger precisa
-- de trava: dois inserts simultâneos da mesma conta contariam o mesmo estado e
-- furariam o teto do gratuito. É pra isso que entra o `pg_advisory_xact_lock`,
-- tomado por conta — numa checagem só existe um dono, então não há ordem a
-- respeitar nem deadlock possível.
--
-- ## Os códigos de erro são contrato
--
-- `23505` no conflito de área e `22023` no teto de objetivos. Não é detalhe:
-- `infrastructure/supabase/supabase-repositories.ts` traduz o primeiro em
-- `ObjectiveAxisConflictError` (com o eixo junto, que é o que faz a tela
-- oferecer a saída) e o segundo em `PlanLimitError`. Trocar o código aqui faz a
-- ativação do plano do quiz voltar ao beco sem saída de antes.

-- ---------------------------------------------------------------------------
-- 1. o teto como configuração
-- ---------------------------------------------------------------------------

update public.product_settings
   set value = value || jsonb_build_object('objectivesPerAxis', 1),
       updated_at = now()
 where key = 'plans.free';

update public.product_settings
   set value = value || jsonb_build_object('objectivesPerAxis', null),
       updated_at = now()
 where key = 'plans.pro';

/* O validador precisa conhecer `objectivesPerAxis`, como conheceu `pairs`. */
create or replace function public.validate_setting(p_key text, p_value jsonb)
returns void
language plpgsql
immutable
as $fn$
  declare k text;
begin
  if p_key in ('plans.free', 'plans.pro') then
    for k in select jsonb_object_keys(p_value) loop
      if k not in ('activeObjectives', 'activeHabits', 'activePlans', 'actionsPerDay',
                   'historyDays', 'pairEncouragementsPerDay', 'pairs',
                   'objectivesPerAxis') then
        raise exception 'chave desconhecida em %: %', p_key, k using errcode = '22023';
      end if;
      if jsonb_typeof(p_value -> k) not in ('number', 'null') then
        raise exception '% precisa ser número ou nulo', k using errcode = '22023';
      end if;
    end loop;
  elsif p_key = 'ai.limits' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean'
       or jsonb_typeof(p_value -> 'monthlyPerPlan' -> 'free') <> 'number'
       or jsonb_typeof(p_value -> 'monthlyPerPlan' -> 'pro') <> 'number'
       or jsonb_typeof(p_value -> 'dailySafetyLimit') <> 'number'
       or jsonb_typeof(p_value -> 'perMinute') <> 'number'
       or jsonb_typeof(p_value -> 'costAlertUsd') <> 'number'
       or jsonb_typeof(p_value -> 'abuseBlockMinutes') <> 'number'
       or jsonb_typeof(p_value -> 'kinds') <> 'object'
       or coalesce(jsonb_typeof(p_value -> 'costPerMillionInputUsd'), 'null') not in ('number', 'null')
       or coalesce(jsonb_typeof(p_value -> 'costPerMillionOutputUsd'), 'null') not in ('number', 'null') then
      raise exception 'ai.limits fora do formato' using errcode = '22023';
    end if;
    if (p_value -> 'dailySafetyLimit')::int < 1 or (p_value -> 'perMinute')::int < 1 then
      raise exception 'tetos da IA precisam ser positivos' using errcode = '22023';
    end if;
  elsif p_key in ('features', 'experimental') then
    for k in select jsonb_object_keys(p_value) loop
      if jsonb_typeof(p_value -> k) <> 'boolean' then
        raise exception '% precisa ser booleano', k using errcode = '22023';
      end if;
    end loop;
  elsif p_key = 'maintenance' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean' or jsonb_typeof(p_value -> 'message') <> 'string'
       or char_length(p_value ->> 'message') > 280 then
      raise exception 'maintenance fora do formato' using errcode = '22023';
    end if;
  elsif p_key = 'system.message' then
    if jsonb_typeof(p_value -> 'enabled') <> 'boolean' or jsonb_typeof(p_value -> 'text') <> 'string'
       or char_length(p_value ->> 'text') > 280
       or coalesce(p_value ->> 'tone', '') not in ('info', 'aviso', 'sucesso') then
      raise exception 'system.message fora do formato' using errcode = '22023';
    end if;
  elsif p_key = 'legal.versions' then
    if not ((p_value ->> 'termos') ~ '^\d{4}-\d{2}-\d{2}$' and (p_value ->> 'privacidade') ~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception 'legal.versions precisa de datas AAAA-MM-DD' using errcode = '22023';
    end if;
  else
    raise exception 'configuração desconhecida: %', p_key using errcode = '22023';
  end if;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. mais de um objetivo por área passa a ser possível
-- ---------------------------------------------------------------------------

/*
  O índice único sai e o de leitura fica.

  `objectives_one_active_per_axis` era único em `(user_id, axis_slug) where
  archived_at is null`. O índice sobre a mesma expressão continua valendo a
  pena: toda função aqui procura "os objetivos ativos desta conta nesta área".
*/
drop index if exists public.objectives_one_active_per_axis;

create index if not exists objectives_active_user_axis_idx
  on public.objectives (user_id, axis_slug) where archived_at is null;

comment on table public.objectives is
  'Objetivos com prazo. Quantos ativos por conta e quantos por área é o plano que diz (public.objective_limit_for, public.objective_axis_limit_for).';

-- ---------------------------------------------------------------------------
-- 3. as contagens e os tetos
-- ---------------------------------------------------------------------------

/*
  Objetivo ATIVO é o não arquivado, e isso inclui pausado e concluído.

  É a mesma janela do índice que sai (`archived_at is null`) e a mesma da
  listagem do repositório, de propósito: pausado e concluído continuam somando
  das mesmas atividades do eixo, então continuam ocupando o lugar. Contar só o
  "em andamento" aqui faria o servidor liberar o que a tela recusa, e é a mesma
  janela que a 0005 preservou de propósito ao acrescentar `paused_at`.
*/
create or replace function public.objective_axis_count_for(p_user uuid, p_axis text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.objectives o
   where o.user_id = p_user and o.axis_slug = p_axis and o.archived_at is null;
$$;

revoke all on function public.objective_axis_count_for(uuid, text) from public;
revoke all on function public.objective_axis_count_for(uuid, text) from anon;
revoke all on function public.objective_axis_count_for(uuid, text) from authenticated;

/*
  Quantos objetivos EM ANDAMENTO a conta tem, somando todas as áreas.

  Janela diferente da contagem por área, de propósito, e a diferença não é
  descuido: `activeObjectives` sempre foi "em andamento" no app
  (`plan-usage.ts`, `objectiveLimit`), onde pausado e concluído liberam a vaga.
  Contar aqui o não arquivado faria o servidor recusar o terceiro objetivo de
  quem concluiu dois — uma regra nova, inventada num deploy que era pra soltar
  limite, não apertar.
*/
create or replace function public.objective_count_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.objectives o
   where o.user_id = p_user
     and o.archived_at is null
     and o.paused_at is null
     and o.completed_at is null;
$$;

revoke all on function public.objective_count_for(uuid) from public;
revoke all on function public.objective_count_for(uuid) from anon;
revoke all on function public.objective_count_for(uuid) from authenticated;

/** Quantos objetivos o plano permite na MESMA área. `null` é sem limite. */
create or replace function public.objective_axis_limit_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (s.value ->> 'objectivesPerAxis')::int
    from public.product_settings s
   where s.key = 'plans.' || public.plan_for_user(p_user)::text;
$$;

revoke all on function public.objective_axis_limit_for(uuid) from public;
revoke all on function public.objective_axis_limit_for(uuid) from anon;
revoke all on function public.objective_axis_limit_for(uuid) from authenticated;

/** Quantos objetivos ativos o plano permite no total. `null` é sem limite. */
create or replace function public.objective_limit_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (s.value ->> 'activeObjectives')::int
    from public.product_settings s
   where s.key = 'plans.' || public.plan_for_user(p_user)::text;
$$;

revoke all on function public.objective_limit_for(uuid) from public;
revoke all on function public.objective_limit_for(uuid) from anon;
revoke all on function public.objective_limit_for(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. a guarda, no lugar do índice
-- ---------------------------------------------------------------------------

/*
  "Cabe esse objetivo?" — a pergunta que o INSERT passa a fazer.

  Duas checagens, nessa ordem, e a ordem importa: a de ÁREA vem primeiro porque
  ela tem saída específica na tela (qual objetivo está ocupando o lugar), e a de
  quantidade vem depois porque a saída dela é outra (liberar espaço ou assinar).
  Invertendo, o gratuito que já tem dois objetivos e tenta um terceiro na área
  ocupada receberia o recado genérico em vez do que resolve.

  A trava por conta existe porque sem o índice único dois inserts simultâneos
  contariam o mesmo estado. Advisory lock de transação: solta no commit, e como
  a chave é uma só por checagem, não há deadlock possível.

  O gatilho de UPDATE não é zelo excessivo: hoje não existe fluxo de desarquivar
  no app, e é justamente por isso que o dia em que existir ninguém vai lembrar
  de vir checar o teto aqui.
*/
create or replace function public.objectives_assert_plan_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  teto_eixo  int;
  teto_total int;
  tem        int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  teto_eixo := public.objective_axis_limit_for(new.user_id);
  if teto_eixo is not null then
    tem := public.objective_axis_count_for(new.user_id, new.axis_slug);
    if tem >= teto_eixo then
      raise exception
        'Você já tem % nessa área. Fecha ou arquiva antes de abrir outro, ou assina o PRO pra manter vários.',
        case when teto_eixo = 1 then 'um objetivo ativo' else teto_eixo || ' objetivos ativos' end
        using errcode = '23505';
    end if;
  end if;

  teto_total := public.objective_limit_for(new.user_id);
  if teto_total is not null then
    tem := public.objective_count_for(new.user_id);
    if tem >= teto_total then
      raise exception 'O plano gratuito guarda até % objetivos ativos ao mesmo tempo.', teto_total
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$fn$;

revoke all on function public.objectives_assert_plan_room() from public;
revoke all on function public.objectives_assert_plan_room() from anon;
revoke all on function public.objectives_assert_plan_room() from authenticated;

drop trigger if exists objectives_plan_room on public.objectives;

/*
  O `when` não é otimização: objetivo que JÁ NASCE arquivado não ocupa vaga
  nenhuma, e sem ele um restore ou uma importação de histórico seria recusada
  por um teto que aquela linha não consome. O índice que saiu tinha essa mesma
  cláusula (`where archived_at is null`) — a guarda precisa herdá-la.
*/
create trigger objectives_plan_room
  before insert on public.objectives
  for each row
  when (new.archived_at is null)
  execute function public.objectives_assert_plan_room();

drop trigger if exists objectives_plan_room_unarchive on public.objectives;

create trigger objectives_plan_room_unarchive
  before update on public.objectives
  for each row
  when (old.archived_at is not null and new.archived_at is null)
  execute function public.objectives_assert_plan_room();
