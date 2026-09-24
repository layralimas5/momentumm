/*
  O deploy das 0048–0051, ensaiado.

  `npm run db:test` aplica TODAS as migrations num banco vazio, e isso prova
  que o conjunto é coerente — não prova que as quatro novas sobem num banco
  que já está rodando. São perguntas diferentes: a segunda é a que acontece
  em produção, e é a que quebra.

  Aqui o banco para na 0047 (o estado real hoje) e só então as novas entram,
  na ordem. Depois roda tudo de novo: um `db push` repetido, ou um SQL colado
  duas vezes no editor, não pode quebrar nada.
*/
import { boot, migrate } from './harness.mjs'
const db = await boot()

const ate47 = await migrate(db, { until: '0047_admin_session_window.sql', stopOnError: true })
if (ate47.length) { console.log('base falhou:', ate47); process.exit(1) }
console.log('base em 0047: ok')

const novas = await migrate(db, { from: '0047_admin_session_window.sql', stopOnError: true })
if (novas.length) { console.log('FALHOU:', novas); process.exit(1) }
console.log('0048 a 0051 aplicadas: ok')

const q = async (s) => (await db.query(s)).rows
console.log('tabelas novas:', (await q(`select table_name from information_schema.tables where table_schema='public' and table_name in ('pair_invites','accountability_pairs','pair_members','pair_encouragements','notification_preferences','notification_log') order by 1`)).map(r => r.table_name).join(', '))
console.log('flag juntos:', (await q(`select value->'juntos' as j from public.product_settings where key='features'`))[0].j)

/* Rodar duas vezes nao pode quebrar: e o que acontece se o push for repetido. */
const denovo = await migrate(db, { from: '0047_admin_session_window.sql', stopOnError: false })
console.log('aplicar de novo:', denovo.length === 0 ? 'ok, idempotente' : `FALHOU: ${JSON.stringify(denovo)}`)
