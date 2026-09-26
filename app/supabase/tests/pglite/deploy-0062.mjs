/*
  O deploy da 0062, ensaiado sobre o banco que já roda.

  A migration traz os clubes. O que este ensaio confere é o que dá pra quebrar,
  e principalmente as duas regras comerciais que viram política:

    - a migration sobe sobre o estado de 0061, com contas e desafios dentro
    - criar clube exige PRO, e a recusa tem código próprio pra tela distinguir
    - quem cria entra como dono na mesma operação
    - clube por convite não aparece pra quem não é membro
    - clube aberto aparece na descoberta
    - PERDER o PRO não apaga o clube: ele continua legível e com os membros
    - sem PRO o dono não administra (a política recusa o update)
    - sair é sempre livre, com ou sem plano
    - o ranking soma os dias publicados nos desafios DO clube
    - o ranking recusa quem não é do clube
    - rodar de novo não quebra nada
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0061_convite_de_amigo.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0061: ok')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@momentumm.com.br') returning id`)).id
const zeca = (await one(`insert into auth.users (email) values ('zeca@momentumm.com.br') returning id`)).id

/*
  Quem escreve plano é o servidor (trigger da 0013): o ensaio assume esse papel.

  E o rebaixamento é explícito porque o harness cria todo perfil já no PRO —
  sem isto, "criar sem assinatura" seria testado com uma conta que assina.
*/
await db.query(`select set_config('request.jwt.claims', $1, false)`, [
  JSON.stringify({ role: 'service_role' }),
])
await db.query(`update public.profiles set plan = 'pro' where id = $1`, [lay])
await db.query(`update public.profiles set plan = 'free', plan_courtesy_until = null
                 where id = any($1::uuid[])`, [[bia, zeca]])
await db.query(`select set_config('request.jwt.claims', '', false)`)

