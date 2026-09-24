/*
  Os gatilhos de retorno, contra um Postgres de verdade.

  `decide_notification` é uma cadeia de prioridades sobre fuso, preferências,
  dupla e estado do dia. É o tipo de função em que um `and` no lugar errado não
  quebra nada: só faz o app mandar a notificação errada pra pessoa errada,
  todo dia, sem ninguém perceber por meses.

  O que este teste garante:

    - quem já avançou hoje não é interrompido
    - uma por dia, e só uma
    - a ordem de prioridade é a que está escrita
    - a janela de silêncio atravessa a meia-noite
    - conta nova sem nenhum avanço não recebe "retomada"
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
  /*
    Seis horas paradas: a partir da 0055 o aviso só existe pra quem não passa
    pelo app há um tempo. Presença de agora cala TODOS os tipos, e o teste
    inteiro viraria uma fileira de `null` que não prova nada.
  */
  await db.exec(`insert into public.user_presence (user_id, last_active_at, timezone)
                 values ('${id}', now() - interval '6 hours', 'America/Sao_Paulo')`)
}

const decidir = async (user = LAY) =>
  (await one(`select public.decide_notification('${user}') as t`)).t

const limpar = () => db.exec(`delete from public.notification_log; delete from public.tasks; delete from public.habit_logs`)

console.log('\n## Janela de silêncio')
check('22h às 7h pega a madrugada',
  (await one(`select public.in_quiet_hours(2, 22, 7) as r`)).r === true)
check('22h às 7h não pega a tarde',
  (await one(`select public.in_quiet_hours(15, 22, 7) as r`)).r === false)
check('a hora do fim é exclusiva',
  (await one(`select public.in_quiet_hours(7, 22, 7) as r`)).r === false)
check('janela igual é janela vazia',
  (await one(`select public.in_quiet_hours(3, 0, 0) as r`)).r === false)

console.log('\n## Sem histórico')
check('conta sem nenhum avanço não recebe retomada', (await decidir()) === null)

console.log('\n## Próximo passo e dia difícil')
await limpar()
// Um avanço ontem, uma ação pendente hoje.
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${LAY}', 'Feita ontem', current_date - 1, 'feita', now() - interval '1 day')`)
await db.exec(`insert into public.tasks (user_id, title, day, status)
               values ('${LAY}', 'Publicar conteudo', current_date, 'pendente')`)

const agora = (await one(`select extract(hour from (now() at time zone 'America/Sao_Paulo'))::int as h`)).h
const foraDaJanela = agora < 8 || agora >= 22
const esperado = foraDaJanela ? null : agora >= 18 ? 'dia_dificil' : 'proximo_passo'
check(`com ação pendente a decisão é ${esperado}`, (await decidir()) === esperado, `veio ${await decidir()}`)

console.log('\n## Quem avançou hoje não é interrompido')
await db.exec(`update public.tasks set status = 'feita', completed_at = now()
                where user_id = '${LAY}' and day = current_date`)
check('quem já avançou hoje não recebe nada', (await decidir()) === null)

console.log('\n## Uma por dia')
await limpar()
await db.exec(`insert into public.tasks (user_id, title, day, status)
               values ('${LAY}', 'Pendente', current_date, 'pendente')`)
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${LAY}', 'Ontem', current_date - 1, 'feita', now() - interval '1 day')`)
const primeira = await decidir()
await db.exec(`insert into public.notification_log (user_id, type, day)
               values ('${LAY}', coalesce('${primeira ?? 'proximo_passo'}', 'proximo_passo')::public.notification_type, (now() at time zone 'America/Sao_Paulo')::date)`)
check('com um aviso já enviado hoje, não sai outro', (await decidir()) === null)

console.log('\n## Retomada tem prioridade sobre tudo')
await limpar()
// Avançou há cinco dias e nada desde então, com ação pendente hoje.
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${LAY}', 'Ha cinco dias', current_date - 5, 'feita', now() - interval '5 days')`)
await db.exec(`insert into public.tasks (user_id, title, day, status)
               values ('${LAY}', 'Pendente hoje', current_date, 'pendente')`)
/*
  Retomada tem hora marcada (a preferida da pessoa) desde a 0055: quem sumiu
  há dias não recebe "sua ação de hoje ainda cabe" às 9h da manhã.
*/
await db.exec(`insert into public.notification_preferences (user_id, preferred_hour)
               values ('${LAY}', ${agora})
               on conflict (user_id) do update set preferred_hour = ${agora}`)
