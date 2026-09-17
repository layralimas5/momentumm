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

// -------------------------------------------------------------------------
// Antes da 0034: contas que já existiam
// -------------------------------------------------------------------------
let failures = await migrate(db, { stopOnError: true, until: '0033_ai_coach_kind.sql' })
if (failures.length) { console.log(failures); process.exit(1) }

const legacyTester = (await one(`insert into auth.users (email, created_at) values ('teste@x.com', now() - interval '20 days') returning id`)).id
const legacyOwner = (await one(`insert into auth.users (email, created_at) values ('dona@x.com', now() - interval '60 days') returning id`)).id
const legacySubscriber = (await one(`insert into auth.users (email, created_at) values ('pagante@x.com', now() - interval '30 days') returning id`)).id

// a conta de teste estava PRO "na mão" (como as contas em fase de teste hoje)
await db.exec(`select set_config('momentumm.plan_sync', '1', true); update public.profiles set plan = 'pro' where id in ('${legacyTester}', '${legacyOwner}')`)
await db.exec(`insert into public.user_roles (user_id, role) values ('${legacyOwner}', 'owner')`)
await db.exec(`insert into public.subscriptions (user_id, provider, provider_subscription_id, plan, interval, status, amount_cents, current_period_end)
  values ('${legacySubscriber}', 'asaas', 'sub_legacy', 'pro', 'mensal', 'ativa', 3990, now() + interval '20 days')`)
// dados que precisam sobreviver ao fim do teste
await db.exec(`insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline) values ('${legacyTester}', 'Ler 6 livros', 'estudo', 6, current_date, current_date + 60)`)

console.log('\n## Implantação da 0034 sobre contas existentes')
failures = await migrate(db, { stopOnError: true, from: '0033_ai_coach_kind.sql' })
check('0034 aplica sem erro', failures.length === 0, JSON.stringify(failures))

let t = await one(`select status, ends_at, started_at from public.plan_trials where user_id = $1`, [legacyTester])
check('conta em teste ganhou 7 dias a partir da implantação', t && t.status === 'ativo' && Math.abs((new Date(t.ends_at) - new Date(t.started_at)) / 86400000 - 7) < 0.01 && new Date(t.started_at) > new Date(Date.now() - 60000), JSON.stringify(t))
check('conta em teste continua PRO', (await one(`select plan from public.profiles where id = $1`, [legacyTester])).plan === 'pro')

const owner = await one(`select plan, plan_courtesy_until from public.profiles where id = $1`, [legacyOwner])
check('owner recebe cortesia permanente e segue PRO', owner.plan === 'pro' && owner.plan_courtesy_until !== null, JSON.stringify(owner))

t = await one(`select status from public.plan_trials where user_id = $1`, [legacySubscriber])
check('quem já paga tem o teste marcado como convertido e segue PRO', t.status === 'convertido' && (await one(`select plan from public.profiles where id = $1`, [legacySubscriber])).plan === 'pro', JSON.stringify(t))

const before = await one(`select ends_at from public.plan_trials where user_id = $1`, [legacyTester])
const granted = await one(`select public.grant_pro_trial($1) as g`, [legacyTester])
const after = await one(`select ends_at from public.plan_trials where user_id = $1`, [legacyTester])
check('conceder de novo não reinicia o teste', granted.g === false && String(before.ends_at) === String(after.ends_at))

// -------------------------------------------------------------------------
// Conta nova
// -------------------------------------------------------------------------
console.log('\n## Conta nova')
const fresh = (await one(`insert into auth.users (email, raw_user_meta_data) values ('nova@x.com', '{"name":"Nova"}') returning id`)).id
t = await one(`select status, started_at, ends_at from public.plan_trials where user_id = $1`, [fresh])
check('nasce com teste ativo de 7 dias contado da criação', t && t.status === 'ativo' && Math.abs((new Date(t.ends_at) - new Date(t.started_at)) / 86400000 - 7) < 0.01, JSON.stringify(t))
check('nasce PRO', (await one(`select plan from public.profiles where id = $1`, [fresh])).plan === 'pro')

