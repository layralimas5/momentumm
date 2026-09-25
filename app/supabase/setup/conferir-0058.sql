-- Momentumm — a 0058 subiu inteira?
--
-- A 0058 reescreve `open_support_request` com um `create or replace`. O jeito
-- ruim de isso dar errado não aparece como erro na tela: se o corpo novo não
-- entrou, a função continua existindo e continua funcionando — só que sem a
-- checagem de plano, e o gratuito segue abrindo "ajuda com o app" como antes.
--
-- O jeito ruim ao contrário também existe e é pior: uma versão que recuse
-- categoria demais deixaria quem está no gratuito sem caminho pra apagar a
-- conta ou exportar os dados. Por isso a consulta confere as duas pontas — que
-- a trava existe, e que ela é de UMA categoria só.
--
-- Rodar no SQL Editor do painel. É UMA consulta, só leitura, e o resultado cabe
-- numa linha.

select
  case
    when f.existe = 0                  then 'FALTANDO: open_support_request não existe'
    when f.checa_plano = 0             then 'INCOMPLETA: a função subiu sem a checagem de plano'
    when f.trava_categorias <> 1       then 'PERIGO: a trava não é de uma categoria só — confere o corpo'
    when f.definer = 0                 then 'PERIGO: a função deixou de ser security definer'
    when f.search_path = 0             then 'PERIGO: a função está sem search_path fixo'
    when g.autenticado = 0             then 'QUEBRADA: authenticated não consegue mais abrir chamado'
    when g.anonimo > 0                 then 'PERIGO: o anônimo pode abrir chamado'
    when c.categorias <> 8             then 'ATENÇÃO: o enum de categorias mudou'
    else 'OK — a 0058 está inteira'
  end as veredito,
  f.checa_plano       as tem_checagem_de_plano,
  f.trava_categorias  as categorias_travadas,
  f.definer           as security_definer,
  f.search_path       as search_path_fixo,
  g.autenticado       as authenticated_executa,
  g.anonimo           as anon_executa,
  c.categorias        as categorias_no_enum
from
  (select
     count(*)                                                                   as existe,
     count(*) filter (where p.prosrc like '%plan_for_user%')                    as checa_plano,
     /* A trava nomeia a categoria: uma ocorrência é "só suporte". */
     count(*) filter (where p.prosrc like '%p_category = ''suporte''%')         as trava_categorias,
     count(*) filter (where p.prosecdef)                                        as definer,
     count(*) filter (where exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
     ))                                                                         as search_path
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'open_support_request') f,
  (select
     count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute')) as autenticado,
     count(*) filter (where has_function_privilege('anon', p.oid, 'execute'))          as anonimo
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'open_support_request') g,
  (select count(*) as categorias
     from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'support_category') c;
