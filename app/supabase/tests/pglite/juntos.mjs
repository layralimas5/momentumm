/*
  Juntos — a dupla, contra um Postgres de verdade e com RLS ligada.

  Este é o teste que decide se a camada social pode existir. Ele não verifica
  se a tela funciona: verifica se, com uma sessão autenticada de verdade, uma
  pessoa consegue ver alguma coisa da outra além de "avançou hoje".

  Os cenários são os do pedido:

    4  A gera convite, B aceita, dupla criada
    5  B não consegue ver dado privado de A
    6  reação sai, chega e fica registrada
    7  convite inválido, reutilizado, expirado e o próprio convite

  A sessão é simulada como o Supabase faz: `role = authenticated` mais o
  `request.jwt.claims` com o `sub`. É assim que `auth.uid()` responde, e é o
  que faz a RLS valer no teste — sem isso o teste rodaria como superusuário e
  aprovaria um banco aberto.
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

/** Roda algo esperando erro. Devolve a mensagem, ou null se não deu erro. */
async function erro(sql, params = []) {
  try {
    await db.query(sql, params)
    return null
  } catch (cause) {
    return String(cause.message ?? cause)
  }
}

const LAY = '11111111-1111-4111-8111-111111111111'
const CAROL = '22222222-2222-4222-8222-222222222222'
const ESTRANHA = '33333333-3333-4333-8333-333333333333'

const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asUser = (id) =>
  db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: id, role: 'authenticated' })}',false)`)

