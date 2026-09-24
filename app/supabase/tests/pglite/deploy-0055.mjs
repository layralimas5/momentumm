/*
  O deploy da 0055, ensaiado sobre o banco que já roda.

  Mesma pergunta do `deploy-0048-0051`, e ela não é a do `db:test`: aplicar
  todas as migrations num banco vazio prova que o conjunto é coerente; aplicar
  só a nova sobre o estado anterior prova que ela SOBE. A segunda é a que
  acontece em produção.

  O que este ensaio confere, além de subir:

    - a tabela de regras nasce com uma linha (sem ela, a decisão não decide)
    - a constraint de fuso passa a aceitar `Etc/GMT+3`, que era o caso em que
      a presença nunca gravava
    - rodar de novo não quebra nada (db push repetido, SQL colado duas vezes)
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (s) => (await db.query(s)).rows

const base = await migrate(db, { until: '0054_aviso_de_teste_sem_cortesia.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0054: ok')

const nova = await migrate(db, { from: '0054_aviso_de_teste_sem_cortesia.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0055 aplicada: ok')

const regras = (await q(`select count(*)::int as c from public.notification_rules`))[0].c
console.log('linha de regras:', regras === 1 ? 'ok, uma só' : `FALHOU: ${regras}`)

await db.exec(`insert into auth.users (id, email) values ('33333333-3333-4333-8333-333333333333', 'fuso@teste')`)
let fusoOk = true
try {
  await db.exec(`insert into public.user_presence (user_id, timezone)
                 values ('33333333-3333-4333-8333-333333333333', 'Etc/GMT+3')`)
} catch (cause) {
  fusoOk = false
  console.log('fuso com dígito:', 'FALHOU ::', String(cause.message).slice(0, 120))
}
if (fusoOk) console.log('fuso com dígito: ok, aceito')

const denovo = await migrate(db, { from: '0054_aviso_de_teste_sem_cortesia.sql', stopOnError: false })
console.log('aplicar de novo:', denovo.length === 0 ? 'ok, idempotente' : `FALHOU: ${JSON.stringify(denovo)}`)

process.exit(regras === 1 && fusoOk && denovo.length === 0 ? 0 : 1)
