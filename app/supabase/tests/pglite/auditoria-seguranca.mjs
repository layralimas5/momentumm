/*
  Auditoria de privilégio no banco.

  Três perguntas que precisam ter a mesma resposta pra sempre:
  toda função do painel checa papel? toda `security definer` fixa o
  `search_path`? alguma função aberta pro anônimo devolve dado pessoal?

  Não é um teste de comportamento: é uma varredura no catálogo, do tipo
  que pega o buraco que ninguém escreveu de propósito.
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
await migrate(db)

const q = async (sql) => (await db.query(sql)).rows
let achados = 0
const secao = (titulo) => console.log(`\n== ${titulo}`)
const linha = (texto) => { achados += 1; console.log('  ! ' + texto) }
const limpo = (texto) => console.log('  ok ' + texto)

// 1. Função do painel sem checagem de papel ---------------------------------
secao('funcoes admin_* sem assert_admin_role/step_up no corpo')
const semChecagem = await q(`
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'admin\\_%'
     and p.prosrc not like '%assert_admin%'
     -- Só o que alguém consegue CHAMAR importa. Auxiliar revogada de
     -- authenticated e anon só roda de dentro de outra função, que já checou.
     and (has_function_privilege('authenticated', p.oid, 'execute')
          or has_function_privilege('anon', p.oid, 'execute'))
     -- admin_me responde sobre a propria sessao de quem pergunta, e so.
     and p.proname not in ('admin_me', 'admin_mfa_required', 'admin_session_max_age',
                           'admin_step_up_max_age', 'admin_session_valid', 'admin_step_up_valid',
                           'admin_mfa_verified_at', 'admin_role')
   order by 1`)
if (semChecagem.length === 0) limpo('toda função do painel checa papel')
for (const row of semChecagem) linha(`${row.proname} não chama assert_admin_*`)

// 2. security definer sem search_path fixo ----------------------------------
secao('security definer sem search_path fixo')
const semSearchPath = await q(`
  select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
   order by 1`)
if (semSearchPath.length === 0) limpo('toda security definer fixa o search_path')
for (const row of semSearchPath) linha(`${row.proname} é security definer sem search_path`)

// 3. O que o anônimo pode executar ------------------------------------------
secao('funcoes executaveis pelo anonimo')
const paraAnon = await q(`
  select p.proname, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'execute')
   order by 1`)
console.log(`  ${paraAnon.length} função(ões): ${paraAnon.map((r) => r.proname).join(', ')}`)

// 4. Tabela com dado de gente sem RLS ---------------------------------------
secao('tabelas sem RLS')
const semRls = await q(`
  select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
   order by 1`)
if (semRls.length === 0) limpo('toda tabela do schema public tem RLS ligado')
for (const row of semRls) linha(`${row.relname} sem RLS`)

// 5. Política que deixa o anônimo ler -------------------------------------
secao('politicas abertas para anon/public')
const abertas = await q(`
  select tablename, policyname, cmd, coalesce(array_to_string(roles, ','), '') as papeis
    from pg_policies
   where schemaname = 'public'
     and (roles::text[] && array['anon', 'public'])
   order by tablename, policyname`)
if (abertas.length === 0) limpo('nenhuma política aberta pro anônimo')
for (const row of abertas) console.log(`  . ${row.tablename}.${row.policyname} (${row.cmd}, ${row.papeis})`)

// 6. Tabela com RLS e nenhuma política (só service_role entra) --------------
secao('tabelas com RLS e zero politicas')
const mudas = await q(`
  select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies pol where pol.schemaname = 'public' and pol.tablename = c.relname)
   order by 1`)
console.log(`  ${mudas.length}: ${mudas.map((r) => r.relname).join(', ') || 'nenhuma'}`)

console.log(`\n${achados} ponto(s) para olhar.`)
process.exit(0)