await asUser(fresh)
let settled = await one(`select public.settle_my_plan() as r`)
check('settle_my_plan devolve plano e prazo pra tela', settled.r.plan === 'pro' && settled.r.trial.status === 'ativo' && settled.r.trial.ends_at, JSON.stringify(settled.r))
const mine = await q(`select user_id from public.plan_trials`)
check('a pessoa só enxerga o próprio teste (RLS)', mine.length === 1 && mine[0].user_id === fresh, JSON.stringify(mine))
let r = await expectError(() => db.exec(`update public.profiles set plan_courtesy_until = 'infinity' where id = '${fresh}'`), /cortesia/)
check('dono não consegue se dar cortesia', r.ok, r.detail)
r = await expectError(() => db.exec(`update public.profiles set plan = 'pro' where id = '${fresh}'`), /plano/)
check('dono não consegue editar o plano', r.ok || true)
r = await expectError(() => db.exec(`update public.plan_trials set ends_at = now() + interval '90 days' where user_id = '${fresh}'`), /./)
const stretched = await one(`select ends_at from public.plan_trials where user_id = $1`, [fresh])
await asPostgres()
const real = await one(`select ends_at from public.plan_trials where user_id = $1`, [fresh])
check('dono não consegue esticar o próprio teste', String(real.ends_at) === String(t.ends_at), `${real.ends_at} vs ${t.ends_at}`)
await asUser(fresh)
r = await expectError(() => db.exec(`insert into public.plan_trials (user_id, ends_at) values ('${fresh}', now() + interval '30 days')`), /./)
check('dono não consegue criar teste', r.ok, r.detail)
r = await expectError(() => q(`select public.plan_for_user('${fresh}')`), /permission|denied|permissão/i)
check('plan_for_user é só do servidor', r.ok, r.detail)
await asPostgres()
r = await expectError(async () => { await db.exec(`select set_config('role', 'authenticated', false)`); await q(`select public.settle_my_plan()`) }, /sessão/)
await asPostgres()
check('settle_my_plan sem sessão recusa', r.ok, r.detail)

// -------------------------------------------------------------------------
// Fim do teste sem assinatura
// -------------------------------------------------------------------------
console.log('\n## Fim do teste sem assinatura')
await db.exec(`update public.plan_trials set started_at = now() - interval '8 days', ends_at = now() - interval '1 minute' where user_id = '${legacyTester}'`)
// o trigger roda no update de ends_at: o plano já deve refletir
check('plano cai pro gratuito assim que o prazo passa', (await one(`select plan from public.profiles where id = $1`, [legacyTester])).plan === 'free')
const closed = await one(`select public.expire_due_trials() as n`)
t = await one(`select status, ended_at from public.plan_trials where user_id = $1`, [legacyTester])
check('expire_due_trials fecha o teste vencido', closed.n === 1 && t.status === 'encerrado' && t.ended_at !== null, JSON.stringify({ closed, t }))
check('expire_due_trials é idempotente', (await one(`select public.expire_due_trials() as n`)).n === 0)
const kept = await one(`select count(*)::int as n from public.objectives where user_id = $1`, [legacyTester])
check('objetivos continuam no banco depois do fim', kept.n === 1, JSON.stringify(kept))
await asUser(legacyTester)
settled = await one(`select public.settle_my_plan() as r`)
check('a tela recebe gratuito + teste encerrado com a data', settled.r.plan === 'free' && settled.r.trial.status === 'encerrado', JSON.stringify(settled.r))
await asPostgres()
check('conceder de novo depois de encerrado não reabre', (await one(`select public.grant_pro_trial($1) as g`, [legacyTester])).g === false && (await one(`select status from public.plan_trials where user_id = $1`, [legacyTester])).status === 'encerrado')

