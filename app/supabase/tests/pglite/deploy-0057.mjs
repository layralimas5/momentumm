/*
  O deploy da 0057, ensaiado sobre o banco que já roda.

  Mesma pergunta do `deploy-0056`, e ela não é a do `db:test`: aplicar todas as
  migrations num banco vazio prova que o conjunto é coerente; aplicar só a nova
  sobre o estado anterior prova que ela SOBE. A segunda é a que acontece em
  produção.

  Aqui isso importa mais que de costume, porque a 0057 DERRUBA um índice único
  que é regra de dados desde a 0003. O que este ensaio confere:

    - a migration sobe sobre o estado de 0056, com dados dentro
    - o objetivo que já existia continua lá, intocado
    - o índice único sai e a guarda entra
    - o que era recusado antes passa a ser aceito pro PRO
    - rodar de novo não quebra nada (db push repetido, SQL colado duas vezes)
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0056_lembrete_contextual.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0056: ok')

/*
  Uma conta com objetivo, criada ANTES da migration. É ela que responde se o
  deploy mexeu em dado de quem já usa.
*/
const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
await db.query(
  `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
        values ($1, 'Terminar o curso', 'estudo', 100, current_date, current_date + 60)`,
  [lay],
)

const antes = await one(
  `select count(*)::int as c from public.objectives where user_id = $1`, [lay],
)

/* Antes da 0057 o índice único recusa o segundo objetivo no mesmo eixo. */
let recusouAntes = false
try {
  await db.query(
    `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
          values ($1, 'Criar meu curso', 'estudo', 100, current_date, current_date + 60)`,
    [lay],
  )
} catch {
  recusouAntes = true
}
console.log('antes da 0057 o segundo na área é recusado:', recusouAntes ? 'ok' : 'FALHOU')

const nova = await migrate(db, { from: '0056_lembrete_contextual.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0057 aplicada: ok')

const depois = await one(
  `select count(*)::int as c from public.objectives where user_id = $1`, [lay],
)
console.log('o objetivo de quem já usava continua lá:',
  depois.c === antes.c ? 'ok' : `FALHOU: ${antes.c} viraram ${depois.c}`)

const indice = await one(
  `select count(*)::int as c from pg_indexes
    where schemaname = 'public' and indexname = 'objectives_one_active_per_axis'`,
)
console.log('o índice único saiu:', indice.c === 0 ? 'ok' : 'FALHOU')

const guarda = await one(
  `select count(*)::int as c from pg_trigger
    where tgrelid = 'public.objectives'::regclass and tgname = 'objectives_plan_room'`,
)
console.log('a guarda entrou:', guarda.c === 1 ? 'ok' : 'FALHOU')

/* A conta é PRO pelo teste de 7 dias da 0034: o segundo na área passa a entrar. */
let aceitouDepois = true
try {
  await db.query(
    `insert into public.objectives (user_id, title, axis_slug, target, started_on, deadline)
          values ($1, 'Criar meu curso', 'estudo', 100, current_date, current_date + 60)`,
    [lay],
  )
} catch (cause) {
  aceitouDepois = false
  console.log(String(cause.message).slice(0, 140))
}
console.log('depois da 0057 o PRO abre a segunda frente:', aceitouDepois ? 'ok' : 'FALHOU')

const denovo = await migrate(db, { from: '0056_lembrete_contextual.sql', stopOnError: false })
console.log('aplicar de novo:', denovo.length === 0 ? 'ok, idempotente' : `FALHOU: ${JSON.stringify(denovo)}`)

const ok =
  recusouAntes && depois.c === antes.c && indice.c === 0 && guarda.c === 1 &&
  aceitouDepois && denovo.length === 0
process.exit(ok ? 0 : 1)
