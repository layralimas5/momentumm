/*
  Quem entra no painel, e quem abre qual chamado.

  Duas perguntas que o frontend não consegue responder, porque o frontend é
  contornável: esconder o item do menu e proteger a rota resolve o que a pessoa
  VÊ, e não o que ela CONSEGUE chamar. Uma sessão qualquer tem o token e a URL
  do PostgREST — se a recusa não estiver no banco, ela não existe.

  Os dois eixos são separados de propósito e o teste cobra isso:

    plano  (assinatura / cortesia / teste)  →  recursos PRO
    papel  (user_roles)                     →  painel administrativo

  Conta PRO sem papel não entra no painel. Conta com papel não ganha PRO por ter
  papel — ganha por `plan_courtesy_until`, que é dado gravado e auditável, não
  um `if` em cima do e-mail.
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

const semSessao = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)

/* Entra como a pessoa, pelo mesmo caminho do PostgREST: role + claims. */
const como = (user, aal = 'aal2') =>
  db.exec(
    `select set_config('role','authenticated',false);` +
    `select set_config('request.jwt.claims','${JSON.stringify({ sub: user, role: 'authenticated', aal })}',false)`,
  )

/** Roda e devolve o erro, ou `null` quando passou. */
async function tentar(sql, params = []) {
  try {
    await db.query(sql, params)
    return null
  } catch (cause) {
    return cause
  }
}

const novaConta = async (email) => {
  await semSessao()
  return (await one(`insert into auth.users (email) values ($1) returning id`, [email])).id
}

async function tornarGratuito(user) {
  await semSessao()
  await db.query(`update public.plan_trials set status = 'encerrado' where user_id = $1`, [user])
  await db.query(`select public.sync_plan_for_user($1)`, [user])
}

async function darPapel(user, papel) {
  await semSessao()
  await db.query(`insert into public.user_roles (user_id, role) values ($1, $2)`, [user, papel])
}

// ---------------------------------------------------------------------------

const lay = await novaConta('lay@momentumm.com.br')
await darPapel(lay, 'owner')

const ana = await novaConta('ana@momentumm.com.br')          // PRO comum, sem papel
const bia = await novaConta('bia@momentumm.com.br')          // gratuita
await tornarGratuito(bia)

console.log('\n## Os dois eixos são separados')

await semSessao()
check('a conta administrativa é PRO', (await one(`select public.plan_for_user($1) as p`, [lay])).p === 'pro')
check('a conta PRO comum é PRO', (await one(`select public.plan_for_user($1) as p`, [ana])).p === 'pro')
check('a conta gratuita é gratuita', (await one(`select public.plan_for_user($1) as p`, [bia])).p === 'free')

const papeis = await q(`select user_id from public.user_roles`)
check('só a conta administrativa tem papel', papeis.length === 1 && papeis[0].user_id === lay)

/*
  O que garante que "PRO" não nasce de papel: a conta PRO comum NÃO tem papel e
  continua PRO. Se PRO viesse do papel, a Ana seria gratuita.
*/
check('ser PRO não depende de ter papel', (await one(`select public.plan_for_user($1) as p`, [ana])).p === 'pro')

console.log('\n## O PRO da conta administrativa vem da cortesia, não do papel')

/*
  Decisão de produto, tomada de propósito: quem opera o Momentumm não vê "isso
  faz parte do PRO" dentro do próprio app. Hoje isso é UMA conta, a da fundadora.
  A 0051 implementa isso como CORTESIA — `plan_courtesy_until`, uma data gravada
  na linha do perfil — e não como um atalho de autorização.

  A diferença importa e é o que este bloco prova: `plan_for_user` nunca consulta
  `user_roles`. Ela olha assinatura, cortesia e teste. Tirar a cortesia derruba a
  conta pro gratuito mesmo com o papel intacto, e é isso que mantém os dois eixos
  separados: o papel abre o painel, a cortesia abre o PRO, e cada um sai sem
  tocar no outro.
*/
await semSessao()
const cortesia = await one(
  `select plan_courtesy_until::text as t from public.profiles where id = $1`,
  [lay],
)
check('a conta administrativa recebeu cortesia ao ganhar o papel', cortesia.t === 'infinity', String(cortesia.t))

/* Tira só a cortesia, mantendo o papel: se PRO viesse do papel, ela seguiria PRO. */
/*
  A cortesia tem guarda de escrita (`guard_profile_privileges`, 0034): ela só
  aceita a chave de sessão `momentumm.plan_sync`. No PGlite cada `query` é a
  própria transação, então a chave precisa ser de SESSÃO (`false`) — com `true`
  ela morre antes do update, e o próprio guard recusa. Que o guard recuse é
  ótimo, e é o que prova que ninguém mexe nisso de fora.
*/
await db.query(`select set_config('momentumm.plan_sync', '1', false)`)
await db.query(`update public.profiles set plan_courtesy_until = null where id = $1`, [lay])
await db.query(`select set_config('momentumm.plan_sync', '', false)`)
await db.query(`update public.plan_trials set status = 'encerrado' where user_id = $1`, [lay])

