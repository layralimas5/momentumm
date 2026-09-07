-- Momentumm — o que o banco tem hoje.
--
-- Roda sem alterar nada. Serve pra conferir, antes ou depois do setup, se o
-- schema está completo — e pra saber onde parou quando alguma coisa falha no
-- meio.

select
  item,
  case when presente then 'ok' else 'FALTA' end as estado
from (
  -- Tabelas
  select 'tabela: ' || t.nome as item,
         to_regclass('public.' || t.nome) is not null as presente,
         1 as grupo, t.nome as ord
  from (values
    ('profiles'), ('follows'), ('activity_types'), ('activities'), ('goals'),
    ('check_ins'), ('habits'), ('habit_logs'), ('tasks'), ('wins'),
    ('objectives'), ('weekly_reviews'), ('plan_stages')
  ) as t(nome)

  union all

  -- Colunas do V1: é o que separa um banco na 0004 de um banco na 0005.
  select 'coluna: ' || c.tabela || '.' || c.coluna,
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public'
             and table_name = c.tabela
             and column_name = c.coluna
         ),
         2, c.tabela || '.' || c.coluna
  from (values
    ('objectives', 'priority'), ('objectives', 'paused_at'), ('objectives', 'description'),
    ('habits', 'objective_id'), ('habits', 'frequency'), ('habits', 'times_per_week'),
    ('habits', 'paused_at'), ('habits', 'time_of_day'),
    ('tasks', 'objective_id'), ('tasks', 'sort_order'), ('tasks', 'depends_on_id'),
    ('tasks', 'priority'), ('tasks', 'time_of_day'),
    ('activity_types', 'user_id'), ('profiles', 'plan'),
    -- A hierarquia (0007): é o que separa um banco na 0006 de um na 0007.
    ('tasks', 'stage_id'), ('tasks', 'weight'), ('tasks', 'is_required'),
    ('habits', 'stage_id')
  ) as c(tabela, coluna)

  union all

  -- Estados novos da ação: o PASSO 1 do setup.
  select 'enum task_status: ' || v.valor,
         exists (
           select 1 from pg_enum e
           join pg_type t on t.oid = e.enumtypid
           where t.typname = 'task_status' and e.enumlabel = v.valor
         ),
         3, v.valor
  from (values ('em-andamento'), ('cancelada')) as v(valor)

  union all

  -- Os triggers. O primeiro cria o perfil junto com a conta — sem ele todo
  -- cadastro novo entra sem perfil e o app quebra no primeiro carregamento.
  -- Os outros guardam a integridade da hierarquia: etapa de outro objetivo é
  -- recusada, e conclusão sem data é carimbada.
  select 'trigger: ' || g.nome,
         exists (select 1 from pg_trigger where tgname = g.nome),
         4, g.nome
  from (values
    ('on_auth_user_created'),
    ('tasks_stage_matches_objective'),
    ('habits_stage_matches_objective'),
    ('tasks_stamp_completion'),
    ('plan_stages_stamp_completion')
  ) as g(nome)

  union all

  -- A policy que vazava as áreas criadas. Aqui "ok" significa REMOVIDA.
  select 'policy removida: catálogo de eixos é público',
         not exists (
           select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'activity_types'
             and policyname = 'catálogo de eixos é público'
         ),
         5, ''

  union all

  -- RLS ligada em tudo que guarda dado de pessoa.
  select 'RLS ligada: ' || r.nome,
         coalesce((
           select c.relrowsecurity from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname = r.nome
         ), false),
         6, r.nome
  from (values
    ('profiles'), ('activities'), ('goals'), ('check_ins'), ('habits'),
    ('habit_logs'), ('tasks'), ('wins'), ('objectives'), ('weekly_reviews'),
    ('activity_types'), ('plan_stages')
  ) as r(nome)

  union all

  -- Os quatro eixos de fábrica precisam existir: hábito, meta e objetivo
  -- apontam pra eles por chave estrangeira. A contagem passa por `to_jsonb`
  -- porque a coluna `user_id` pode ainda não existir, e uma referência direta
  -- a ela quebraria o diagnóstico justamente no banco que ele precisa medir.
  select 'eixos de fábrica (4)',
         coalesce((
           select count(*) >= 4 from public.activity_types
           where to_jsonb(activity_types) ->> 'user_id' is null
         ), false),
         7, ''
) as checagem
order by grupo, ord;
