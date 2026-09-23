/*
  A janela da sessão do painel.

  O que importa: o padrão é o dia de trabalho, a configuração manda, valor
  absurdo não passa, e o step-up continua curto. Se a janela voltasse a ser
  de uma hora, a verificação em duas etapas seria desligada de novo.
*/
import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
const check = (nome, ok, detalhe = '') => {
  if (ok) { passed += 1; console.log('  ok   ' + nome) }
  else { failed += 1; console.log('  FALHOU ' + nome + (detalhe ? ' :: ' + detalhe : '')) }
}

const db = await boot()
await migrate(db)
/* O driver devolve interval como texto (`08:00:00`), não como objeto. */
const janelaDe = async (sql) => String((await db.query(sql)).rows[0].janela)

const padrao = await janelaDe(`select public.admin_session_max_age() as janela`)
check('o padrão é 8 horas', padrao === '08:00:00', padrao)

const stepUp = await janelaDe(`select public.admin_step_up_max_age() as janela`)
check('o step-up continua em 5 minutos', stepUp === '00:05:00', stepUp)

await db.exec(`update public.product_settings set value = value || '{"sessionMinutes": 120}'::jsonb where key = 'admin.security'`)
const ajustada = await janelaDe(`select public.admin_session_max_age() as janela`)
check('a configuração manda', ajustada === '02:00:00', ajustada)

await db.exec(`update public.product_settings set value = value || '{"sessionMinutes": 99999}'::jsonb where key = 'admin.security'`)
const teto = await janelaDe(`select public.admin_session_max_age() as janela`)
check('valor absurdo para no teto de 24 horas', teto === '24:00:00', teto)

const recusa = async (valor) => {
  try {
    await db.query(`select public.validate_setting('admin.security', $1::jsonb)`, [valor])
    return false
  } catch {
    return true
  }
}
check('a tela recusa sessão de 3 minutos', await recusa('{"requireMfa": true, "sessionMinutes": 3}'))
check('a tela recusa sessão de uma semana', await recusa('{"requireMfa": true, "sessionMinutes": 10080}'))
check('a tela aceita 8 horas', !(await recusa('{"requireMfa": true, "sessionMinutes": 480}')))

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
