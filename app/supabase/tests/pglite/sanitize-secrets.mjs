/* A mensagem real que chegou na central, contra a regra do banco. */
import { boot, migrate } from './harness.mjs'

const db = await boot()
await migrate(db)

const real =
  "Failed to execute 'querySelector' on 'Document': '#access_token=eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnopqrst&expires_at=1789501550&refresh_token=ytirnzbchiet&token_type=bearer&type=recovery' is not a valid selector"

const { rows } = await db.query('select public.sanitize_error_message($1) as limpo', [real])
const limpo = rows[0].limpo

let failed = 0
const check = (nome, ok) => {
  console.log((ok ? '  ok   ' : '  FALHOU ') + nome)
  if (!ok) failed += 1
}

check('o refresh_token some', !limpo.includes('ytirnzbchiet'))
check('e vira [oculto]', limpo.includes('refresh_token=[oculto]'))
check('o jwt some', !limpo.includes('eyJhbGciOiJIUzI1NiJ9'))
check('mensagem sem segredo passa inteira', (await db.query(
  `select public.sanitize_error_message('column prev.active_user_ids does not exist') as l`,
)).rows[0].l === 'column prev.active_user_ids does not exist')

console.log(limpo.slice(0, 160))
process.exit(failed > 0 ? 1 : 0)
