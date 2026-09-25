/*
  O deploy da 0059, ensaiado sobre o banco que já roda.

  A migration acrescenta `activities.started_at`: o instante em que a sessão de
  foco começou. É uma coluna nova numa tabela que já tem o histórico de todo
  mundo, então o que este ensaio confere é justamente o que dá pra quebrar num
  deploy assim:

    - a migration sobe sobre o estado de 0058, com dados dentro
    - o registro que já existia continua lá, agora com início nulo
    - sessão nova grava início e fim
    - início depois do fim é recusado pelo banco, não só pela tela
    - rodar de novo não quebra nada (db push repetido, SQL colado duas vezes)
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0058_suporte_do_produto_no_pro.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0058: ok')

/* Uma conta com um registro feito ANTES da migration. */
const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
await db.query(
  `insert into public.activities (user_id, type_slug, value, unit, duration_min, day, occurred_at)
        values ($1, 'estudo', 30, 'minutos', 30, current_date, now())`,
  [lay],
)

const nova = await migrate(db, { from: '0058_suporte_do_produto_no_pro.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0059 aplicada: ok')

const antigo = await one(
  `select started_at from public.activities where user_id = $1`, [lay],
)
console.log('o registro de quem já usava continua lá, sem início:',
  antigo && antigo.started_at === null ? 'ok' : `FALHOU: ${JSON.stringify(antigo)}`)

/* Sessão nova: começo e fim, os dois no banco. */
await db.query(
  `insert into public.activities
          (user_id, type_slug, value, unit, duration_min, day, started_at, occurred_at, source)
        values ($1, 'estudo', 25, 'minutos', 25, current_date,
                now() - interval '25 minutes', now(), 'timer')`,
  [lay],
)
const sessao = await one(
  `select started_at, occurred_at from public.activities
    where user_id = $1 and source = 'timer'`, [lay],
)
const gravouJanela = Boolean(sessao && sessao.started_at && sessao.occurred_at)
console.log('a sessão cronometrada guarda início e fim:', gravouJanela ? 'ok' : 'FALHOU')

let recusouInvertido = false
try {
  await db.query(
    `insert into public.activities
            (user_id, type_slug, value, unit, duration_min, day, started_at, occurred_at, source)
          values ($1, 'estudo', 25, 'minutos', 25, current_date,
                  now() + interval '1 hour', now(), 'timer')`,
    [lay],
  )
} catch {
  recusouInvertido = true
}
console.log('início depois do fim é recusado:', recusouInvertido ? 'ok' : 'FALHOU')

const denovo = await migrate(db, { from: '0058_suporte_do_produto_no_pro.sql', stopOnError: false })
console.log('aplicar de novo:', denovo.length === 0 ? 'ok, idempotente' : `FALHOU: ${JSON.stringify(denovo)}`)

const ok =
  antigo && antigo.started_at === null && gravouJanela && recusouInvertido && denovo.length === 0
process.exit(ok ? 0 : 1)
