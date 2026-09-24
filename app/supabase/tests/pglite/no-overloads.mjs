/*
  Nenhuma função que o painel chama pode existir em duas assinaturas.

  Acrescentar um parâmetro a uma função não a substitui: `create or replace`
  cria uma segunda e deixa a antiga viva. Com duas candidatas, o PostgREST
  se recusa a escolher e a tela mostra um erro de conexão que não tem nada
  a ver com conexão. Foi o que derrubou a aba de erros depois da 0044.

  Este teste olha o banco depois de todas as migrations e falha se alguma
  função administrativa aparecer duplicada.
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
await migrate(db)

const { rows } = await db.query(`
  select p.proname,
         count(*) as versoes,
         string_agg(p.oid::regprocedure::text, ' | ' order by p.oid) as assinaturas
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'admin\\_%' or p.proname like 'quiz\\_%' or p.proname in ('report_error', 'sanitize_error_message'))
   group by p.proname
  having count(*) > 1
   order by p.proname`)

if (rows.length === 0) {
  console.log('  ok   nenhuma função administrativa duplicada')
  process.exit(0)
}

for (const row of rows) {
  console.log(`  FALHOU ${row.proname} tem ${row.versoes} assinaturas :: ${row.assinaturas}`)
}
console.log('\nDerrube a assinatura antiga com `drop function` na mesma migration que criou a nova.')
process.exit(1)
