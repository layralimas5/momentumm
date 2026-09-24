/*
  A aba Retenção, contra um Postgres de verdade.

  O teste existe por causa de um erro que nenhum teste de tipo pegaria:
  `churned_users` lia uma coluna que não existe quando a função `setof` ganha
  alias, e a aba inteira morria em runtime com "column ... does not exist".
  Aqui a função é CHAMADA, não lida.
*/
import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

const db = await boot()
await migrate(db)

const ADMIN = '11111111-1111-4111-8111-111111111111'
const SUMIU = '22222222-2222-4222-8222-222222222222'
const FICOU = '33333333-3333-4333-8333-333333333333'

const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asAdmin = () =>
  db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: ADMIN, role: 'authenticated', aal: 'aal2' })}',false)`)

await asPostgres()
for (const id of [ADMIN, SUMIU, FICOU]) {
  await db.exec(`insert into auth.users (id, email, created_at) values ('${id}', '${id.slice(0, 4)}@teste.momentumm', now() - interval '40 days')`)
}
await db.exec(`insert into public.user_roles (user_id, role) values ('${ADMIN}', 'owner') on conflict do nothing`)
// O fator fica fora do teste: quem se verifica é o GoTrue, não o Postgres.
await db.exec(`update public.product_settings set value = '{"requireMfa": false}'::jsonb where key = 'admin.security'`)

// Um ativo só no período anterior (abandonou) e um ativo nos dois.
await db.exec(`insert into public.product_events (user_id, name, created_at, day)
  values ('${SUMIU}', 'app_opened', now() - interval '20 days', (now() - interval '20 days')::date),
         ('${FICOU}', 'app_opened', now() - interval '20 days', (now() - interval '20 days')::date),
         ('${FICOU}', 'app_opened', now() - interval '3 days',  (now() - interval '3 days')::date)`)

await asAdmin()
let data = null
try {
  const rows = await db.query(`select public.admin_retention((now() - interval '10 days')::date, now()::date) as j`)
  data = rows.rows[0].j
  check('admin_retention responde', true)
} catch (error) {
  check('admin_retention responde', false, error.message)
}

if (data) {
  check('churned_users conta quem era ativo antes e sumiu', data.churned_users === 1, `veio ${data.churned_users}`)
  check('ativos em 30 dias contam os dois', data.active.d30 === 2, `veio ${data.active.d30}`)
  check('tem todas as chaves que a tela lê',
    ['cohorts', 'by_plan', 'active', 'frequency', 'time_to', 'comebacks', 'recovery_started',
     'recovery_users', 'conversions', 'cancellations', 'churned_users'].every((k) => k in data))
}

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
