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
const asAnon = () =>
  db.exec(`select set_config('role', 'anon', false); select set_config('request.jwt.claims', '${JSON.stringify({ role: 'anon' })}', false)`)
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

console.log('\n## Sessão anônima')
const session = '11111111-1111-4111-8111-111111111111'
const attribution = { source: 'tiktok', medium: 'social', campaign: 'constancia', content: 'carrossel01', theme: 'constancia' }

await asAnon()
await db.exec(`select public.quiz_track('${session}', 'quiz_viewed', 0, '${JSON.stringify(attribution)}')`)
check('anônimo não lê a tabela de sessões', (await q(`select * from public.quiz_sessions`)).length === 0)
await asPostgres()
let s = await one(`select * from public.quiz_sessions where id = $1`, [session])
check('primeiro evento cria a sessão com UTMs', s && s.utm_source === 'tiktok' && s.utm_content === 'carrossel01' && s.theme === 'constancia', JSON.stringify(s))
check('sessão nasce sem dono e iniciada', s.user_id === null && s.status === 'iniciado')

await asAnon()
await db.exec(`select public.quiz_track('${session}', 'quiz_started', 0)`)
await db.exec(`select public.quiz_track('${session}', 'quiz_question_answered', 1)`)
await db.exec(`select public.quiz_save('${session}', '{"goal":"Lançar meu projeto","area":"projeto"}', null, 2)`)
await asPostgres()
s = await one(`select * from public.quiz_sessions where id = $1`, [session])
check('respostas e passo gravados', s.answers.goal === 'Lançar meu projeto' && s.current_step === 2, JSON.stringify(s.answers))

await asAnon()
let r = await expectError(() => db.exec(`select public.quiz_track('${session}', 'evento_invalido', 0)`), /evento desconhecido/)
check('evento fora da lista é recusado', r.ok, r.detail)

await db.exec(`select public.quiz_track('${session}', 'quiz_completed', 7)`)
await db.exec(`select public.quiz_save('${session}', '{"goal":"Lançar meu projeto"}', '{"profile":"Ambição alta"}', 7)`)
await asPostgres()
s = await one(`select * from public.quiz_sessions where id = $1`, [session])
check('quiz concluído muda o status e carimba a data', s.status === 'concluido' && s.completed_at !== null && s.diagnosis.profile === 'Ambição alta')

console.log('\n## Vínculo com a conta')
await asPostgres()
const me = (await one(`insert into auth.users (email) values ('quiz@x.com') returning id`)).id
const other = (await one(`insert into auth.users (email) values ('outra@x.com') returning id`)).id

await asUser(me)
const linked = (await one(`select public.quiz_link_to_me('${session}') as ok`)).ok
check('a pessoa vincula a sessão do quiz', linked === true)
await asPostgres()
s = await one(`select * from public.quiz_sessions where id = $1`, [session])
check('sessão agora tem dono e status vinculado', s.user_id === me && s.status === 'vinculado' && s.linked_at !== null)
check('eventos antigos ganham o user_id', (await one(`select count(*)::int as n from public.quiz_events where session_id = $1 and user_id is null`, [session])).n === 0)

await asUser(other)
r = await expectError(() => db.exec(`select public.quiz_link_to_me('${session}')`), /outra pessoa/)
check('outra conta não rouba a sessão', r.ok, r.detail)
r = await expectError(() => db.exec(`select public.quiz_track('${session}', 'plan_activated', null)`), /outra pessoa/)
check('outra conta não escreve evento na sessão', r.ok, r.detail)

await asAnon()
r = await expectError(() => db.exec(`select public.quiz_track('${session}', 'plan_activated', null)`), /outra pessoa/)
check('anônimo com o id não escreve depois do vínculo', r.ok, r.detail)

await asUser(me)
await db.exec(`select public.quiz_track('${session}', 'signup_completed', null)`)
await db.exec(`select public.quiz_track('${session}', 'plan_activated', null)`)
await db.exec(`select public.quiz_mark_activated('${session}')`)
await asPostgres()
s = await one(`select * from public.quiz_sessions where id = $1`, [session])
check('plano ativado carimba a sessão', s.status === 'ativado' && s.activated_at !== null)

console.log('\n## Painel')
await asPostgres()
await db.exec(`insert into public.user_roles (user_id, role) values ('${me}', 'owner')`)
// O painel exige MFA por padrão; o stub do auth não tem fator, então o teste desliga a exigência.
await db.exec(`update public.product_settings set value = '{"requireMfa": false}'::jsonb where key = 'admin.security'`)
await db.exec(`select set_config('role', 'authenticated', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: me, role: 'authenticated', aal: 'aal2' })}', false)`)
const funnel = (await one(`select public.admin_quiz_funnel(current_date - 1, current_date) as f`)).f
check('funil conta sessões por etapa', funnel.stages.quiz_viewed === 1 && funnel.stages.quiz_completed === 1 && funnel.stages.plan_activated === 1, JSON.stringify(funnel.stages))
check('funil agrupa por origem e tema', funnel.by_source.tiktok === 1 && funnel.by_theme.constancia === 1, JSON.stringify(funnel))

await asUser(other)
r = await expectError(() => db.exec(`select public.admin_quiz_funnel(current_date - 1, current_date)`), /.+/)
check('quem não é admin não lê o funil', r.ok, r.detail)

console.log('\n## Limpeza')
await asPostgres()
const stale = '22222222-2222-4222-8222-222222222222'
await db.exec(`insert into public.quiz_sessions (id, updated_at) values ('${stale}', now() - interval '100 days')`)
const removed = (await one(`select public.purge_stale_quiz_sessions() as n`)).n
check('sessão sem dono com 90+ dias é apagada, a vinculada fica', removed === 1 && (await q(`select 1 from public.quiz_sessions where id = $1`, [session])).length === 1)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed > 0 ? 1 : 0)
