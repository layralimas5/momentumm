/*
  Mais de um funil de quiz, contra um Postgres de verdade.

  O que precisa continuar valendo: rascunho não aparece pra quem responde,
  funil sem pergunta não vai pro ar, o funil original não se edita pelo
  painel, e o contato de um quiz novo cai na mesma lista de sempre.
*/
import { boot, migrate } from './harness.mjs'

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

const db = await boot()
await migrate(db)

const OWNER = '11111111-1111-4111-8111-111111111111'
const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asOwner = () =>
  db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: OWNER, role: 'authenticated', aal: 'aal2' })}',false)`)
const asAnon = () =>
  db.exec(`select set_config('role','anon',false); select set_config('request.jwt.claims','${JSON.stringify({ role: 'anon' })}',false)`)
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const falha = async (fn, trecho) => {
  try { await fn(); return { ok: false, detail: 'não deu erro' } }
  catch (e) { return { ok: e.message.includes(trecho), detail: e.message.slice(0, 110) } }
}

await asPostgres()
await db.exec(`insert into auth.users (id, email) values ('${OWNER}', 'owner@teste.momentumm')`)
await db.exec(`insert into public.user_roles (user_id, role) values ('${OWNER}', 'owner') on conflict do nothing`)
await db.exec(`update public.product_settings set value = '{"requireMfa": false}'::jsonb where key = 'admin.security'`)

// --- o funil original continua lá ------------------------------------------
const original = await one(`select slug, built_in, state::text as state from public.quizzes where slug = 'criar-meu-plano'`)
check('o funil original virou registro', original.built_in === true && original.state === 'publicado')

await asOwner()

// --- criar um funil novo ----------------------------------------------------
const perguntas = JSON.stringify([
  { key: 'area', kind: 'unica', title: 'O que mais te trava hoje?', required: true,
    options: [{ value: 'tempo', label: 'Falta de tempo' }, { value: 'foco', label: 'Falta de foco' }] },
  { key: 'meta', kind: 'texto', title: 'O que você quer conquistar?', required: true, options: [] },
])

const criado = (await one(
  `select public.admin_save_quiz('carreira', 'Diagnóstico de carreira', 'contato', $1::jsonb, 'novo funil pra prospecção') as j`,
  [perguntas],
)).j
check('o funil novo nasce com as perguntas', criado.questions === 2, `veio ${criado.questions}`)

// --- rascunho não vaza ------------------------------------------------------
await asAnon()
let r = await falha(() => db.query(`select public.quiz_public('carreira')`), 'não encontrado')
check('rascunho não aparece pra quem responde', r.ok, r.detail)

// --- publicar ---------------------------------------------------------------
await asOwner()
r = await falha(
  () => db.query(`select public.admin_save_quiz('vazio', 'Sem perguntas', 'contato', '[]'::jsonb, 'teste')`).then(
    () => db.query(`select public.admin_set_quiz_state('vazio', 'publicado', 'teste')`)),
  'sem pergunta nenhuma',
)
check('funil sem pergunta não vai pro ar', r.ok, r.detail)

r = await falha(
  () => db.query(`select public.admin_save_quiz('criar-meu-plano', 'Outro nome', 'plano', '[]'::jsonb, 'teste')`),
  'no código',
)
check('o funil original não se edita pelo painel', r.ok, r.detail)

await db.query(`select public.admin_set_quiz_state('carreira', 'publicado', 'pronto pra divulgar')`)

// --- agora quem responde enxerga -------------------------------------------
await asAnon()
const publico = (await one(`select public.quiz_public('carreira') as j`)).j
check('o quiz publicado abre pra quem responde', publico.slug === 'carreira')
check('com as perguntas na ordem', publico.questions[0].key === 'area' && publico.questions[1].key === 'meta')
check('e sem vazar o estado interno', !('state' in publico))

// --- responder e deixar contato --------------------------------------------
const sessao = '99999999-9999-4999-8999-999999999999'
await db.query(`select public.quiz_start('${sessao}', 'carreira', '{"utm_source":"instagram"}'::jsonb)`)
await db.query(`select public.quiz_save('${sessao}', '{"area":"tempo","meta":"mudar de área"}'::jsonb, null, 2)`)
await db.query(`select public.quiz_save_lead('${sessao}', 'Ciclana', 'ciclana@teste.momentumm', '11999998888')`)

await asPostgres()
const amarrada = await one(`
  select z.slug, s.lead_email
    from public.quiz_sessions s join public.quizzes z on z.id = s.quiz_id
   where s.id = '${sessao}'`)
check('a sessão fica amarrada ao quiz certo', amarrada.slug === 'carreira')
check('e o contato cai na mesma lista de sempre', amarrada.lead_email === 'ciclana@teste.momentumm')

// --- o funil no painel ------------------------------------------------------
await asOwner()
const funil = (await one(`select public.admin_quiz_funnel((now() - interval '1 day')::date, now()::date, 'carreira') as j`)).j
check('o funil filtra por quiz', funil.quiz === 'carreira')
check('e conta a sessão que entrou', funil.stages.quiz_started === 1, `veio ${funil.stages.quiz_started}`)

const geral = (await one(`select public.admin_quiz_funnel((now() - interval '1 day')::date, now()::date) as j`)).j
const carreira = geral.by_quiz.find((q) => q.slug === 'carreira')
check('sem filtro, compara os funis lado a lado', carreira?.sessions === 1 && carreira?.leads === 1)

const lista = (await one(`select public.admin_list_quizzes() as j`)).j
check('o painel lista os funis com o que cada um rendeu', lista.some((q) => q.slug === 'carreira' && q.leads === 1))

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
