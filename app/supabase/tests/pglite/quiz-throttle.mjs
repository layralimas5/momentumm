import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log('  ok   ' + name)
  } else {
    failed += 1
    console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : ''))
  }
}

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const asAnonFrom = (ip) =>
  db.exec(`select set_config('role', 'anon', false);
           select set_config('request.jwt.claims', '${JSON.stringify({ role: 'anon' })}', false);
           select set_config('request.headers', '${JSON.stringify(ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {})}', false)`)
const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)

const failures = await migrate(db, { stopOnError: true })
if (failures.length) { console.log(failures); process.exit(1) }

let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
async function lead(email) {
  const session = uuid()
  await db.exec(`select public.quiz_track('${session}', 'quiz_viewed', 0)`)
  try {
    const [row] = await q(`select public.quiz_save_lead($1, 'Pessoa', $2) as saved`, [session, email])
    return row.saved ? 'gravou' : 'ignorou'
  } catch (e) {
    return /muitos contatos/.test(e.message) ? 'freou' : 'erro: ' + e.message
  }
}

console.log('\n## Mesmo IP')
await asAnonFrom('200.1.1.1')
const primeiros = []
for (let i = 0; i < 5; i++) primeiros.push(await lead(`p${i}@exemplo.com`))
check('cinco contatos do mesmo IP gravam', primeiros.every((r) => r === 'gravou'), primeiros.join(','))
check('o sexto do mesmo IP é freado', (await lead('p6@exemplo.com')) === 'freou')

await asAnonFrom('200.2.2.2')
check('outro IP continua livre', (await lead('outra@exemplo.com')) === 'gravou')

console.log('\n## Mesmo e-mail')
check('o mesmo e-mail em 24h não vira outra linha', (await lead('outra@exemplo.com')) === 'ignorou')
await asPostgres()
const [{ c }] = await q(`select count(*)::int as c from public.quiz_sessions where lead_email = 'outra@exemplo.com'`)
check('só uma linha pro e-mail repetido', c === 1, String(c))

console.log('\n## Janela')
await db.exec(`update public.quiz_lead_hits set created_at = now() - interval '2 hours'`)
await asAnonFrom('200.1.1.1')
check('passada a hora, o IP freado volta a gravar', (await lead('volta@exemplo.com')) === 'gravou')

console.log('\n## Teto geral')
await asPostgres()
await db.exec(`insert into public.quiz_lead_hits (key_hash) select 'sem-ip' from generate_series(1, 120)`)
await asAnonFrom(null)
check('sem IP e com o teto geral cheio, freia', (await lead('semip@exemplo.com')) === 'freou')

console.log('\n## Privacidade')
await asAnonFrom('200.9.9.9')
let linhas = []
try { linhas = await q(`select * from public.quiz_lead_hits`) } catch { linhas = [] }
check('anônimo não lê a contagem', linhas.length === 0, String(linhas.length))
await asPostgres()
const [{ ip }] = await q(`select count(*)::int as ip from public.quiz_lead_hits where key_hash like '%200.%'`)
check('o IP não fica guardado em texto', ip === 0)

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed ? 1 : 0)
