/*
  A regra do lembrete (migration 0056), contra um Postgres de verdade.

  O que este teste garante, que é exatamente a lista de coisas que só se
  descobre em produção quando não existe teste:

    - ação pendente + horas paradas => avisa
    - quem esteve no app agora há pouco NÃO é avisado
    - ação concluída => não avisa
    - fora da janela do dia => não avisa
    - o mesmo tipo não repete dentro do cooldown
    - teto de avisos por dia
    - duas contas nunca aparecem uma na fila da outra
    - as funções de servidor continuam fechadas pra `authenticated`

  O TEMPO é controlado pelo fuso, não pelo relógio de quem roda o teste: pra
  simular "são 10h pra essa pessoa", a conta ganha um fuso `Etc/GMT±N` em que
  a hora local é 10. Sem isso o resultado mudaria conforme a hora do dia em
  que a suíte roda, que é a pior espécie de teste — o que passa de manhã e
  quebra de madrugada.
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

const LAY = '11111111-1111-4111-8111-111111111111'
const CAROL = '22222222-2222-4222-8222-222222222222'

for (const [id, nome] of [[LAY, 'Layra Lima'], [CAROL, 'Carol Souza']]) {
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${id}', '${id.slice(0, 5)}@teste.momentumm', '${JSON.stringify({ name: nome })}'::jsonb)`)
  await db.exec(`update public.profiles set name = '${nome}' where id = '${id}'`)
}

/** O fuso em que a hora local, agora, é `hora`. `Etc/GMT+N` é UTC menos N. */
async function fusoParaHora(hora) {
  const utc = (await one(`select extract(hour from (now() at time zone 'UTC'))::int as h`)).h
  let n = utc - hora
  while (n > 12) n -= 24
  while (n < -12) n += 24
  return n >= 0 ? `Etc/GMT+${n}` : `Etc/GMT-${-n}`
}

/** Põe a conta num estado: que horas são pra ela, e há quanto tempo sumiu. */
async function situar(user, { hora, paradaHa }) {
  const tz = await fusoParaHora(hora)
  await db.exec(`insert into public.user_presence (user_id, last_active_at, timezone)
                 values ('${user}', now() - interval '${paradaHa} hours', '${tz}')
                 on conflict (user_id) do update
                   set last_active_at = excluded.last_active_at, timezone = excluded.timezone`)
  return tz
}

/** O dia local da conta, que é o dia que as ações precisam carregar. */
const hojeDe = async (user) => (await one(`select public.local_day_of('${user}')::text as d`)).d

const decidir = async (user = LAY) =>
  (await one(`select public.decide_notification('${user}') as t`)).t

const limpar = () =>
  db.exec(`delete from public.notification_log; delete from public.tasks;
           delete from public.habit_logs; delete from public.notification_preferences`)

/** Uma ação em aberto pra hoje, e um avanço ontem (senão a conta é "nova"). */
async function comAcaoPendente(user = LAY) {
  const hoje = await hojeDe(user)
  await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
                 values ('${user}', 'Avancou ontem', date '${hoje}' - 1, 'feita', now() - interval '20 hours')`)
  await db.exec(`insert into public.tasks (user_id, title, day, status)
                 values ('${user}', 'Publicar conteudo', date '${hoje}', 'pendente')`)
}

console.log('\n## A regra está gravada, não espalhada')
const regras = await one(`select * from public.notification_rules_current()`)
check('a linha de regras existe com os padrões combinados',
  regras.inactivity_threshold_hours === 4 &&
    regras.window_start === '08:00:00' &&
    regras.window_end === '21:30:00' &&
    regras.max_per_day === 1,
  JSON.stringify(regras))

console.log('\n## Ação pendente e horas paradas')
await limpar()
await situar(LAY, { hora: 10, paradaHa: 5 })
await comAcaoPendente()
check('cinco horas paradas com ação em aberto viram próximo passo',
  (await decidir()) === 'proximo_passo', `veio ${await decidir()}`)

console.log('\n## Quem está no app não é interrompido')
await situar(LAY, { hora: 10, paradaHa: 1 })
check('uma hora atrás no app não recebe nada', (await decidir()) === null)
await situar(LAY, { hora: 10, paradaHa: 3.9 })
check('logo antes do limiar ainda não recebe', (await decidir()) === null)
await situar(LAY, { hora: 10, paradaHa: 4.1 })
check('logo depois do limiar recebe', (await decidir()) === 'proximo_passo')

console.log('\n## Ação concluída')
await situar(LAY, { hora: 10, paradaHa: 5 })
const hojeLay = await hojeDe(LAY)
await db.exec(`update public.tasks set status = 'feita', completed_at = now()
                where user_id = '${LAY}' and day = date '${hojeLay}'`)
check('com o dia resolvido não existe aviso', (await decidir()) === null)

console.log('\n## A janela do dia')
await limpar()
await situar(LAY, { hora: 10, paradaHa: 6 })
await comAcaoPendente()
check('às 10h avisa', (await decidir()) === 'proximo_passo')
await situar(LAY, { hora: 7, paradaHa: 6 })
check('às 7h (antes da janela) não avisa', (await decidir()) === null)
await situar(LAY, { hora: 23, paradaHa: 6 })
check('às 23h (depois da janela) não avisa', (await decidir()) === null)
await situar(LAY, { hora: 3, paradaHa: 6 })
check('às 3h da manhã não avisa', (await decidir()) === null)

console.log('\n## Fim de tarde vira dia difícil, não cobrança')
await situar(LAY, { hora: 19, paradaHa: 6 })
check('das 18h em diante o tipo muda', (await decidir()) === 'dia_dificil')

console.log('\n## Cooldown e teto do dia')
await limpar()
await situar(LAY, { hora: 10, paradaHa: 6 })
await comAcaoPendente()
const tipo = await decidir()
check('há o que avisar antes do registro', tipo === 'proximo_passo')

// Um envio de ontem, dentro do cooldown de 20 horas.
await db.exec(`insert into public.notification_log (user_id, type, day, sent_at)
               values ('${LAY}', 'proximo_passo', date '${await hojeDe(LAY)}' - 1, now() - interval '6 hours')`)
check('o mesmo tipo não repete dentro do cooldown', (await decidir()) === null)

await db.exec(`update public.notification_log set sent_at = now() - interval '30 hours'`)
check('passado o cooldown o aviso volta a valer', (await decidir()) === 'proximo_passo')

await db.exec(`insert into public.notification_log (user_id, type, day, sent_at)
               values ('${LAY}', 'dia_dificil', date '${await hojeDe(LAY)}', now() - interval '2 hours')`)
check('com o teto do dia batido não sai nada, de tipo nenhum', (await decidir()) === null)

console.log('\n## Preferências de quem recebe')
await limpar()
await situar(LAY, { hora: 10, paradaHa: 6 })
await comAcaoPendente()
await db.exec(`insert into public.notification_preferences (user_id, types)
               values ('${LAY}', array['retomada']::public.notification_type[])
               on conflict (user_id) do update set types = excluded.types`)
check('quem desligou o próximo passo não recebe próximo passo', (await decidir()) === null)
await db.exec(`update public.notification_preferences
                  set types = '{}'::public.notification_type[] where user_id = '${LAY}'`)
check('com tudo desmarcado não chega nada', (await decidir()) === null)

console.log('\n## Uma conta nunca entra na fila da outra')
await limpar()
await situar(LAY, { hora: 10, paradaHa: 6 })
await situar(CAROL, { hora: 10, paradaHa: 6 })
await comAcaoPendente(LAY)
await comAcaoPendente(CAROL)
await db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
               values ('${LAY}', 'https://push.exemplo/lay', 'chave-p256', 'chave-auth')`)

