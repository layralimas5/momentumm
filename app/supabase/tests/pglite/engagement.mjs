/*
  O painel do laço de retenção, contra um Postgres de verdade.

  `admin_engagement` responde cinco perguntas numa consulta só, e todas elas
  passam por `unnest`, `percentile_cont` e funções `security definer`. Nada
  disso é pego por tipo: ou a função é CHAMADA, ou o erro aparece na tela da
  Lay em produção.

  O teste também verifica a decisão que dá sentido ao resto: retenção por
  ABERTURA e por AVANÇO precisam dar números diferentes pra mesma coorte —
  se derem o mesmo, a separação não está funcionando.
*/
import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

const db = await boot()
const failures = await migrate(db, { stopOnError: true })
if (failures.length) { console.log(failures); process.exit(1) }

const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const ADMIN = '11111111-1111-4111-8111-111111111111'
/** Abriu o app no dia seguinte e nunca fez nada. */
const SO_ABRIU = '22222222-2222-4222-8222-222222222222'
/** Abriu e concluiu ação: avançou de verdade. */
const AVANCOU = '33333333-3333-4333-8333-333333333333'

const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asAdmin = () =>
  db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: ADMIN, role: 'authenticated', aal: 'aal2' })}',false)`)

await asPostgres()
for (const id of [ADMIN, SO_ABRIU, AVANCOU]) {
  await db.exec(`insert into auth.users (id, email, created_at)
                 values ('${id}', '${id.slice(0, 4)}@teste.momentumm', now() - interval '20 days')`)
}
await db.exec(`insert into public.user_roles (user_id, role) values ('${ADMIN}', 'owner') on conflict do nothing`)
await db.exec(`update public.product_settings set value = '{"requireMfa": false}'::jsonb where key = 'admin.security'`)

console.log('\n## Abriu x avançou')

// Os dois abriram o app no D1. Só um deles fez alguma coisa.
await db.exec(`insert into public.product_events (user_id, name, feature, created_at, day) values
  ('${SO_ABRIU}', 'session_start', null, now() - interval '19 days', (now() - interval '19 days')::date),
  ('${SO_ABRIU}', 'feature_view', 'hoje', now() - interval '19 days', (now() - interval '19 days')::date),
  ('${AVANCOU}', 'session_start', null, now() - interval '19 days', (now() - interval '19 days')::date),
  ('${AVANCOU}', 'feature_view', 'hoje', now() - interval '19 days', (now() - interval '19 days')::date),
  ('${AVANCOU}', 'task_completed', 'hoje', now() - interval '19 days', (now() - interval '19 days')::date)`)

const abriram = await q(`select * from public.active_user_ids(now() - interval '25 days', now())`)
const avancaram = await q(`select * from public.advanced_user_ids(now() - interval '25 days', now())`)
check('quem abriu conta dois', abriram.length === 2, `veio ${abriram.length}`)
check('quem avançou conta um', avancaram.length === 1, `veio ${avancaram.length}`)

/*
  A data de criação vem da própria linha, não de um `now()` recalculado: a
  janela de `retained_at` é relativa ao cadastro, e alguns milissegundos de
  diferença jogam o evento pra fora dela.
*/
const criado = (u) => `(select created_at from auth.users where id = '${u}')`

check('retained_at pega quem só abriu',
  (await one(`select public.retained_at('${SO_ABRIU}', ${criado(SO_ABRIU)}, 1) as r`)).r === true)
check('advanced_at NÃO pega quem só abriu',
  (await one(`select public.advanced_at('${SO_ABRIU}', ${criado(SO_ABRIU)}, 1) as r`)).r === false)
check('advanced_at pega quem concluiu ação',
  (await one(`select public.advanced_at('${AVANCOU}', ${criado(AVANCOU)}, 1) as r`)).r === true)

console.log('\n## admin_engagement')

// Ativação: um objetivo, uma ação concluída.
await db.exec(`insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
               values ('${AVANCOU}', 'Conseguir 30 assinantes', 'estudo', 30, current_date - 20, current_date + 60)`)
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${AVANCOU}', 'Publicar conteudo', current_date, 'feita', now() - interval '19 days')`)