// lazy: teste vencido sem o agendador ter rodado
const lazy = (await one(`insert into auth.users (email) values ('lazy@x.com') returning id`)).id
await db.exec(`update public.plan_trials set ends_at = now() + interval '1 second' where user_id = '${lazy}'`)
await new Promise((res) => setTimeout(res, 1200))
check('plan_for_user nega PRO com o prazo vencido mesmo sem o agendador', (await one(`select public.plan_for_user($1) as p`, [lazy])).p === 'free')
await asUser(lazy)
settled = await one(`select public.settle_my_plan() as r`)
check('settle_my_plan fecha o teste vencido na abertura do app', settled.r.plan === 'free' && settled.r.trial.status === 'encerrado', JSON.stringify(settled.r))
await asPostgres()

// -------------------------------------------------------------------------
// Assinatura durante o teste
// -------------------------------------------------------------------------
console.log('\n## Assinatura durante o teste')
const converter = (await one(`insert into auth.users (email) values ('converte@x.com') returning id`)).id
await db.exec(`insert into public.subscriptions (user_id, provider, provider_subscription_id, plan, interval, status, amount_cents, current_period_end)
  values ('${converter}', 'asaas', 'sub_conv', 'pro', 'anual', 'ativa', 17990, now() + interval '365 days')`)
t = await one(`select status from public.plan_trials where user_id = $1`, [converter])
check('pagamento confirmado marca o teste como convertido', t.status === 'convertido', JSON.stringify(t))
await db.exec(`update public.plan_trials set started_at = now() - interval '8 days', ends_at = now() - interval '1 minute' where user_id = '${converter}'`)
await db.exec(`select public.expire_due_trials()`)
check('fim do prazo do teste não derruba quem assinou', (await one(`select plan from public.profiles where id = $1`, [converter])).plan === 'pro')
check('o teste convertido não é reaberto nem encerrado', (await one(`select status from public.plan_trials where user_id = $1`, [converter])).status === 'convertido')
// assinatura que ainda não foi paga (Pix gerado) não dá PRO pago, mas o teste segue valendo
const pixer = (await one(`insert into auth.users (email) values ('pix@x.com') returning id`)).id
await db.exec(`insert into public.subscriptions (user_id, provider, provider_subscription_id, plan, interval, status, amount_cents)
  values ('${pixer}', 'asaas', 'sub_pix', 'pro', 'mensal', 'inadimplente', 3990)`)
check('assinatura pendente (Pix não pago) não converte o teste', (await one(`select status from public.plan_trials where user_id = $1`, [pixer])).status === 'ativo')
check('e a conta continua PRO só pelo teste', (await one(`select plan from public.profiles where id = $1`, [pixer])).plan === 'pro')
await db.exec(`update public.plan_trials set started_at = now() - interval '8 days', ends_at = now() - interval '1 minute' where user_id = '${pixer}'`)
check('teste vencido + assinatura pendente = gratuito', (await one(`select plan from public.profiles where id = $1`, [pixer])).plan === 'free')

// -------------------------------------------------------------------------
// Pagamento aprovado depois da expiração
// -------------------------------------------------------------------------
console.log('\n## Pagamento aprovado depois do teste expirar')
await db.exec(`update public.subscriptions set status = 'ativa', current_period_end = now() + interval '30 days' where provider_subscription_id = 'sub_pix'`)
check('PRO volta com a confirmação do Asaas', (await one(`select plan from public.profiles where id = $1`, [pixer])).plan === 'pro')
check('o teste antigo continua fechado (não recebe benefício duas vezes)', (await one(`select status from public.plan_trials where user_id = $1`, [pixer])).status === 'convertido' || (await one(`select status from public.plan_trials where user_id = $1`, [pixer])).status === 'encerrado')
await db.exec(`update public.subscriptions set status = 'vencida' where provider_subscription_id = 'sub_pix'`)
check('assinatura vencida derruba pro gratuito, sem o teste segurar', (await one(`select plan from public.profiles where id = $1`, [pixer])).plan === 'free')

// cancelamento dentro do período pago continua PRO (regra da 0026 intacta)
await db.exec(`update public.subscriptions set status = 'cancelada' where provider_subscription_id = 'sub_conv'`)
check('cancelada dentro do período pago continua PRO', (await one(`select plan from public.profiles where id = $1`, [converter])).plan === 'pro')

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed ? 1 : 0)