const fila = await q(`select * from public.notifications_due()`)
check('só quem tem aparelho inscrito entra na fila',
  fila.length === 1 && fila[0].user_id === LAY, JSON.stringify(fila))
check('a fila traz as chaves daquela conta, e só delas',
  fila[0]?.endpoint === 'https://push.exemplo/lay' && fila[0]?.first_name === 'Layra')

await db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
               values ('${CAROL}', 'https://push.exemplo/carol', 'p256-carol', 'auth-carol')`)
const duas = await q(`select * from public.notifications_due()`)
const daLay = duas.filter((row) => row.user_id === LAY)
const daCarol = duas.filter((row) => row.user_id === CAROL)
check('duas contas, duas linhas separadas', daLay.length === 1 && daCarol.length === 1)
check('nenhuma linha carrega o endpoint da outra',
  daLay[0].endpoint.endsWith('/lay') && daCarol[0].endpoint.endsWith('/carol'))

await db.exec(`select public.mark_notification_sent('${LAY}', '${daLay[0].kind}', '${daLay[0].subscription_id}')`)
const depois = await q(`select * from public.notifications_due()`)
check('carimbado o envio, só a outra conta continua na fila',
  depois.length === 1 && depois[0].user_id === CAROL, JSON.stringify(depois))

console.log('\n## Evento registrado pelo servidor')
await db.exec(`select public.log_notification_event('${LAY}', 'notification_sent',
               '{"notification_type":"proximo_passo","days_since_activity":1}'::jsonb)`)
const evento = await one(`select user_id, name, feature, metadata from public.product_events
                           where name = 'notification_sent' limit 1`)
check('o evento fica com o dono certo e a feature de notificações',
  evento?.user_id === LAY && evento?.feature === 'notificacoes', JSON.stringify(evento))
check('os metadados aceitos passam',
  evento?.metadata?.notification_type === 'proximo_passo', JSON.stringify(evento?.metadata))

let recusou = null
try {
  await db.query(`select public.log_notification_event('${LAY}', 'evento_inventado', '{}'::jsonb)`)
} catch (cause) {
  recusou = String(cause.message ?? cause)
}
check('evento fora da lista é recusado', recusou !== null, String(recusou))

console.log('\n## As portas continuam fechadas')
const comoUsuario = async (sql) => {
  await db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: LAY, role: 'authenticated' })}',false)`)
  try {
    await db.query(sql)
    return null
  } catch (cause) {
    return String(cause.message ?? cause)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
  }
}

check('notifications_due fechada pra authenticated',
  (await comoUsuario(`select * from public.notifications_due()`)) !== null)
check('decide_notification fechada pra authenticated',
  (await comoUsuario(`select public.decide_notification('${CAROL}')`)) !== null)
check('log_notification_event fechada pra authenticated',
  (await comoUsuario(`select public.log_notification_event('${CAROL}', 'notification_sent', '{}'::jsonb)`)) !== null)
/*
  A tabela de regras tem RLS sem política nenhuma: pra `authenticated` ela não
  dá erro, ela some. O teste é esse — zero linhas pra quem entra pela API, e a
  linha continuando lá pra quem lê como servidor.
*/
await db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: LAY, role: 'authenticated' })}',false)`)
const regrasComoUsuario = await q(`select * from public.notification_rules`)
await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
check('notification_rules não aparece pra authenticated',
  regrasComoUsuario.length === 0 && (await q(`select 1 from public.notification_rules`)).length === 1,
  JSON.stringify(regrasComoUsuario))

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
