/*
  O lembrete da rotina na virada do dia (migration 0070).

  ## O bug

  A 0066 montava a janela do cron somando minutos a um `time`, e `time` não tem
  dia: `22:48 + 75min` vira `00:03`. A condição ficava `agora >= 22:48 AND agora
  < 00:03`, que é falsa pra qualquer hora do dia. Em produção isso significou
  que **nenhum lembrete marcado depois de mais ou menos 22h45 jamais disparou**,
  em silêncio, com o sino ligado na tela.

  ## Por que ele sobreviveu tanto tempo

  O teste da 0065/0066 monta os casos em relação a AGORA, então ele só encontra
  o problema se alguém rodar a suíte perto das onze da noite. Foi o que
  aconteceu, por sorte, numa rodada às 22h48.

  Um teste que depende da hora em que roda não prova regra nenhuma: ele sorteia.
  Por isso a regra virou `minutes_ahead`, uma função `immutable` que não lê
  relógio, e é ela que este arquivo cobra, com números fixos e as duas bordas.
*/
import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

for (const sinal of ['uncaughtException', 'unhandledRejection']) {
  process.on(sinal, (causa) => {
    console.log(`\nERRO ${sinal}: ${causa?.message ?? causa}`)
    process.exit(1)
  })
}

const db = await boot()
const falhas = await migrate(db, { stopOnError: true })
if (falhas.length) { console.log(falhas); process.exit(1) }

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

/** Minutos desde a meia-noite, pra os casos serem legíveis em horas. */
const min = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

const ahead = async (de, para) =>
  Number((await one(`select public.minutes_ahead($1, $2) as v`, [min(de), min(para)])).v)

// ---------------------------------------------------------------------------

console.log('\n## a distância pela frente, dando a volta no dia')

check('dentro do mesmo dia, é a subtração', (await ahead('07:00', '07:30')) === 30)
check('mesmo horário é zero', (await ahead('22:48', '22:48')) === 0)

check(
  'atravessando a meia-noite, conta pela frente e não pra trás',
  (await ahead('23:50', '00:10')) === 20,
  String(await ahead('23:50', '00:10')),
)
check(
  'o caso exato do bug: 22:48 pras 22:58',
  (await ahead('22:48', '22:58')) === 10,
)
check(
  'e o inverso é o resto do dia, nunca negativo',
  (await ahead('00:10', '23:50')) === 1420,
  String(await ahead('00:10', '23:50')),
)
check('a volta inteira nunca passa de 1439', (await ahead('00:01', '00:00')) === 1439)

const nulo = Number((await one(`select public.minutes_ahead(null, 600) as v`)).v)
check('argumento nulo não derruba a conta', nulo === 600, String(nulo))

console.log('\n## a janela do cron, montada com ela')

/*
  É a condição que a fila usa: `minutes_ahead(aviso, agora) < janela`. Com os
  números na mão, dá pra provar as duas bordas sem esperar a hora chegar.
*/
const naJanela = async (aviso, agora, janela = 75) =>
  (await ahead(aviso, agora)) < janela

check('na hora do aviso, entra', await naJanela('22:48', '22:48'))
check('um minuto depois, entra', await naJanela('22:48', '22:49'))
check(
  'setenta e quatro minutos depois, ainda entra (atravessando a meia-noite)',
  await naJanela('22:48', '00:02'),
)
check('setenta e cinco depois, sai', !(await naJanela('22:48', '00:03')))
check('antes da hora, fica de fora o dia inteiro', !(await naJanela('22:48', '22:30')))

check('aviso que vence às 23:55 pega o 00:05 seguinte', await naJanela('23:55', '00:05'))
check('e pega os 23:56 do mesmo dia', await naJanela('23:55', '23:56'))

console.log('\n## a regra vale em toda hora do dia, sem exceção')

/*
  A varredura que o teste por relógio nunca fez: pros 1440 minutos do dia, um
  aviso naquele minuto tem que entrar na janela naquele mesmo minuto. Era isso
  que quebrava depois das 22h45, e é isso que não pode voltar a quebrar.
*/
let buracos = 0
for (let minuto = 0; minuto < 1440; minuto += 1) {
  const agora = Number((await one(`select public.minutes_ahead($1, $1) as v`, [minuto])).v)
  const fim = Number(
    (await one(`select public.minutes_ahead($1, ($1 + 74) % 1440) as v`, [minuto])).v,
  )
  if (agora !== 0 || fim !== 74) buracos += 1
}
check('nenhum minuto do dia fica de fora da janela', buracos === 0, `${buracos} minutos com buraco`)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed === 0 ? 0 : 1)
