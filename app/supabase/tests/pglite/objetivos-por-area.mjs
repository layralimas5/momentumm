/*
  Quantos objetivos cabem na mesma área, provado no banco.

  O teste existe por causa de um beco sem saída real: "um objetivo ativo por
  eixo" era um índice único (`objectives_one_active_per_axis`, 0003) e valia pra
  todo mundo, inclusive pra quem paga. Numa conta com objetivo em todas as áreas
  de fábrica, o diálogo de objetivo novo abria preso em "Leitura" — cartão
  desabilitado, botão desabilitado, nenhuma saída oferecida.

  Tirar um índice único e pôr trigger no lugar é a parte arriscada da 0057, e é
  ela que este arquivo cobre:

    - o PRO cria quatro objetivos na MESMA área, e os quatro ficam ativos
    - o gratuito continua com um por área
    - o gratuito continua com o teto de DOIS objetivos em andamento
    - pausar libera a vaga do plano e NÃO libera a vaga do eixo
    - o objetivo que virou PRO não desaparece quando a conta volta pro gratuito
    - os códigos de erro são os que o app traduz: 23505 na área, 22023 no teto

  Os códigos não são cosmética. `supabase-repositories.ts` transforma 23505 em
  `ObjectiveAxisConflictError` (com o eixo junto, que é o que faz a tela mostrar
  quem ocupa o lugar) e 22023 em `PlanLimitError` (que oferece assinar). Trocar
  um código aqui devolve a ativação do plano do quiz pro beco sem saída.
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

/* Cria um objetivo e devolve o erro, ou `null` quando entrou. */
async function criar(user, axis, titulo) {
  try {
    await db.query(
      `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
            values ($1, $2, $3, 100, current_date, current_date + 60)`,
      [user, titulo, axis],
    )
    return null
  } catch (cause) {
    return cause
  }
}

const ativos = async (user, axis) =>
  (await one(
    `select count(*)::int as c from public.objectives
      where user_id = $1 and axis_slug = $2 and archived_at is null`,
    [user, axis],
  )).c

/*
  Conta nova nasce PRO pelo teste de 7 dias (0034). Pra ter uma conta gratuita de
  verdade o teste precisa ser encerrado — sem isso "o gratuito" deste arquivo
  seria um PRO disfarçado, e todas as recusas esperadas passariam a não vir.
*/
async function tornarGratuito(user) {
  await db.query(`update public.plan_trials set status = 'encerrado' where user_id = $1`, [user])
  await db.query(`select public.sync_plan_for_user($1)`, [user])
}

const novaConta = async (email) =>
  (await one(`insert into auth.users (email) values ($1) returning id`, [email])).id

console.log('\n## O teto virou configuração')

const free = await one(`select value from public.product_settings where key = 'plans.free'`)
const pro = await one(`select value from public.product_settings where key = 'plans.pro'`)
check('o gratuito tem um objetivo por área', Number(free.value.objectivesPerAxis) === 1,
  JSON.stringify(free.value.objectivesPerAxis))
check('o PRO não tem teto por área', pro.value.objectivesPerAxis === null,
  JSON.stringify(pro.value.objectivesPerAxis))
check('o teto de objetivos ativos do gratuito continua dois',
  Number(free.value.activeObjectives) === 2, JSON.stringify(free.value.activeObjectives))

/* O painel precisa conseguir MEXER nesse número, senão ele não é configuração. */
let validou = true
try {
  await db.exec(`select public.validate_setting('plans.free', '{"objectivesPerAxis": 3}'::jsonb)`)
} catch (cause) {
  validou = false
  console.log(String(cause.message).slice(0, 140))
}
check('o validador aceita a chave nova', validou)

console.log('\n## O índice único saiu e a guarda entrou')

const indice = await one(
  `select count(*)::int as c from pg_indexes
    where schemaname = 'public' and indexname = 'objectives_one_active_per_axis'`,
)
check('o índice único não existe mais', indice.c === 0)

const guarda = await one(
  `select count(*)::int as c from pg_trigger
    where tgrelid = 'public.objectives'::regclass and tgname = 'objectives_plan_room'`,
)
check('o trigger de plano está no lugar', guarda.c === 1)

console.log('\n## PRO: várias frentes na mesma área')

const lay = await novaConta('lay-pro@momentumm.com.br')
check('a conta de teste é PRO', (await one(`select public.plan_for_user($1) as p`, [lay])).p === 'pro')

const frentes = ['Lançar meu aplicativo', 'Criar meu curso', 'Aumentar faturamento', 'Construir meu portfólio']
const erros = []
for (const titulo of frentes) {
  const erro = await criar(lay, 'estudo', titulo)
  if (erro) erros.push([titulo, String(erro.message).slice(0, 120)])
}
check('as quatro frentes entraram na mesma área', erros.length === 0, JSON.stringify(erros))
check('as quatro continuam ativas', (await ativos(lay, 'estudo')) === 4, String(await ativos(lay, 'estudo')))

/* E não é só a área: o PRO também não tem teto de quantidade. */
const outra = await criar(lay, 'treino', 'Sair do sedentarismo')
check('o PRO passa do teto de dois objetivos', outra === null,
  outra ? String(outra.message).slice(0, 120) : '')