const emPausa = await decidir()
check('cinco dias parada pede retomada, não próximo passo',
  emPausa === 'retomada' || foraDaJanela, `veio ${emPausa}`)
await db.exec(`delete from public.notification_preferences`)

console.log('\n## Preferências')

/** Roda algo esperando erro. Devolve a mensagem, ou null se não deu erro. */
async function erro(sql) {
  try {
    await db.query(sql)
    return null
  } catch (cause) {
    return String(cause.message ?? cause)
  }
}

/*
  A ordem importa: um erro no PGlite limpa as GUCs da sessão, então a gravação
  bem-sucedida vem ANTES da recusa. Invertido, o `set_config` seguinte se
  perderia e o teste acusaria um bug que não existe.
*/
await db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: LAY, role: 'authenticated' })}',false)`)
await db.exec(`select public.save_notification_preferences(
  array['proximo_passo']::public.notification_type[], 20, 23, 6)`)
await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)

const salvas = await one(
  `select preferred_hour, quiet_from from public.notification_preferences where user_id = '${LAY}'`,
)
check('a preferência foi gravada com a sessão certa',
  salvas.preferred_hour === 20 && salvas.quiet_from === 23, JSON.stringify(salvas))

const semSessao = await erro(`select public.save_notification_preferences(
  array['proximo_passo']::public.notification_type[], 19, 22, 7)`)
check('sem sessão a função recusa gravar preferência', semSessao !== null)

await db.exec(`insert into public.notification_preferences (user_id, types)
               values ('${LAY}', array['progresso']::public.notification_type[])
               on conflict (user_id) do update set types = excluded.types`)
check('quem desligou retomada não recebe retomada',
  (await decidir()) !== 'retomada', `veio ${await decidir()}`)

await db.exec(`update public.notification_preferences set quiet_from = 0, quiet_to = 23 where user_id = '${LAY}'`)
check('janela de silêncio larga cala tudo', (await decidir()) === null)

console.log('\n## Social')
await db.exec(`delete from public.notification_preferences`)
await limpar()

// Uma dupla de verdade, pelo caminho normal.
await db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: LAY, role: 'authenticated' })}',false)`)
const convite = (await one(`select public.pair_create_invite() as j`)).j
await db.exec(`select set_config('request.jwt.claims','${JSON.stringify({ sub: CAROL, role: 'authenticated' })}',false)`)
await db.exec(`select public.pair_accept_invite('${convite.token}')`)
// A Carol avança; a Lay, não.
await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${CAROL}', 'Avancou', current_date, 'feita', now())`)
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${LAY}', 'Ontem', current_date - 1, 'feita', now() - interval '1 day')`)

await db.exec(`insert into public.notification_preferences (user_id, preferred_hour)
               values ('${LAY}', ${agora})
               on conflict (user_id) do update set preferred_hour = ${agora}`)
const social = await decidir(LAY)
check('a dupla avançando vence o próximo passo',
  social === 'social' || foraDaJanela, `veio ${social}`)

console.log('\n## Fila de envio')
await db.exec(`delete from public.notification_log`)
await db.exec(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
               values ('${LAY}', 'https://push.exemplo/lay', 'chave-p256', 'chave-auth')`)
await db.exec(`update public.notification_preferences set preferred_hour = ${agora} where user_id = '${LAY}'`)
await db.exec(`insert into public.notification_preferences (user_id, preferred_hour)
               values ('${LAY}', ${agora}) on conflict (user_id) do update set preferred_hour = ${agora}`)

const fila = await q(`select * from public.notifications_due()`)
const naFila = fila.find((row) => row.user_id === LAY)
if (foraDaJanela) {
  check('na janela de silêncio a fila sai vazia', naFila === undefined)
} else {
  check('a fila traz o aparelho, o tipo e o nome da dupla',
    naFila !== undefined && naFila.kind !== null && naFila.partner_name === 'Carol',
    JSON.stringify(naFila))

  const registro = (await one(`select public.mark_notification_sent('${LAY}', '${naFila.kind}', '${naFila.subscription_id}') as id`)).id
  check('o envio é carimbado', typeof registro === 'string')
  check('depois de carimbado a fila não repete',
    (await q(`select * from public.notifications_due()`)).find((row) => row.user_id === LAY) === undefined)
}

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