await asPostgres()
for (const [id, nome] of [[LAY, 'Layra Lima'], [CAROL, 'Carol Souza'], [ESTRANHA, 'Fulana Estranha']]) {
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data)
                 values ('${id}', '${id.slice(0, 5)}@teste.momentumm', '${JSON.stringify({ name: nome })}'::jsonb)`)
  await db.exec(`update public.profiles set name = '${nome}' where id = '${id}'`)
}

console.log('\n## Cenário 4 — convite e dupla')

await asUser(LAY)
const convite = (await one(`select public.pair_create_invite() as j`)).j
check('o convite devolve um token', typeof convite.token === 'string' && convite.token.length >= 32)

await asPostgres()
const guardado = await one(`select token_hash, status from public.pair_invites limit 1`)
check('o token NÃO é guardado em claro', guardado.token_hash !== convite.token)
check('o que é guardado é o sha256 do token',
  guardado.token_hash === (await one(`select encode(extensions.digest('${convite.token}', 'sha256'), 'hex') as h`)).h)

await asUser(CAROL)
const previa = (await one(`select public.pair_invite_preview('${convite.token}') as j`)).j
check('a prévia mostra só o primeiro nome de quem convidou', previa.inviter_name === 'Layra')
check('a prévia não carrega e-mail nem id do convite', !('email' in previa) && !('inviter_id' in previa))
check('a prévia diz que dá pra aceitar', previa.can_accept === true)

const pairId = (await one(`select public.pair_accept_invite('${convite.token}') as id`)).id
check('a dupla foi criada', typeof pairId === 'string')

const visao = (await one(`select public.pair_overview() as j`)).j
check('a visão traz uma dupla', visao.pairs.length === 1)
check('a dupla tem duas pessoas', visao.pairs[0].members.length === 2)
check('quem pergunta aparece primeiro', visao.pairs[0].members[0].is_me === true)
check('os nomes vêm só com o primeiro',
  visao.pairs[0].members.map((m) => m.name).sort().join(',') === 'Carol,Layra')
check('cada pessoa traz sete dias', visao.pairs[0].members[0].days.length === 7)

await asUser(LAY)
check('quem convidou também vê a dupla',
  (await one(`select public.pair_overview() as j`)).j.pairs[0].id === pairId)

console.log('\n## Cenário 5 — privacidade')

// A Lay tem um objetivo, uma ação e um momento da jornada. Nada disso pode
// vazar pra dupla dela.
await asPostgres()
await db.exec(`insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
               values ('${LAY}', 'Perder 12kg ate dezembro', 'treino', 12, current_date, current_date + 90)`)
await db.exec(`insert into public.tasks (user_id, title, day, status, completed_at)
               values ('${LAY}', 'Treino de forca as 6h', current_date, 'feita', now())`)
await db.exec(`insert into public.habits (user_id, name, axis_slug, icon, target, minimal_target, day_part)
               values ('${LAY}', 'Meditar', 'meditacao', 'lotus', 10, 5, 'manha')`)
await db.exec(`insert into public.check_ins (user_id, day, mood, energy, focus, note)
               values ('${LAY}', current_date, 'estavel', 3, 'afiado', 'nota bem privada')`)

await asUser(CAROL)
check('a dupla não lê os objetivos da outra',
  (await q(`select id from public.objectives where user_id = '${LAY}'`)).length === 0)
check('a dupla não lê as ações da outra',
  (await q(`select id from public.tasks where user_id = '${LAY}'`)).length === 0)
check('a dupla não lê os hábitos da outra',
  (await q(`select id from public.habits where user_id = '${LAY}'`)).length === 0)
check('a dupla não lê o check-in da outra',
  (await q(`select id from public.check_ins where user_id = '${LAY}'`)).length === 0)
check('a dupla não lê o XP da outra',
  (await q(`select id from public.xp_transactions where user_id = '${LAY}'`)).length === 0)

const semGrant = await erro(`select public.advanced_on('${LAY}', current_date)`)
check('não dá pra perguntar direto se alguém avançou', semGrant !== null, `veio ${semGrant}`)

const depoisDaAcao = (await one(`select public.pair_overview() as j`)).j
const layNaVisao = depoisDaAcao.pairs[0].members.find((m) => !m.is_me)
check('o que a dupla vê é só "avançou hoje"', layNaVisao.advanced_today === true)
check('o que a dupla vê não tem título de ação',
  !JSON.stringify(depoisDaAcao).includes('Treino de forca'))
check('o que a dupla vê não tem nome de objetivo',
  !JSON.stringify(depoisDaAcao).includes('Perder 12kg'))
check('o que a dupla vê não tem a nota do check-in',
  !JSON.stringify(depoisDaAcao).includes('nota bem privada'))
check('a Carol ainda não avançou hoje',
  depoisDaAcao.pairs[0].members.find((m) => m.is_me).advanced_today === false)

console.log('\n## Cenário 6 — incentivo')

await asUser(CAROL)
const reacao = (await one(`select public.pair_send_encouragement('${pairId}', 'bora') as id`)).id
check('o incentivo foi registrado', typeof reacao === 'string')

await asPostgres()
const linha = await one(`select sender_id, recipient_id, kind from public.pair_encouragements where id = '${reacao}'`)
check('o destinatário é a outra pessoa da dupla, sem o app escolher',
  linha.sender_id === CAROL && linha.recipient_id === LAY && linha.kind === 'bora')

await asUser(CAROL)
const repetido = (await one(`select public.pair_send_encouragement('${pairId}', 'bora') as id`)).id
check('mandar de novo no mesmo dia não duplica', repetido === reacao)
check('só existe uma linha do mesmo gesto no dia',
  (await q(`select id from public.pair_encouragements where kind = 'bora'`)).length === 1)

await asUser(LAY)
const recebidos = (await one(`select public.pair_overview() as j`)).j.pairs[0].encouragements_today
check('quem recebeu vê o incentivo', recebidos.length === 1 && recebidos[0].kind === 'bora')

console.log('\n## O teto de incentivos por plano (0052)')

/*
  A conta nova nasce com sete dias de teste (0034), e teste é PRO — é por isso
  que o cenário 6 passou mandando gesto sem encostar em limite nenhum. Aqui o
  teste da Carol é encerrado, e ela cai pro gratuito de verdade.

  O encerramento é pelo `status`, não empurrando o `ends_at` pro passado: a
  tabela tem `check (ends_at > started_at)`, e é ele que impede o teste de
  fabricar um estado que a produção nunca teria.
*/
await asPostgres()
await db.exec(`update public.plan_trials set status = 'encerrado', ended_at = now() where user_id = '${CAROL}'`)
const planoCarol = (await one(`select public.plan_for_user('${CAROL}') as p`)).p
check('com o teste vencido a Carol está no gratuito', planoCarol === 'free', `veio ${planoCarol}`)

await asUser(CAROL)
const segundoNoFree = await erro(`select public.pair_send_encouragement('${pairId}', 'mandou_bem')`)
check('no gratuito o segundo gesto do dia é recusado', segundoNoFree !== null)
check('a recusa convida pro PRO em vez de mostrar código interno',
  segundoNoFree !== null && segundoNoFree.includes('PRO') && !segundoNoFree.includes('plan_required'),
  `veio ${segundoNoFree}`)

const reenvio = (await one(`select public.pair_send_encouragement('${pairId}', 'bora') as id`)).id
check('reenviar o MESMO gesto não custa vaga nova nem no gratuito', reenvio === reacao)

await asPostgres()
await db.exec(`update public.plan_trials set status = 'ativo', ended_at = null, ends_at = now() + interval '7 days' where user_id = '${CAROL}'`)
await asUser(CAROL)
const segundoNoPro = (await one(`select public.pair_send_encouragement('${pairId}', 'mandou_bem') as id`)).id
check('no PRO o segundo gesto do dia passa', typeof segundoNoPro === 'string')
await asPostgres()
await db.exec(`delete from public.pair_encouragements where kind = 'mandou_bem'`)

await asUser(ESTRANHA)
check('quem está fora da dupla não vê incentivo nenhum',
  (await q(`select id from public.pair_encouragements`)).length === 0)
check('quem está fora da dupla não vê os membros',
  (await q(`select user_id from public.pair_members`)).length === 0)
const semDupla = (await one(`select public.pair_overview() as j`)).j
check('quem não tem dupla recebe lista vazia', semDupla.pairs.length === 0)
const semPar = await erro(`select public.pair_send_encouragement('${pairId}', 'bora')`)
check('quem não tem dupla não consegue mandar incentivo', semPar !== null)

console.log('\n## Cenário 7 — convite inválido, reutilizado e expirado')

const reuso = await erro(`select public.pair_accept_invite('${convite.token}')`)
check('o mesmo convite não pode ser aceito duas vezes', reuso !== null, `veio ${reuso}`)

const invalido = await erro(`select public.pair_accept_invite('nao-existe')`)
check('token inventado é recusado', invalido !== null)

const previaInvalida = (await one(`select public.pair_invite_preview('nao-existe') as j`)).j
check('a prévia de um token inventado não vaza nada',
  previaInvalida.status === 'invalido' && !('inviter_name' in previaInvalida))

// Convite próprio e convite vencido.
await asUser(ESTRANHA)
const meu = (await one(`select public.pair_create_invite() as j`)).j
const proprio = await erro(`select public.pair_accept_invite('${meu.token}')`)
check('ninguém aceita o próprio convite', proprio !== null, `veio ${proprio}`)

await asPostgres()
await db.exec(`update public.pair_invites set expires_at = now() - interval '1 day' where status = 'pendente'`)
await asUser(CAROL)
const vencido = (await one(`select public.pair_invite_preview('${meu.token}') as j`)).j
check('convite vencido aparece como expirado na prévia', vencido.status === 'expirado')

console.log('\n## O teto de duplas por plano (0053)')

/*
  Até a 0053 isto era um índice único: uma dupla ativa por pessoa, pra todo
  mundo. Agora é o plano que decide, então o mesmo cenário roda duas vezes com
  a mesma conta em planos diferentes.
*/
await asPostgres()
await db.exec(`update public.pair_invites set expires_at = now() + interval '7 days', status = 'pendente' where token_hash = encode(extensions.digest('${meu.token}', 'sha256'), 'hex')`)
await db.exec(`update public.plan_trials set status = 'encerrado', ended_at = now() where user_id = '${CAROL}'`)

await asUser(CAROL)
const segundaNoFree = await erro(`select public.pair_accept_invite('${meu.token}')`)
check('no gratuito não cabe uma segunda dupla', segundaNoFree !== null, `veio ${segundaNoFree}`)
check('a recusa da segunda dupla convida pro PRO',
  segundaNoFree !== null && segundaNoFree.includes('PRO'), `veio ${segundaNoFree}`)

const conviteNoFree = await erro(`select public.pair_create_invite()`)
check('no gratuito, com a dupla ocupada, não sai convite novo', conviteNoFree !== null)

/*
  O convite NÃO morre porque quem recebeu está no gratuito.

  Só o teto de quem CONVIDOU cancela o link, porque esse não vai passar a valer
  sozinho. O teto de quem recebe é temporário: ela assina e usa o mesmo link.
*/
await asPostgres()
const aindaVale = await one(`select status from public.pair_invites where token_hash = encode(extensions.digest('${meu.token}', 'sha256'), 'hex')`)
check('o convite recusado por limite de quem recebe continua pendente',
  aindaVale.status === 'pendente', `veio ${aindaVale.status}`)

// A mesma conta, agora no PRO.
await db.exec(`update public.plan_trials set status = 'ativo', ended_at = null, ends_at = now() + interval '7 days' where user_id = '${CAROL}'`)
await asUser(CAROL)
const segunda = (await one(`select public.pair_accept_invite('${meu.token}') as id`)).id
check('no PRO a segunda dupla entra', typeof segunda === 'string')

const comDuas = (await one(`select public.pair_overview() as j`)).j
check('as duas duplas aparecem na visão', comDuas.pairs.length === 2)
check('o PRO não tem teto de duplas', comDuas.max === null && comDuas.room === true)
check('cada dupla traz a própria gente',
  comDuas.pairs.every((d) => d.members.length === 2 && d.members[0].is_me === true))
check('as duplas são relações separadas', comDuas.pairs[0].id !== comDuas.pairs[1].id)

// Duas duplas com a MESMA pessoa continuam sem existir.
await asUser(LAY)
const denovo = (await one(`select public.pair_create_invite() as j`)).j
await asUser(CAROL)
const mesmaPessoa = await erro(`select public.pair_accept_invite('${denovo.token}')`)
check('a mesma pessoa não vira duas duplas', mesmaPessoa !== null, `veio ${mesmaPessoa}`)

console.log('\n## Sair de uma dupla')

await asUser(CAROL)
await db.exec(`select public.pair_leave('${pairId}')`)
const sobrou = (await one(`select public.pair_overview() as j`)).j
check('sair leva só a dupla escolhida', sobrou.pairs.length === 1)
check('a que sobrou é a outra', sobrou.pairs[0].id === segunda)
await asUser(LAY)
check('a dupla acaba para os dois', (await one(`select public.pair_overview() as j`)).j.pairs.length === 0)
await asPostgres()
check('o histórico da dupla continua no banco',
  (await q(`select id from public.accountability_pairs where ended_at is not null`)).length === 1)

check('depois de sair dá pra convidar de novo',
  (await (async () => { await asUser(LAY); return erro(`select public.pair_create_invite()`) })()) === null)

console.log('\n## A flag')
await asPostgres()
const flag = await one(`select value -> 'juntos' as j from public.product_settings where key = 'features'`)
check('o Juntos está ligado depois da 0052', flag.j === true)
const tetoFree = await one(`select value -> 'pairEncouragementsPerDay' as t from public.product_settings where key = 'plans.free'`)
const tetoPro = await one(`select value -> 'pairEncouragementsPerDay' as t from public.product_settings where key = 'plans.pro'`)
check('o gratuito tem teto de um incentivo por dia', tetoFree.t === 1, `veio ${tetoFree.t}`)
check('o PRO não tem teto', tetoPro.t === null, `veio ${tetoPro.t}`)

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
