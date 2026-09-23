/*
  Faturamento e as duas exclusões do painel, contra um Postgres de verdade.

  O que importa aqui é o que o dinheiro NÃO conta: trial fora do MRR,
  reembolso descontado do líquido. E que apagar um contato do quiz não
  apague a sessão, senão o funil do mês passado muda sozinho.
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

const OWNER = '11111111-1111-4111-8111-111111111111'
const PAGANTE = '22222222-2222-4222-8222-222222222222'
const TESTANDO = '33333333-3333-4333-8333-333333333333'

const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asOwner = () =>
  db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: OWNER, role: 'authenticated', aal: 'aal2' })}',false)`)
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

await asPostgres()
for (const id of [OWNER, PAGANTE, TESTANDO]) {
  await db.exec(`insert into auth.users (id, email, created_at) values ('${id}', '${id.slice(0, 4)}@teste.momentumm', now() - interval '40 days')`)
}
await db.exec(`insert into public.user_roles (user_id, role) values ('${OWNER}', 'owner') on conflict do nothing`)
await db.exec(`update public.product_settings set value = '{"requireMfa": false}'::jsonb where key = 'admin.security'`)

// Um PRO mensal ativo pagando 39,90 e um em trial do anual.
await db.exec(`insert into public.subscriptions (user_id, provider, provider_subscription_id, plan, interval, status, amount_cents)
  values ('${PAGANTE}', 'asaas', 'sub_1', 'pro', 'mensal', 'ativa', 3990),
         ('${TESTANDO}', 'asaas', 'sub_2', 'pro', 'anual', 'trial', 12990)`)

const sub = await one(`select id from public.subscriptions where provider_subscription_id = 'sub_1'`)
await db.exec(`insert into public.subscription_events (subscription_id, user_id, type, amount_cents, occurred_at)
  values ('${sub.id}', '${PAGANTE}', 'criada', 3990, now() - interval '5 days'),
         ('${sub.id}', '${PAGANTE}', 'renovada', 3990, now() - interval '2 days'),
         ('${sub.id}', '${PAGANTE}', 'reembolso', 3990, now() - interval '1 day')`)

await asOwner()

// --- faturamento -----------------------------------------------------------
const receita = (await one(`select public.admin_revenue((now() - interval '10 days')::date, now()::date) as j`)).j
check('bruto soma os pagamentos do período', receita.gross_cents === 7980, `veio ${receita.gross_cents}`)
check('reembolso sai do líquido', receita.net_cents === 3990, `veio ${receita.net_cents}`)
check('MRR conta só a assinatura ativa', receita.mrr_cents === 3990, `veio ${receita.mrr_cents}`)
check('trial fica fora do MRR e aparece à parte', receita.trials_active === 1, `veio ${receita.trials_active}`)
check('ticket médio é o valor do plano', receita.ticket_cents === 3990, `veio ${receita.ticket_cents}`)

// --- contato do quiz -------------------------------------------------------
await asPostgres()
const sessao = '44444444-4444-4444-8444-444444444444'
await db.exec(`insert into public.quiz_sessions (id, status, current_step, lead_name, lead_email, lead_phone, lead_consent_at)
  values ('${sessao}', 'concluido', 5, 'Fulana', 'fulana@teste.momentumm', '11912345678', now())`)
await asOwner()

await db.query(`select public.admin_delete_quiz_lead('${sessao}', 'pediu pra sair da lista')`)
// A leitura da tabela é do dono da sessão; o painel nunca lê direto. Aqui o
// teste olha por fora da RLS pra provar o que sobrou na linha.
await asPostgres()
const depois = await one(`select lead_email, lead_name, lead_phone, status from public.quiz_sessions where id = '${sessao}'`)
await asOwner()
check('o contato some', depois.lead_email === null && depois.lead_name === null && depois.lead_phone === null)
check('a sessão continua contando no funil', depois.status === 'concluido')

const some = await one(`select (public.admin_quiz_leads((now() - interval '1 day')::date, now()::date) -> 'total')::int as total`)
check('e some da lista de contatos', some.total === 0, `veio ${some.total}`)

// --- exclusão imediata de conta --------------------------------------------
const proibido = async (fn, trecho) => {
  try { await fn(); return { ok: false, detail: 'não deu erro' } }
  catch (e) { return { ok: e.message.includes(trecho), detail: e.message.slice(0, 100) } }
}

let r = await proibido(() => db.query(`select public.admin_force_deletion('${OWNER}', 'teste')`), 'própria conta')
check('não deixa a owner excluir a si mesma', r.ok, r.detail)

r = await proibido(() => db.query(`select public.admin_force_deletion('${PAGANTE}', '')`), 'motivo')
check('exige motivo', r.ok, r.detail)

await db.query(`select public.admin_force_deletion('${PAGANTE}', 'conta de teste minha')`)
// `deletion_ready` é da Edge Function (service_role), não do painel.
await asPostgres()
const pronta = await one(`select public.deletion_ready('${PAGANTE}') as ready`)
check('a conta fica pronta pra apagar na hora', pronta.ready === true)

const banida = await one(`select banned_until is not null as banida from auth.users where id = '${PAGANTE}'`)
check('e o acesso cai junto', banida.banida === true)

// --- ficha do contato e expurgo da auditoria --------------------------------
await asPostgres()
const ficha = '55555555-5555-4555-8555-555555555555'
await db.exec(`insert into public.quiz_sessions (id, status, current_step, lead_name, lead_email, answers, utm_source)
  values ('${ficha}', 'concluido', 7, 'Beltrana', 'beltrana@teste.momentumm', '{"goal": "correr 5km"}'::jsonb, 'instagram')`)
await db.exec(`insert into public.quiz_events (session_id, name, step) values ('${ficha}', 'quiz_started', 0), ('${ficha}', 'quiz_completed', 7)`)
await asOwner()

const detalhe = (await one(`select public.admin_quiz_lead_detail('${ficha}') as j`)).j
check('a ficha traz o contato', detalhe.email === 'beltrana@teste.momentumm')
check('a ficha traz o que a pessoa respondeu', detalhe.answers.goal === 'correr 5km')
check('a ficha traz a origem', detalhe.source.utm_source === 'instagram')
check('a ficha traz a linha do tempo', Array.isArray(detalhe.timeline) && detalhe.timeline.length === 2)

r = await proibido(() => db.query(`select public.admin_purge_audit(now()::date, 'limpeza')`), '90 dias')
check('não deixa apagar auditoria recente', r.ok, r.detail)

const expurgo = (await one(`select public.admin_purge_audit((now() - interval '200 days')::date, 'limpeza de ruido velho') as j`)).j
check('o expurgo antigo roda', typeof expurgo.deleted === 'number')

await asPostgres()
const marca = await one(`select count(*)::int as n from public.audit_logs where action = 'audit.purge'`)
check('e o proprio expurgo fica registrado', marca.n === 1, `veio ${marca.n}`)

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
