-- Momentumm — a 0057 subiu inteira?
--
-- A 0057 é a única migration até aqui que DERRUBA uma regra de dados: o índice
-- único `objectives_one_active_per_axis`, que existia desde a 0003. Aplicar
-- pela metade tem dois jeitos ruins de dar errado, e nenhum deles aparece como
-- erro na tela do SQL Editor:
--
--   índice caiu, trigger não subiu  → o Free perde o limite e ninguém percebe
--   trigger subiu, índice ficou     → o PRO continua travado, como antes
--
-- Rodar no SQL Editor do painel. É UMA consulta, só leitura, e o resultado cabe
-- numa linha: `veredito` diz se está tudo no lugar, e as outras colunas dizem o
-- que faltou quando não está.

select
  case
    when i.unico > 0                       then 'INCOMPLETA: o índice único de 0003 ainda existe'
    when t.guarda = 0                      then 'PERIGO: o índice caiu e a guarda não subiu — o Free está sem limite'
    when t.desarquivar = 0                 then 'INCOMPLETA: falta o gatilho de desarquivar'
    when f.funcoes < 4                     then 'INCOMPLETA: faltam funções de contagem/teto'
    when c.free_por_area is distinct from 1 then 'INCOMPLETA: plans.free.objectivesPerAxis não é 1'
    when not c.pro_tem_chave               then 'INCOMPLETA: plans.pro não tem objectivesPerAxis'
    when c.pro_por_area is not null        then 'INCOMPLETA: plans.pro.objectivesPerAxis devia ser nulo'
    when c.free_ativos is distinct from 2  then 'ATENÇÃO: o teto de objetivos do Free deixou de ser 2'
    else 'OK — a 0057 está inteira'
  end as veredito,
  i.unico          as indice_unico_ainda_existe,
  i.leitura        as indice_de_leitura,
  t.guarda         as trigger_insert,
  t.desarquivar    as trigger_update,
  f.funcoes        as funcoes_de_4,
  c.free_por_area  as free_objetivos_por_area,
  c.free_ativos    as free_objetivos_ativos,
  c.pro_tem_chave  as pro_tem_a_chave,
  c.pro_por_area   as pro_objetivos_por_area
from
  (select
     count(*) filter (where indexname = 'objectives_one_active_per_axis')  as unico,
     count(*) filter (where indexname = 'objectives_active_user_axis_idx') as leitura
     from pg_indexes where schemaname = 'public') i,
  (select
     count(*) filter (where tgname = 'objectives_plan_room')           as guarda,
     count(*) filter (where tgname = 'objectives_plan_room_unarchive') as desarquivar
     from pg_trigger where tgrelid = 'public.objectives'::regclass) t,
  (select count(*) as funcoes
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('objective_axis_count_for', 'objective_count_for',
                        'objective_axis_limit_for', 'objective_limit_for')) f,
  (select
     (select (value ->> 'objectivesPerAxis')::int from public.product_settings where key = 'plans.free') as free_por_area,
     (select (value ->> 'activeObjectives')::int  from public.product_settings where key = 'plans.free') as free_ativos,
     (select value ? 'objectivesPerAxis'          from public.product_settings where key = 'plans.pro')  as pro_tem_chave,
     (select (value ->> 'objectivesPerAxis')::int from public.product_settings where key = 'plans.pro')  as pro_por_area
  ) c;