console.log('\n## Gratuito: a regra de antes, inteira')

const ana = await novaConta('ana-free@momentumm.com.br')
await tornarGratuito(ana)
check('a conta de teste é gratuita', (await one(`select public.plan_for_user($1) as p`, [ana])).p === 'free')

check('o primeiro objetivo da área entra', (await criar(ana, 'leitura', 'Voltar a ler')) === null)

const segundoNaArea = await criar(ana, 'leitura', 'Ler mais um')
check('o segundo objetivo da MESMA área é recusado', segundoNaArea !== null)
check('e recusado com 23505, que a tela traduz em conflito de área',
  segundoNaArea && segundoNaArea.code === '23505', segundoNaArea && segundoNaArea.code)
check('a mensagem oferece a saída, não só o erro',
  segundoNaArea && /PRO/.test(segundoNaArea.message),
  segundoNaArea && String(segundoNaArea.message).slice(0, 140))

check('o segundo objetivo em OUTRA área entra', (await criar(ana, 'treino', 'Sair do sedentarismo')) === null)

const terceiro = await criar(ana, 'meditacao', 'Dez minutos de silêncio')
check('o terceiro objetivo estoura o teto do plano', terceiro !== null)
check('e estoura com 22023, que a tela traduz em limite de plano',
  terceiro && terceiro.code === '22023', terceiro && terceiro.code)

console.log('\n## As duas janelas de contagem, que são diferentes de propósito')

/*
  Pausar libera a vaga do PLANO e não libera a vaga do EIXO.

  `activeObjectives` sempre contou só o que está em andamento — pausar é como a
  pessoa abre espaço sem apagar. A vaga do eixo é outra pergunta: o objetivo
  pausado continua somando das mesmas atividades, então o progresso de dois no
  mesmo eixo continuaria ambíguo. Um servidor com uma janela só recusaria o que a
  tela oferece, ou ofereceria o que a tela recusa.
*/
await db.query(`update public.objectives set paused_at = now()
                 where user_id = $1 and axis_slug = 'treino'`, [ana])

check('pausar libera a vaga do plano', (await criar(ana, 'meditacao', 'Dez minutos de silêncio')) === null)

const naAreaPausada = await criar(ana, 'treino', 'Outro treino')
check('pausar NÃO libera a vaga da área', naAreaPausada !== null,
  naAreaPausada ? '' : 'entrou, e não devia')
check('e a recusa da área pausada também é 23505',
  naAreaPausada && naAreaPausada.code === '23505', naAreaPausada && naAreaPausada.code)

/*
  Arquivar libera as duas vagas: é o que a tela oferece quando a área está cheia.

  Vai numa conta nova de propósito. Na da Ana o terceiro objetivo esbarraria no
  teto de DOIS em andamento, e o teste passaria a provar o limite errado — foi o
  que aconteceu na primeira versão deste arquivo.
*/
const cris = await novaConta('cris-free@momentumm.com.br')
await tornarGratuito(cris)
await criar(cris, 'leitura', 'Voltar a ler')
check('a área cheia recusa', (await criar(cris, 'leitura', 'Ler outro')) !== null)
await db.query(`update public.objectives set archived_at = now()
                 where user_id = $1 and axis_slug = 'leitura'`, [cris])
check('arquivar libera a vaga da área', (await criar(cris, 'leitura', 'Ler de novo')) === null)

console.log('\n## Descer de PRO pro gratuito não apaga nada')

await tornarGratuito(lay)
check('a conta virou gratuita', (await one(`select public.plan_for_user($1) as p`, [lay])).p === 'free')
check('as quatro frentes continuam lá', (await ativos(lay, 'estudo')) === 4,
  String(await ativos(lay, 'estudo')))

const depois = await criar(lay, 'estudo', 'Mais uma frente')
check('mas criar a quinta é recusado', depois !== null)

console.log('\n## Desarquivar também passa pela guarda')

/*
  Não existe fluxo de desarquivar no app hoje. O gatilho de UPDATE existe
  justamente por isso: o dia em que existir, ninguém vai lembrar de vir checar
  o teto aqui.
*/
const bia = await novaConta('bia-free@momentumm.com.br')
await tornarGratuito(bia)
/*
  A linha arquivada entra ANTES da ativa. Objetivo que já nasce arquivado não
  consome vaga — se consumisse, nem este cenário conseguiria ser montado, e um
  restore de histórico seria recusado em produção pelo mesmo motivo.
*/
await db.query(
  `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline, archived_at)
        values ($1, 'Leitura antiga', 'leitura', 100, current_date, current_date + 60, now())`,
  [bia],
)
check('objetivo que nasce arquivado não é barrado',
  (await one(`select count(*)::int as c from public.objectives
               where user_id = $1 and archived_at is not null`, [bia])).c === 1)
await criar(bia, 'leitura', 'Ler todo dia')

let desarquivou = null
try {
  await db.query(`update public.objectives set archived_at = null
                   where user_id = $1 and title = 'Leitura antiga'`, [bia])
} catch (cause) {
  desarquivou = cause
}
check('desarquivar na área ocupada é recusado', desarquivou !== null)
check('e com o mesmo 23505', desarquivou && desarquivou.code === '23505',
  desarquivou && desarquivou.code)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed === 0 ? 0 : 1)
