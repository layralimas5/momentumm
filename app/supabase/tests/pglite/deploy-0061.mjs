/*
  O deploy da 0061, ensaiado sobre o banco que já roda.

  A migration guarda de onde cada conta veio (`referrals`) e libera os eventos
  do funil de convite. O que este ensaio confere é o que dá pra quebrar:

    - a migration sobe sobre o estado de 0060, com contas dentro
    - o convite registra a origem uma vez
    - a segunda tentativa não reescreve a origem
    - ninguém se convida
    - @ que não existe não vira erro na cara de quem acabou de entrar
    - conta velha não recebe atribuição nova
    - os eventos novos são aceitos e um nome inventado continua recusado
    - rodar de novo não quebra nada
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0060_perfil_social_e_album_do_dia.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0060: ok')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@momentumm.com.br') returning id`)).id
const velha = (await one(`insert into auth.users (email) values ('velha@momentumm.com.br') returning id`)).id

await db.query(`update public.profiles set handle = 'layra' where id = $1`, [lay])
await db.query(`update public.profiles set handle = 'bia' where id = $1`, [bia])
// Uma conta que já existia muito antes do convite.
await db.query(`update public.profiles set created_at = now() - interval '200 days' where id = $1`, [velha])

const nova = await migrate(db, { from: '0060_perfil_social_e_album_do_dia.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0061 aplicada: ok')

/*
  `register_referral` lê `auth.uid()`, que não existe fora de uma sessão do
  PostgREST. O ensaio finge a sessão pelo GUC que o Supabase usa, que é o que
  `auth.uid()` lê por baixo.
*/
async function comoSessaoDe(userId, sql, params = []) {
  // `false` no terceiro parâmetro: com `true` o valor vale só até o fim da
  // transação, e cada consulta aqui roda na sua. A sessão precisa sobreviver
  // à próxima linha do ensaio.
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  return q(sql, params)
}

const primeira = await comoSessaoDe(bia, `select public.register_referral('layra') as ok`)
console.log('o convite registra a origem:', primeira[0]?.ok === true ? 'ok' : `FALHOU: ${JSON.stringify(primeira)}`)

const denovo = await comoSessaoDe(bia, `select public.register_referral('layra') as ok`)
console.log('a segunda vez não reescreve:', denovo[0]?.ok === false ? 'ok' : `FALHOU: ${JSON.stringify(denovo)}`)

const euMesma = await comoSessaoDe(lay, `select public.register_referral('layra') as ok`)
console.log('ninguém se convida:', euMesma[0]?.ok === false ? 'ok' : `FALHOU: ${JSON.stringify(euMesma)}`)

const inexistente = await comoSessaoDe(lay, `select public.register_referral('ninguem_aqui') as ok`)
console.log('@ que não existe não explode:', inexistente[0]?.ok === false ? 'ok' : `FALHOU: ${JSON.stringify(inexistente)}`)

const antiga = await comoSessaoDe(velha, `select public.register_referral('layra') as ok`)
console.log('conta velha não recebe origem nova:', antiga[0]?.ok === false ? 'ok' : `FALHOU: ${JSON.stringify(antiga)}`)

const linhas = await q(`select invitee_id, inviter_id from public.referrals`)
const atribuiuCerto = linhas.length === 1 && linhas[0].invitee_id === bia && linhas[0].inviter_id === lay
console.log('uma linha, na direção certa:', atribuiuCerto ? 'ok' : `FALHOU: ${JSON.stringify(linhas)}`)

// ---------------------------------------------------------------- eventos

const nomes = (await one(`select public.product_event_names() as lista`)).lista
const esperados = [
  'friend_invite_started',
  'friend_invite_shared',
  'friend_invite_opened',
  'friend_invite_accepted',
  'friend_added',
  'friend_ranking_viewed',
  'free_friend_limit_reached',
]
const faltando = esperados.filter((nome) => !nomes.includes(nome))
console.log('os eventos do convite são aceitos:', faltando.length === 0 ? 'ok' : `FALHOU: ${faltando}`)
console.log('os eventos antigos continuam lá:', nomes.includes('pair_created') ? 'ok' : 'FALHOU')

let recusouInventado = false
try {
  await comoSessaoDe(lay, `select public.track_event('evento_que_nao_existe', null, '{}'::jsonb)`)
} catch {
  recusouInventado = true
}
console.log('nome de evento inventado é recusado:', recusouInventado ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- de novo

const repetida = await migrate(db, { from: '0060_perfil_social_e_album_do_dia.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
