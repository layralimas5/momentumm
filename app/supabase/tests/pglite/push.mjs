import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log('  ok   ' + name)
  } else {
    failed += 1
    console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : ''))
  }
}

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]
const asUser = (id, role = 'authenticated') =>
  db.exec(`select set_config('role', '${role}', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, role, aal: 'aal1' })}', false)`)
const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const expectError = async (fn, pattern) => {
  try {
    await fn()
    return { ok: false, detail: 'não deu erro' }
  } catch (e) {
    return { ok: pattern.test(e.message), detail: e.message.slice(0, 120) }
  }
}

const failures = await migrate(db, { stopOnError: true })
if (failures.length) { console.log(failures); process.exit(1) }

const ana = (await one(`insert into auth.users (email) values ('ana@x.com') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@x.com') returning id`)).id
await db.exec(`update public.profiles set name = 'Ana Souza' where id = '${ana}'`)

console.log('\n## presença')
await asUser(ana)
await db.exec(`select public.touch_my_presence('America/Sao_Paulo')`)
let pr = await one(`select timezone from public.user_presence where user_id = $1`, [ana])
check('touch_my_presence cria a linha com o fuso', pr && pr.timezone === 'America/Sao_Paulo', JSON.stringify(pr))
await db.exec(`select public.touch_my_presence('Fuso/Inventado')`)
pr = await one(`select timezone from public.user_presence where user_id = $1`, [ana])
check('fuso inválido cai no padrão sem erro', pr.timezone === 'America/Sao_Paulo', pr.timezone)
await db.exec(`select public.touch_my_presence('Europe/Lisbon')`)
pr = await one(`select timezone from public.user_presence where user_id = $1`, [ana])
check('fuso válido é gravado', pr.timezone === 'Europe/Lisbon', pr.timezone)
let r = await expectError(() => db.exec(`update public.user_presence set timezone = 'UTC' where user_id = '${ana}'`), /.*/)
const rows = await q(`select 1 from public.user_presence where user_id = $1 and timezone = 'UTC'`, [ana])
check('dono não escreve direto na presença', rows.length === 0)
await asUser(bia)
check('outra conta não lê a presença', (await q(`select 1 from public.user_presence where user_id = $1`, [ana])).length === 0)

console.log('\n## assinaturas')
await asUser(ana)
await db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('${ana}', 'https://push.example/ana', 'k', 'a')`)
r = await expectError(
  () => db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('${bia}', 'https://push.example/x', 'k', 'a')`),
  /row-level security|violates/i,
)
check('não cria assinatura em nome de outra conta', r.ok, r.detail)
r = await expectError(
  () => db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('${ana}', 'http://inseguro', 'k', 'a')`),
  /check/i,
)
check('endpoint precisa ser https', r.ok, r.detail)
await asUser(bia)
check('outra conta não lê a assinatura', (await q(`select 1 from public.push_subscriptions where user_id = $1`, [ana])).length === 0)
r = await expectError(() => db.exec(`select * from public.push_reminders_due(19)`), /permission denied|permissão/i)
check('push_reminders_due fechado pra authenticated', r.ok, r.detail)

console.log('\n## quem está na hora de avisar')
await asPostgres()
const hourNow = (await one(`select extract(hour from (now() at time zone 'Europe/Lisbon'))::int as h`)).h
// Ana está em Lisboa, abriu o app hoje: nada
let due = await q(`select * from public.push_reminders_due($1)`, [hourNow])
check('quem abriu hoje não recebe', due.length === 0, JSON.stringify(due))
await db.exec(`update public.user_presence set last_active_at = now() - interval '1 day' where user_id = '${ana}'`)
due = await q(`select * from public.push_reminders_due($1)`, [hourNow])
check('quem não abriu hoje entra na lista, na hora do próprio fuso', due.length === 1 && due[0].first_name === 'Ana' && due[0].days_away === 1, JSON.stringify(due))
const subscriptionId = due[0]?.subscription_id
due = await q(`select * from public.push_reminders_due($1)`, [(hourNow + 3) % 24])
check('fora da hora do fuso não entra', due.length === 0)
await db.exec(`select public.mark_push_reminded('${subscriptionId}')`)
const marked = await one(`select last_reminded_on::text as d, (now() at time zone 'Europe/Lisbon')::date::text as today from public.push_subscriptions where user_id = $1`, [ana])
check('mark_push_reminded grava a data no fuso da pessoa', marked.d === marked.today, JSON.stringify(marked))
due = await q(`select * from public.push_reminders_due($1)`, [hourNow])
check('já lembrado hoje não repete', due.length === 0)
await asUser(bia)
r = await expectError(() => db.exec(`select public.mark_push_reminded('${subscriptionId}')`), /permission denied|permissão/i)
check('mark_push_reminded fechado pra authenticated', r.ok, r.detail)
await asPostgres()
await db.exec(`update public.push_subscriptions set last_reminded_on = null, failed_at = now() where user_id = '${ana}'`)
due = await q(`select * from public.push_reminders_due($1)`, [hourNow])
check('assinatura marcada como falha fica de fora', due.length === 0)
await db.exec(`update public.push_subscriptions set failed_at = null where user_id = '${ana}'`)
await db.exec(`update public.user_presence set last_active_at = now() - interval '5 days' where user_id = '${ana}'`)
due = await q(`select * from public.push_reminders_due($1)`, [hourNow])
check('dias fora contam certo', due.length === 1 && due[0].days_away === 5, JSON.stringify(due))
await db.exec(`delete from auth.users where id = '${ana}'`)
check('apagar a conta apaga presença e assinatura', (await q(`select 1 from public.push_subscriptions`)).length === 0 && (await q(`select 1 from public.user_presence`)).length === 0)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed ? 1 : 0)
