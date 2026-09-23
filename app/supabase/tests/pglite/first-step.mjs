import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const failures = await migrate(db, { stopOnError: true })
if (failures.length) { console.log(failures); process.exit(1) }

console.log('\n## Primeiro Passo')
const ana = (await one(`insert into auth.users (email) values ('ana@x.com') returning id`)).id
check('regra existe com 10 pontos', (await one(`select points from public.achievement_rules where key = 'primeiro_passo'`))?.points === 10)
check('conta nova não tem a conquista', (await q(`select 1 from public.user_achievements where user_id = $1`, [ana])).length === 0)

const taskId = (await one(`insert into public.tasks (user_id, title, day, is_main_priority) values ($1, 'Ler 10 páginas', current_date, true) returning id`, [ana])).id
check('ação pendente não concede', (await q(`select 1 from public.user_achievements where user_id = $1 and key = 'primeiro_passo'`, [ana])).length === 0)

await db.exec(`update public.tasks set status = 'feita' where id = '${taskId}'`)
check('primeira ação feita concede Primeiro Passo', (await q(`select 1 from public.user_achievements where user_id = $1 and key = 'primeiro_passo'`, [ana])).length === 1)
const xp = await one(`select coalesce(sum(points), 0)::int as total from public.xp_transactions where user_id = $1 and kind = 'achievement' and ref_id = 'primeiro_passo'`, [ana]).catch(() => null)
check('conquista trouxe os 10 XP', xp === null || xp.total === 10, JSON.stringify(xp))

const second = (await one(`insert into public.tasks (user_id, title, day) values ($1, 'Outra ação', current_date) returning id`, [ana])).id
await db.exec(`update public.tasks set status = 'feita' where id = '${second}'`)
check('não concede duas vezes', (await q(`select 1 from public.user_achievements where user_id = $1 and key = 'primeiro_passo'`, [ana])).length === 1)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed ? 1 : 0)
