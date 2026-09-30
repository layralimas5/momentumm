/*
  O deploy da 0063, ensaiado sobre o banco que já roda.

  A migration traz as duas portas do convite de clube. O que este ensaio
  confere é o que dá pra quebrar:

    - a migration sobe sobre o estado de 0062, com clubes e membros dentro
    - convidar exige dono COM assinatura, e a recusa tem o código da tela
    - convidar NÃO coloca ninguém dentro: cria um convite pendente
    - reconvidar reaproveita a linha em vez de empilhar avisos
    - quem já é membro não é convidado
    - a caixa de convites mostra nome do clube e de quem chamou
    - aceitar entra no clube; recusar não entra
    - só quem recebeu responde
    - o link nasce uma vez e volta igual; girar troca e mata o anterior
    - a prévia do link fala com quem não tem sessão, e não entrega membro nenhum
    - o link entra em clube POR CONVITE, que é a diferença pra política da 0062
    - entrar pelo link encerra o convite nominal pendente
    - rodar de novo não quebra nada
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0062_clubes.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0062: ok')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@momentumm.com.br') returning id`)).id
const zeca = (await one(`insert into auth.users (email) values ('zeca@momentumm.com.br') returning id`)).id

// Quem escreve plano é o servidor (trigger da 0051): o ensaio assume esse papel.
await db.query(`select set_config('request.jwt.claims', $1, false)`, [
  JSON.stringify({ role: 'service_role' }),
])
await db.query(`update public.profiles set plan = 'pro' where id = $1`, [lay])
await db.query(`update public.profiles set plan = 'free', plan_courtesy_until = null
                 where id = any($1::uuid[])`, [[bia, zeca]])
await db.query(`update public.profiles set name = 'Layra Lima' where id = $1`, [lay])
await db.query(`select set_config('request.jwt.claims', '', false)`)

async function sessao(userId) {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
}

await sessao(lay)
const fechado = await one(
  `select * from public.create_club('Leitura de manhã', 'Vinte minutos', 'leitura', 'aurora', 'convite')`,
)

const nova = await migrate(db, { from: '0062_clubes.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0063 aplicada: ok')

// ---------------------------------------------------------------- convidar

await sessao(bia)
let recusouEstranho = false
try {
  await q(`select public.invite_to_club($1, $2)`, [fechado.id, zeca])
} catch (erro) {
  recusouEstranho = erro.code === '42501'
}
console.log('quem não é dono não convida:', recusouEstranho ? 'ok' : 'FALHOU')

await sessao(lay)
const convite = await one(`select * from public.invite_to_club($1, $2)`, [fechado.id, bia])
console.log('o dono com PRO convida:',
  convite?.status === 'pendente' ? 'ok' : `FALHOU: ${JSON.stringify(convite)}`)

const dentroAinda = await q(
  `select * from public.club_members where club_id = $1 and user_id = $2`, [fechado.id, bia],
)
console.log('convidar NÃO coloca ninguém dentro:', dentroAinda.length === 0 ? 'ok' : 'FALHOU')

await q(`select public.invite_to_club($1, $2)`, [fechado.id, bia])
const quantos = await q(
  `select * from public.club_invitations where club_id = $1 and invitee_id = $2`, [fechado.id, bia],
)
console.log('reconvidar reaproveita a linha:', quantos.length === 1 ? 'ok' : `FALHOU: ${quantos.length}`)

let recusouMembro = false
try {
  await q(`select public.invite_to_club($1, $2)`, [fechado.id, lay])
} catch (erro) {
  recusouMembro = erro.code === '23505'
}
console.log('quem já está dentro não é convidado:', recusouMembro ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- a caixa

await sessao(bia)
const caixa = await q(`select * from public.my_club_invitations()`)
const primeiro = caixa[0]
console.log('a caixa traz clube e quem chamou:',
  caixa.length === 1 && primeiro.club_name === 'Leitura de manhã' && primeiro.inviter_name === 'Layra Lima'
    ? 'ok' : `FALHOU: ${JSON.stringify(caixa)}`)

await sessao(zeca)
console.log('a caixa de quem não foi chamado é vazia:',
  (await q(`select * from public.my_club_invitations()`)).length === 0 ? 'ok' : 'FALHOU')

let recusouResposta = false
try {
  await q(`select public.respond_club_invitation($1, true)`, [convite.id])
} catch (erro) {
  recusouResposta = erro.code === '42501'
}
console.log('só quem recebeu responde:', recusouResposta ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- recusar e aceitar

await sessao(bia)
await q(`select public.respond_club_invitation($1, false)`, [convite.id])
const depoisDoNao = await q(
  `select * from public.club_members where club_id = $1 and user_id = $2`, [fechado.id, bia],
)
const marcado = await one(`select status from public.club_invitations where id = $1`, [convite.id])
console.log('recusar não entra e fica marcado:',
  depoisDoNao.length === 0 && marcado.status === 'recusado' ? 'ok' : 'FALHOU')

await sessao(lay)
const denovo = await one(`select * from public.invite_to_club($1, $2)`, [fechado.id, bia])
await sessao(bia)
await q(`select public.respond_club_invitation($1, true)`, [denovo.id])
const agoraDentro = await q(
  `select role from public.club_members where club_id = $1 and user_id = $2`, [fechado.id, bia],
)
console.log('aceitar entra no clube:',
  agoraDentro[0]?.role === 'membro' ? 'ok' : `FALHOU: ${JSON.stringify(agoraDentro)}`)

console.log('respondido some da caixa:',
  (await q(`select * from public.my_club_invitations()`)).length === 0 ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- o link

await sessao(zeca)
let recusouToken = false
try {
  await q(`select public.club_invite_token($1, false)`, [fechado.id])
} catch (erro) {
  recusouToken = erro.code === '42501'
}
console.log('o link é do dono:', recusouToken ? 'ok' : 'FALHOU')

await sessao(lay)
const token = (await one(`select public.club_invite_token($1, false) as t`, [fechado.id])).t
const mesmo = (await one(`select public.club_invite_token($1, false) as t`, [fechado.id])).t
console.log('o link nasce uma vez e volta igual:',
  typeof token === 'string' && token.length === 32 && token === mesmo ? 'ok' : `FALHOU: ${token} / ${mesmo}`)

const girado = (await one(`select public.club_invite_token($1, true) as t`, [fechado.id])).t
const vivos = await q(`select token from public.club_invite_links where club_id = $1`, [fechado.id])
console.log('girar troca e mata o anterior:',
  girado !== token && vivos.length === 1 && vivos[0].token === girado ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- a prévia

await db.query(`select set_config('request.jwt.claims', '', false)`)
const semSessao = (await one(`select public.club_invite_preview($1) as p`, [girado])).p
console.log('a prévia fala com quem não tem conta:',
  semSessao.status === 'valido' && semSessao.name === 'Leitura de manhã' && semSessao.can_join === false
    ? 'ok' : `FALHOU: ${JSON.stringify(semSessao)}`)
console.log('a prévia não entrega membro nenhum:',
  semSessao.members === 2 && !JSON.stringify(semSessao).includes(lay) ? 'ok' : `FALHOU: ${JSON.stringify(semSessao)}`)

const inventado = (await one(`select public.club_invite_preview('naoexiste') as p`)).p
console.log('token inventado é inválido:', inventado.status === 'invalido' ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- entrar pelo link

await sessao(lay)
const pendente = await one(`select * from public.invite_to_club($1, $2)`, [fechado.id, zeca])

await sessao(zeca)
const clubeDoLink = (await one(`select public.join_club_by_token($1) as c`, [girado])).c
const entrouPeloLink = await q(
  `select role from public.club_members where club_id = $1 and user_id = $2`, [fechado.id, zeca],
)
console.log('o link entra em clube POR CONVITE:',
  clubeDoLink === fechado.id && entrouPeloLink[0]?.role === 'membro' ? 'ok' : 'FALHOU')

const encerrado = await one(`select status from public.club_invitations where id = $1`, [pendente.id])
console.log('entrar pelo link encerra o convite pendente:',
  encerrado.status === 'aceito' ? 'ok' : `FALHOU: ${encerrado.status}`)

const denovoNoLink = (await one(`select public.join_club_by_token($1) as c`, [girado])).c
console.log('abrir o link duas vezes não é erro:', denovoNoLink === fechado.id ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- políticas e eventos

const politicas = await q(
  `select polname, pg_get_expr(polqual, polrelid) as usando
     from pg_policy
     join pg_class on pg_class.oid = pg_policy.polrelid
    where relname = 'club_invitations'`,
)
const leitura = politicas.find((linha) => linha.polname.startsWith('vê o convite'))
console.log('só as duas pontas leem o convite:',
  leitura && leitura.usando.includes('invitee_id') && leitura.usando.includes('owns_club')
    ? 'ok' : `FALHOU: ${JSON.stringify(politicas)}`)

const escrita = await q(
  `select polcmd from pg_policy
     join pg_class on pg_class.oid = pg_policy.polrelid
    where relname = 'club_invitations' and polcmd in ('a', 'w')`,
)
console.log('não há porta direta de escrita no convite:', escrita.length === 0 ? 'ok' : 'FALHOU')

const semPolitica = await q(
  `select polname from pg_policy
     join pg_class on pg_class.oid = pg_policy.polrelid
    where relname = 'club_invite_links'`,
)
console.log('o link não é legível por fora das funções:', semPolitica.length === 0 ? 'ok' : 'FALHOU')

const nomes = (await one(`select public.product_event_names() as lista`)).lista
const esperados = ['club_invite_sent', 'club_invite_accepted', 'club_invite_declined',
                   'club_invite_link_created', 'club_invite_link_opened']
const faltando = esperados.filter((nome) => !nomes.includes(nome))
console.log('os eventos do convite de clube são aceitos:', faltando.length === 0 ? 'ok' : `FALHOU: ${faltando}`)
console.log('os eventos da 0062 continuam lá:', nomes.includes('club_ranking_viewed') ? 'ok' : 'FALHOU')

const repetida = await migrate(db, { from: '0062_clubes.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