check('o papel continua lá', (await q(`select 1 from public.user_roles where user_id = $1`, [lay])).length === 1)
check(
  'mas sem cortesia a conta cai pro gratuito',
  (await one(`select public.plan_for_user($1) as p`, [lay])).p === 'free',
)

await como(lay)
const aindaAdmin = await one(`select public.admin_me() as me`)
check(
  'e o painel continua aberto pra ela: papel não é plano',
  aindaAdmin.me.role === 'owner',
  JSON.stringify(aindaAdmin.me),
)

/* Devolve a cortesia: o resto do arquivo conta com a conta administrativa em PRO. */
await semSessao()
await db.query(`select set_config('momentumm.plan_sync', '1', false)`)
await db.query(`update public.profiles set plan_courtesy_until = 'infinity' where id = $1`, [lay])
await db.query(`select set_config('momentumm.plan_sync', '', false)`)
await db.query(`select public.sync_plan_for_user($1)`, [lay])
check(
  'cortesia devolvida, conta administrativa em PRO de novo',
  (await one(`select public.plan_for_user($1) as p`, [lay])).p === 'pro',
)

console.log('\n## O painel, com cada uma das três contas')

/* `admin_me` é a leitura que a tela usa pra decidir se mostra o painel. */
await como(lay)
const meLay = await one(`select public.admin_me() as me`)
check('a conta administrativa se vê como admin', meLay.me.role === 'owner', JSON.stringify(meLay.me))

await como(ana)
const meAna = await one(`select public.admin_me() as me`)
check('a conta PRO comum não tem papel nenhum', !meAna.me.role, JSON.stringify(meAna.me))

await como(bia)
const meBia = await one(`select public.admin_me() as me`)
check('a conta gratuita não tem papel nenhum', !meBia.me.role, JSON.stringify(meBia.me))

console.log('\n## Chamar a operação administrativa direto, sem passar pela tela')

/*
  É este o cenário que a tela não cobre: a pessoa abre o console, chama a função
  pelo cliente do Supabase que a própria página já carregou, e nenhuma rota do
  React participa disso.
*/
for (const [quem, conta] of [['PRO comum', ana], ['gratuita', bia]]) {
  await como(conta)
  const listar = await tentar(`select public.admin_list_users(null, null, 1, 20)`)
  check(`a conta ${quem} não lista usuários`, listar !== null,
    listar ? '' : 'passou, e não devia')

  const config = await tentar(
    `select public.admin_set_setting('plans.free', '{"activeObjectives": 99}'::jsonb, 'teste')`,
  )
  check(`a conta ${quem} não muda configuração de produto`, config !== null,
    config ? '' : 'passou, e não devia')

  const papel = await tentar(`select public.admin_grant_role($1, 'admin', 'teste')`, [conta])
  check(`a conta ${quem} não se promove a admin`, papel !== null,
    papel ? '' : 'passou, e não devia')
}

/* E a tabela de papéis não aceita escrita direta de ninguém. */
await como(ana)
const escrever = await tentar(
  `insert into public.user_roles (user_id, role) values ($1, 'admin')`, [ana],
)
check('ninguém insere o próprio papel na tabela', escrever !== null,
  escrever ? '' : 'inseriu, e não devia')

await semSessao()
check('e o papel não apareceu', (await q(`select 1 from public.user_roles where user_id = $1`, [ana])).length === 0)

console.log('\n## Ninguém se promove a PRO sozinho')

/*
  Antes de qualquer regra "isto é do PRO" valer alguma coisa, uma pergunta
  precisa estar respondida: dá pra conta se declarar PRO? Se der, todo o resto é
  decoração — o servidor recusa a categoria, a pessoa vira PRO e pede de novo.

  São cinco portas, e o teste cobre as cinco. Duas recusam com erro; as outras
  recusam em SILÊNCIO, afetando zero linhas pela política de RLS, e é por isso
  que aqui não basta olhar se deu exceção: tem que olhar o estado depois.
*/
const cobaia = await novaConta('cobaia@momentumm.com.br')
await tornarGratuito(cobaia)
await como(cobaia)

const plano = await tentar(`update public.profiles set plan = 'pro' where id = $1`, [cobaia])
check('não dá pra escrever o próprio plano', plano !== null,
  plano ? '' : 'passou, e não devia')