// Funil da retomada e uma notificação aberta.
await db.exec(`insert into public.product_events (user_id, name, feature, metadata, created_at, day) values
  ('${AVANCOU}', 'recovery_shown', 'retomada', '{}'::jsonb, now() - interval '5 days', (now() - interval '5 days')::date),
  ('${AVANCOU}', 'recovery_started', 'retomada', '{}'::jsonb, now() - interval '5 days', (now() - interval '5 days')::date),
  ('${AVANCOU}', 'recovery_completed', 'retomada', '{}'::jsonb, now() - interval '5 days', (now() - interval '5 days')::date),
  ('${AVANCOU}', 'habit_logged', 'habitos', '{}'::jsonb, now() - interval '4 days', (now() - interval '4 days')::date),
  ('${AVANCOU}', 'notification_sent', 'notificacoes', '{"notification_type":"proximo_passo"}'::jsonb, now() - interval '3 days', (now() - interval '3 days')::date),
  ('${AVANCOU}', 'notification_opened', 'notificacoes', '{"notification_type":"proximo_passo"}'::jsonb, now() - interval '3 days', (now() - interval '3 days')::date)`)

await asAdmin()
let data = null
try {
  data = (await one(`select public.admin_engagement((now() - interval '25 days')::date, now()::date) as j`)).j
  check('admin_engagement responde', true)
} catch (error) {
  check('admin_engagement responde', false, error.message)
}

if (data) {
  check('coorte tem as três contas', data.cohort_size === 3, `veio ${data.cohort_size}`)
  check('ativação conta quem tem objetivo', data.activation.planned === 1, JSON.stringify(data.activation))
  check('ativação conta quem viu o Hoje', data.activation.saw_today === 2, JSON.stringify(data.activation))
  check('ativação conta a primeira ação concluída', data.activation.first_action === 1, JSON.stringify(data.activation))

  const d1 = data.retention?.['1']
  check('retenção D1 traz as duas réguas', d1 && 'opened' in d1 && 'advanced' in d1, JSON.stringify(data.retention))
  check('D1 por abertura é maior que por avanço',
    d1 && Number(d1.opened) > Number(d1.advanced), JSON.stringify(d1))

  check('tempo até a primeira ação existe',
    data.time_to_first_action_hours?.median !== null, JSON.stringify(data.time_to_first_action_hours))

  check('funil da retomada fecha', data.recovery.shown === 1 && data.recovery.started === 1 && data.recovery.completed === 1,
    JSON.stringify(data.recovery))
  check('quem retomou voltou a avançar em três dias', data.recovery.advanced_after === 1,
    JSON.stringify(data.recovery))

  check('notificações agrupadas por tipo',
    data.notifications?.proximo_passo?.sent === 1 && data.notifications?.proximo_passo?.opened === 1,
    JSON.stringify(data.notifications))
}

console.log('\n## Nomes de evento')
const nomes = (await one(`select public.product_event_names() as n`)).n
for (const nome of ['primary_action_viewed', 'action_started', 'day_completed', 'pair_created', 'notification_sent']) {
  check(`'${nome}' é aceito pelo banco`, nomes.includes(nome))
}

/*
  Conta antiga continua funcionando.

  A migration redefine `product_feature_names()`, e redefinir uma lista é a
  forma mais silenciosa de APAGAR um item dela: o recurso antigo passaria a
  ser recusado pelo banco e os eventos dele sumiriam sem erro em lugar nenhum.
*/
console.log('\n## Nada foi perdido')
const recursos = (await one(`select public.product_feature_names() as n`)).n
for (const antigo of [
  'hoje', 'objetivos', 'habitos', 'plano', 'progresso', 'review', 'momentum_score',
  'ai', 'retomada', 'compartilhamento', 'circulo', 'desafios', 'foco', 'insights',
  'perfil', 'evolucao', 'configuracoes', 'assinatura',
]) {
  check(`recurso '${antigo}' continua aceito`, recursos.includes(antigo))
}
for (const antigo of [
  'session_start', 'feature_view', 'task_completed', 'habit_logged',
  'recovery_started', 'trial_started', 'reminder_enabled',
]) {
  check(`evento '${antigo}' continua aceito`, nomes.includes(antigo))
}

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