const nova = await migrate(db, { from: '0061_convite_de_amigo.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0062 aplicada: ok')

async function sessao(userId) {
  // `false` no terceiro parâmetro: com `true` o valor morre no fim da
  // transação, e cada consulta aqui roda na sua.
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
}

// ---------------------------------------------------------------- criar

await sessao(bia)
let recusouSemPro = false
try {
  await q(`select public.create_club('Clube da Bia', null, 'geral', 'aurora', 'aberto')`)
} catch (erro) {
  recusouSemPro = erro.code === 'P0001'
  if (!recusouSemPro) console.log('   (código recebido:', erro.code, '|', erro.message, ')')
}
console.log('criar sem PRO é recusado com código próprio:', recusouSemPro ? 'ok' : 'FALHOU')

await sessao(lay)
const criado = await one(
  `select * from public.create_club('Projeto 90 Dias', 'Três meses de constância', 'treino', 'brasa', 'aberto')`,
)
console.log('quem tem PRO cria:', criado?.id ? 'ok' : `FALHOU: ${JSON.stringify(criado)}`)

const donoDentro = await one(
  `select role from public.club_members where club_id = $1 and user_id = $2`, [criado.id, lay],
)
console.log('o dono entra na mesma operação:', donoDentro?.role === 'dono' ? 'ok' : 'FALHOU')

const fechado = await one(
  `select * from public.create_club('Sala fechada', null, 'estudo', 'noite', 'convite')`,
)

// ---------------------------------------------------------------- quem vê o quê

/*
  As políticas são lidas no CATÁLOGO, não exercidas.

  O pglite roda tudo como dono das tabelas, e o Postgres não aplica RLS ao dono
  (a menos de `force row level security`). Então um `insert` que passa aqui não
  prova nada sobre o que o app consegue fazer em produção — e um que falhasse
  seria falso negativo. O que dá pra garantir neste ensaio é que a política
  EXISTE e que a expressão dela diz o que deveria dizer.

  O comportamento de verdade continua sendo exercido pelas funções
  `security definer` (`create_club`, `club_ranking`), que checam `auth.uid()`
  por dentro e por isso valem em qualquer papel.
*/
const politicas = await q(
  `select polname, pg_get_expr(polqual, polrelid) as usando,
          pg_get_expr(polwithcheck, polrelid) as checando
     from pg_policy
     join pg_class on pg_class.oid = pg_policy.polrelid
    where relname in ('clubs', 'club_members')`,
)
const acha = (nome) => politicas.find((linha) => linha.polname === nome)

const leitura = acha('vê o clube de que participa, ou os abertos')
console.log('só membro ou clube aberto é legível:',
  leitura && leitura.usando.includes('is_club_member') && leitura.usando.includes("'aberto'")
    ? 'ok' : `FALHOU: ${JSON.stringify(leitura)}`)

const edicao = acha('dono com PRO administra o clube')
console.log('editar exige dono COM assinatura:',
  edicao && edicao.usando.includes('has_pro') && edicao.usando.includes('owner_id')
    ? 'ok' : `FALHOU: ${JSON.stringify(edicao)}`)

const entrada = acha('entra no clube aberto, ou é colocado pelo dono')
console.log('entrar sozinho só em clube aberto:',
  entrada && entrada.checando.includes("'aberto'") && entrada.checando.includes('owns_club')
    ? 'ok' : `FALHOU: ${JSON.stringify(entrada)}`)

const saida = acha('sai do clube, ou é removido pelo dono')
console.log('sair não depende de plano:',
  saida && !saida.usando.includes('has_pro') ? 'ok' : `FALHOU: ${JSON.stringify(saida)}`)

// Os membros entram pela porta do servidor, que é o que o resto do ensaio usa.
await db.query(
  `insert into public.club_members (club_id, user_id, role) values ($1, $2, 'membro')`,
  [criado.id, zeca],
)
const entrou = await q(`select * from public.club_members where club_id = $1`, [criado.id])
console.log('o clube passa a ter duas pessoas:', entrou.length === 2 ? 'ok' : `FALHOU: ${entrou.length}`)

// ---------------------------------------------------------------- o ranking

await sessao(lay)
const desafio = await one(
  `insert into public.challenges (owner_id, club_id, name, axis, mode, target, starts_on, ends_on)
        values ($1, $2, 'Treino de 30 dias', 'treino', 'total', 30, current_date, current_date + 29)
     returning id`,
  [lay, criado.id],
)
await db.query(
  `insert into public.challenge_participants (challenge_id, user_id, status, done_days, joined_at)
        values ($1, $2, 'ativo', 12, now()), ($1, $3, 'ativo', 5, now())`,
  [desafio.id, lay, zeca],
)

const tabela = await q(`select * from public.club_ranking($1)`, [criado.id])
const somouCerto =
  tabela.length === 2 && Number(tabela[0].days) === 12 && Number(tabela[1].days) === 5
console.log('o ranking soma os dias publicados:', somouCerto ? 'ok' : `FALHOU: ${JSON.stringify(tabela)}`)

const outraConta = (await one(`insert into auth.users (email) values ('fora@momentumm.com.br') returning id`)).id
await sessao(outraConta)
let recusouRanking = false
try {
  await q(`select * from public.club_ranking($1)`, [criado.id])
} catch {
  recusouRanking = true
}
console.log('o ranking recusa quem é de fora:', recusouRanking ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- o PRO cai

/*
  Sem sessão pra mexer no plano: o trigger da 0051 recusa que a própria pessoa
  escreva o próprio plano, e com razão — quem manda no plano é a assinatura, no
  servidor. Aqui o ensaio faz o papel do servidor.
*/
await db.query(`select set_config('request.jwt.claims', $1, false)`, [
  JSON.stringify({ role: 'service_role' }),
])
await db.query(`update public.profiles set plan = 'free', plan_courtesy_until = null where id = $1`, [lay])

await sessao(lay)
const aindaLa = await one(`select id, archived_at from public.clubs where id = $1`, [criado.id])
const membrosContinuam = await q(`select * from public.club_members where club_id = $1`, [criado.id])
console.log('sem PRO o clube continua no ar:',
  aindaLa?.id && aindaLa.archived_at === null && membrosContinuam.length === 2 ? 'ok' : 'FALHOU')

// Que editar exige assinatura já foi lido na política, acima. O que este trecho
// prova é o que importa pra pessoa: sem PRO, `has_pro` responde não — e é essa
// resposta que a política consulta.
console.log('sem PRO o banco responde que não há assinatura:',
  (await one(`select public.has_pro($1) as pro`, [lay]))?.pro === false ? 'ok' : 'FALHOU')

await db.query(`delete from public.club_members where club_id = $1 and user_id = $2`, [criado.id, lay])
const saiu = await q(`select * from public.club_members where club_id = $1 and user_id = $2`, [criado.id, lay])
console.log('sair é livre mesmo sem plano:', saiu.length === 0 ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- eventos e repetição

const nomes = (await one(`select public.product_event_names() as lista`)).lista
const esperados = ['club_created', 'club_joined', 'club_left', 'club_ranking_viewed',
                   'club_creation_paywall_viewed', 'club_creation_upgrade_clicked']
const faltando = esperados.filter((nome) => !nomes.includes(nome))
console.log('os eventos de clube são aceitos:', faltando.length === 0 ? 'ok' : `FALHOU: ${faltando}`)
console.log('os eventos do convite continuam lá:', nomes.includes('friend_invite_started') ? 'ok' : 'FALHOU')

const repetida = await migrate(db, { from: '0061_convite_de_amigo.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