const cortesiaPropria = await tentar(
  `update public.profiles set plan_courtesy_until = 'infinity' where id = $1`, [cobaia],
)
check('não dá pra se dar cortesia', cortesiaPropria !== null,
  cortesiaPropria ? '' : 'passou, e não devia')

await tentar(`insert into public.plan_trials (user_id, status, ends_at)
                   values ($1, 'ativo', now() + interval '30 days')`, [cobaia])
await tentar(`update public.plan_trials set status = 'ativo', ends_at = now() + interval '30 days'
                where user_id = $1`, [cobaia])
for (const estado of ['trial', 'ativa']) {
  await tentar(`insert into public.subscriptions (user_id, status) values ($1, $2)`, [cobaia, estado])
}
await tentar(`update public.subscriptions set status = 'ativa' where user_id = $1`, [cobaia])

/*
  O veredito é o ESTADO, não a ausência de exceção: um `update` barrado pela
  política não levanta erro, ele só não muda nada.
*/
await semSessao()
check('depois das cinco tentativas a conta continua gratuita',
  (await one(`select public.plan_for_user($1) as p`, [cobaia])).p === 'free')
check('e o cache do perfil também',
  (await one(`select plan from public.profiles where id = $1`, [cobaia])).plan === 'free')
check('nenhum teste ativo apareceu',
  (await q(`select 1 from public.plan_trials where user_id = $1 and status = 'ativo'`, [cobaia])).length === 0)
check('nenhuma assinatura apareceu',
  (await q(`select 1 from public.subscriptions where user_id = $1`, [cobaia])).length === 0)

console.log('\n## A área escolhida é a área gravada')

/*
  O bug era de tela, e a correção também — mas "gravou certo" é pergunta de
  banco. Um objetivo criado em treino tem que voltar em treino: se a ida e a
  volta discordassem, a tela consertada continuaria mostrando a área errada ao
  reabrir o objetivo.
*/
await como(cobaia)
await db.query(
  `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
        values ($1, 'Sair do sedentarismo', 'treino', 100, current_date, current_date + 60)`,
  [cobaia],
)
const gravado = await one(
  `select axis_slug from public.objectives where user_id = $1 and title = 'Sair do sedentarismo'`,
  [cobaia],
)
check('o eixo volta igual ao que entrou', gravado.axis_slug === 'treino', String(gravado.axis_slug))

/* E a política não deixa a conta ver objetivo de outra pessoa. */
const alheios = await q(`select 1 from public.objectives where user_id <> $1`, [cobaia])
check('a conta não enxerga objetivo de ninguém mais', alheios.length === 0, String(alheios.length))

console.log('\n## Suporte: o que é do PRO e o que é direito')

const abrir = (categoria) =>
  tentar(`select public.open_support_request($1, 'Assunto de teste', 'Descrição de teste')`, [categoria])

await como(bia)
const ajudaFree = await abrir('suporte')
check('o gratuito não abre "ajuda com o app"', ajudaFree !== null)
check('e a recusa é 22023, que sobe com o texto pra tela',
  ajudaFree && ajudaFree.code === '22023', ajudaFree && ajudaFree.code)
check('a mensagem diz o que AINDA dá pra fazer',
  ajudaFree && /cobran|privacidade|exclus/i.test(ajudaFree.message),
  ajudaFree && String(ajudaFree.message).slice(0, 160))

/*
  O bloco que não pode quebrar nunca: sem estas, o gratuito fica sem caminho pra
  apagar a conta, levar os dados embora, reclamar de cobrança ou relatar uma
  falha de segurança. Nenhuma delas é benefício de plano.
*/
for (const categoria of ['exclusao', 'exportacao', 'privacidade', 'seguranca']) {
  const erro = await abrir(categoria)
  check(`o gratuito abre "${categoria}"`, erro === null,
    erro ? String(erro.message).slice(0, 120) : '')
}

/* Quinta do dia: o teto de cinco por dia é de 0025 e continua valendo. */
const quinta = await abrir('acesso')
check('o gratuito abre "acesso" (quinta do dia)', quinta === null,
  quinta ? String(quinta.message).slice(0, 120) : '')

await como(ana)
check('o PRO abre "ajuda com o app"', (await abrir('suporte')) === null)

await como(lay)
check('a conta administrativa também abre, por ser PRO', (await abrir('suporte')) === null)

console.log('\n## A recusa do suporte não vem do papel')

/*
  Se "ajuda com o app" dependesse de papel em vez de plano, a Ana (PRO sem
  papel) seria recusada. Ela não é — e é isso que mantém os dois eixos separados.
*/
await como(ana)
check('PRO sem papel continua abrindo', (await abrir('suporte')) === null)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed === 0 ? 0 : 1)
