import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) } else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const failures = await migrate(db, { stopOnError: true })
if (failures.length) { console.log(failures); process.exit(1) }

console.log('\n## 0072')
const [flags] = await q(`select value from public.product_settings where key = 'features'`)
check('Fundadores nasce desligado', flags.value.foundersOffer === false, JSON.stringify(flags.value))
check('os outros recursos continuam como estavam', flags.value.ai === true && flags.value.circle === true)

const [pub] = await q(`select public.public_settings() as s`)
check('a landing enxerga a chave pela public_settings', pub.s.features?.foundersOffer === false, JSON.stringify(pub.s.features))

const [{ id: uid }] = await q(`insert into auth.users (id, email) values (gen_random_uuid(), 'a@b.com') returning id`)
await q(`insert into public.profiles (id, name, handle) values ($1, 'A', 'aaa') on conflict do nothing`, [uid]).catch(() => null)
await q(`insert into public.subscriptions (user_id, provider, provider_subscription_id, interval, status, amount_cents, renewal_amount_cents, offer)
         values ($1, 'asaas', 'sub_1', 'mensal', 'ativa', 990, 2490, 'primeiro_mes')`, [uid])
const [row] = await q(`select offer, amount_cents, renewal_amount_cents from public.subscriptions where provider_subscription_id = 'sub_1'`)
check('grava oferta e valor de renovação', row.offer === 'primeiro_mes' && row.renewal_amount_cents === 2490)

let recusou = false
try {
  await q(`insert into public.subscriptions (user_id, provider, provider_subscription_id, interval, status, amount_cents, offer)
           values ($1, 'asaas', 'sub_2', 'mensal', 'ativa', 990, 'brinde')`, [uid])
} catch { recusou = true }
check('oferta desconhecida é recusada', recusou)

await q(`update public.product_settings set value = value || '{"foundersOffer": true}' where key = 'features'`)
await migrate(db, { from: '0072' })
const [again] = await q(`select value from public.product_settings where key = 'features'`)
check('re-executar não mexe numa campanha já ligada', again.value.foundersOffer === true, JSON.stringify(again.value))

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed ? 1 : 0)
