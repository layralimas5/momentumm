-- Momentumm — a etapa, que é o degrau que faltava entre objetivo e ação.
--
-- Antes desta migration o produto tinha objetivo e ação, e nada no meio. Sem
-- etapa não existe peso, não existe progresso ponderado e não existe resposta
-- pra "o que está travando o objetivo" — as três coisas que separam um sistema
-- de progresso de um CRUD com tela bonita.
--
-- Tudo aqui é ADITIVO. Nenhuma coluna é removida ou renomeada, nenhum dado é
-- reescrito. Objetivo, hábito e ação que já existem continuam válidos: ação sem
-- etapa é legítima (é o objetivo que ainda não virou plano) e continua contando
-- exatamente como contava.
--
-- ## Por que a etapa aponta pro objetivo, sem uma tabela `plans`
--
-- No V1 um objetivo tem UM caminho. Uma tabela intermediária que teria sempre
-- uma linha por objetivo custaria um join em toda leitura pra representar uma
-- escolha que ninguém faz. Quando existir mais de um plano por objetivo,
-- `objective_id` vira `plan_id` e o resto continua igual.

-- ---------------------------------------------------------------------------
-- plan_stages
-- ---------------------------------------------------------------------------

create type public.stage_status as enum (
  'nao-iniciada',
  'em-andamento',
  'concluida',
  'pausada'
);

-- 'atrasada' NÃO é um valor guardado: ela é derivada de `due_on` contra o dia
-- de hoje. Guardar abriria a porta pra uma etapa marcada atrasada com prazo lá
-- na frente, que é o tipo de contradição que a tela não pode mostrar. Mesma
-- decisão já tomada em objectives (estado guardado x status calculado).

create table public.plan_stages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  objective_id uuid not null references public.objectives (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 80),
  description  text check (description is null or char_length(description) <= 400),
  sort_order   integer not null default 0,
  -- O peso é o que torna o progresso honesto: cinco etapas não valem 20% cada
  -- só por serem cinco. A soma 100 é garantida pelo domínio, não por constraint
  -- de tabela: uma checagem por linha não consegue ver o conjunto, e uma
  -- constraint deferida travaria a reordenação no meio.
  weight       smallint not null default 0 check (weight between 0 and 100),
  status       public.stage_status not null default 'nao-iniciada',
  due_on       date,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index plan_stages_objective_idx
  on public.plan_stages (objective_id, sort_order);

create index plan_stages_user_idx on public.plan_stages (user_id);

alter table public.plan_stages enable row level security;

-- Etapa é privada como o resto do planejamento: ela descreve o caminho que a
-- pessoa está seguindo, não o que ela publica.
create policy "usuário gerencia as próprias etapas"
  on public.plan_stages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Ações: etapa, peso e obrigatoriedade.
-- ---------------------------------------------------------------------------

alter table public.tasks
  -- `on delete set null`: apagar uma etapa não pode apagar o trabalho que
  -- estava dentro dela. A ação volta pro objetivo sem etapa e a pessoa decide.
  add column stage_id    uuid references public.plan_stages (id) on delete set null,
  add column weight      smallint not null default 1 check (weight between 1 and 10),
  -- Opcional soma progresso quando sai, mas não segura a conclusão da etapa:
  -- senão toda melhoria "se der tempo" viraria um bloqueio permanente.
  add column is_required boolean not null default true;

create index tasks_stage_idx on public.tasks (stage_id, sort_order)
  where stage_id is not null;

-- ---------------------------------------------------------------------------
-- Hábitos: a etapa que eles sustentam.
-- ---------------------------------------------------------------------------

alter table public.habits
  add column stage_id uuid references public.plan_stages (id) on delete set null;

create index habits_stage_idx on public.habits (stage_id) where stage_id is not null;

-- ---------------------------------------------------------------------------
-- Integridade: a etapa de uma ação precisa ser do objetivo dela.
--
-- Uma ação de leitura pendurada numa etapa de treino faz o progresso dos dois
-- objetivos mentir ao mesmo tempo. O domínio já recusa, e o trigger garante o
-- mesmo pra qualquer caminho que não passe pelo app.
-- ---------------------------------------------------------------------------

create or replace function public.assert_stage_matches_objective()
returns trigger
language plpgsql
as $$
declare
  stage_objective uuid;
begin
  if new.stage_id is null then
    return new;
  end if;

  select objective_id into stage_objective
    from public.plan_stages
   where id = new.stage_id;

  if stage_objective is null then
    raise exception 'A etapa informada não existe.';
  end if;

  if new.objective_id is null then
    new.objective_id := stage_objective;
    return new;
  end if;

  if new.objective_id <> stage_objective then
    raise exception 'Essa etapa é de outro objetivo.';
  end if;

  return new;
end;
$$;

create trigger tasks_stage_matches_objective
  before insert or update of stage_id, objective_id on public.tasks
  for each row execute function public.assert_stage_matches_objective();

create trigger habits_stage_matches_objective
  before insert or update of stage_id, objective_id on public.habits
  for each row execute function public.assert_stage_matches_objective();

-- ---------------------------------------------------------------------------
-- Integridade: ação concluída tem data de conclusão.
--
-- Sem o carimbo não dá pra medir velocidade, e sem velocidade não existe
-- previsão de conclusão. Preencher com `now()` em vez de recusar é deliberado:
-- é uma correção óbvia e segura, e recusar a escrita faria a pessoa perder o
-- clique de concluir por causa de um detalhe que o banco sabe resolver.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'feita' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status <> 'feita' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_stamp_completion
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completion();

-- Mesma regra pra etapa: concluída sem data quebraria a série do progresso.
create or replace function public.stamp_stage_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluida' and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status <> 'concluida' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger plan_stages_stamp_completion
  before insert or update of status on public.plan_stages
  for each row execute function public.stamp_stage_completion();
