/*
  A camada social (0067 e 0068) contra um Postgres de verdade, com RLS ligada.

  Este teste é o critério de conclusão do pedido, escrito em SQL. Ele não diz
  se a tela está bonita: diz se, com sessões autenticadas de verdade, uma
  conta consegue ver, curtir, comentar e — principalmente — NÃO consegue
  mexer no que é da outra.

  A sessão é simulada como o Supabase faz: `role = authenticated` mais o
  `request.jwt.claims` com o `sub`. Sem isso o teste rodaria como superusuário
  e aprovaria um banco escancarado.

  Os cenários:

     1  seguir perfil público entra aceito; perfil fechado vira pedido
     2  quem segue NÃO se aprova (o trigger desfaz o caminho curto)
     3  o dono aceita, e só então o conteúdo fechado abre
     4  publicação do seguido aparece no feed de quem segue
     5  curtir e comentar sobem as contagens, e descurtir desce
     6  ninguém edita, apaga nem curte o que não pode ver
     7  a foto cai no dia certo do calendário, e o dia abre a publicação
     8  bloqueio corta o laço, some o conteúdo e impede voltar sozinho
     9  story vive 24h pela POLÍTICA, não por faxina
    10  denúncia é uma por alvo, e ninguém apaga a própria
*/
import { boot, migrate } from './harness.mjs'

/*
  O PGlite despeja o bundle inteiro no stack trace de um erro de SQL, e a
  mensagem útil fica no fim de trezentas mil colunas. Estes dois handlers
  imprimem só o que dá pra ler.
*/
for (const sinal of ['uncaughtException', 'unhandledRejection']) {
  process.on(sinal, (causa) => {
    console.log(`
ERRO ${sinal}: ${causa?.message ?? causa}`)
    if (causa?.query) console.log('na consulta:', String(causa.query).replace(/\s+/g, ' ').slice(0, 220))
    process.exit(1)
  })
}

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

async function erro(sql, params = []) {
  try {
    await db.query(sql, params)
    return null
  } catch (cause) {
    return String(cause.message ?? cause)
  }
}

/** A (aberta), B (aberta) e C (fechada). */
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

const asPostgres = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)
const asUser = (id) =>
  db.exec(
    `select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: id, role: 'authenticated' })}',false)`,
  )

await asPostgres()
for (const [id, nome, handle, vis] of [
  [A, 'Ana', 'ana', 'publico'],
  [B, 'Bia', 'bia', 'publico'],
  [C, 'Cris', 'cris', 'privado'],
]) {
  await db.exec(`insert into auth.users (id, email) values ('${id}', '${handle}@teste.momentumm')`)
  await db.exec(
    `update public.profiles set name = '${nome}', handle = '${handle}', profile_visibility = '${vis}' where id = '${id}'`,
  )
}

// ---------------------------------------------------------------- cenário 1

console.log('\n## 1, seguir: aberto entra, fechado pede')

await asUser(A)
await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [A, B])
await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [A, C])

await asPostgres()
const paraB = await one(`select status from public.follows where follower_id = $1 and following_id = $2`, [A, B])
const paraC = await one(`select status from public.follows where follower_id = $1 and following_id = $2`, [A, C])
check('perfil público aceita na hora', paraB.status === 'aceito', paraB.status)
check('perfil fechado vira pedido', paraC.status === 'pendente', paraC.status)

/* O cliente mandando `aceito` na mão não muda nada: quem decide é o trigger. */
await asUser(B)
await db.query(
  `insert into public.follows (follower_id, following_id, status) values ($1, $2, 'aceito')`,
  [B, C],
)
await asPostgres()
const forjado = await one(`select status from public.follows where follower_id = $1 and following_id = $2`, [B, C])
check('mandar "aceito" no insert não cola', forjado.status === 'pendente', forjado.status)

// ---------------------------------------------------------------- cenário 2

console.log('\n## 2, ninguém se aprova')

await asUser(A)
await db.query(
  `update public.follows set status = 'aceito' where follower_id = $1 and following_id = $2`,
  [A, C],
)
await asPostgres()
const aindaPendente = await one(
  `select status from public.follows where follower_id = $1 and following_id = $2`, [A, C])
check('quem segue não se aprova', aindaPendente.status === 'pendente', aindaPendente.status)

await asUser(C)
const pedidos = await q(`select * from public.follow_requests()`)
check('o pedido chega pra quem foi pedido', pedidos.length === 2, String(pedidos.length))

// ---------------------------------------------------------------- cenário 3

console.log('\n## 3, o dono aceita e só então abre')

/* Antes do aceite, o conteúdo fechado de C é invisível pra A. */
await asPostgres()
const postC = (await one(
  `insert into public.posts (user_id, caption, day) values ($1, 'fechado', current_date) returning id`,
  [C],
)).id

await asUser(A)
const antes = await q(`select id from public.posts where id = $1`, [postC])
check('publicação de perfil fechado não vaza antes do aceite', antes.length === 0)
const podeAntes = (await one(`select public.can_view_content_of($1) as v`, [C])).v
check('can_view_content_of diz não antes do aceite', podeAntes === false)

await asUser(C)
await db.query(
  `update public.follows set status = 'aceito' where follower_id = $1 and following_id = $2`, [A, C])

await asUser(A)
const depois = await q(`select id from public.posts where id = $1`, [postC])
check('depois do aceite a publicação aparece', depois.length === 1)

// ---------------------------------------------------------------- cenário 4

console.log('\n## 4, o feed')

await asUser(B)
const postB = (await one(
  `insert into public.posts (user_id, caption, day, progress_done, progress_goal)
        values ($1, 'Hoje foram só 25 minutos, mas eu fui.', current_date, 8, 30) returning id`,
  [B],
)).id
await db.query(
  `insert into public.post_media (post_id, user_id, path, position, width, height)
        values ($1, $2, $3, 0, 1080, 1350)`,
  [postB, B, `${B}/posts/foto.jpg`],
)

await asUser(A)
const feed = await q(`select * from public.feed_page(null, 10)`)
check('o feed traz quem eu sigo', feed.some((r) => r.id === postB))
check('o feed traz o autor junto', feed.find((r) => r.id === postB)?.author_handle === 'bia')
const midia = feed.find((r) => r.id === postB)?.media
const fotos = typeof midia === 'string' ? JSON.parse(midia) : midia
check('o feed traz as fotos junto', Array.isArray(fotos) && fotos.length === 1, JSON.stringify(midia))
check('o feed traz o progresso congelado',
  feed.find((r) => r.id === postB)?.progress_done === 8 && feed.find((r) => r.id === postB)?.progress_goal === 30)

/* Quem não segue ninguém não vê publicação de estranho. */
await asPostgres()
const D = '44444444-4444-4444-8444-444444444444'
await db.exec(`insert into auth.users (id, email) values ('${D}', 'd@teste.momentumm')`)
await asUser(D)
const feedVazio = await q(`select * from public.feed_page(null, 10)`)
check('quem não segue ninguém tem feed vazio', feedVazio.length === 0, String(feedVazio.length))

/* E a sugestão traz gente REAL, sem inventar ninguém. */
const sugestoes = await q(`select * from public.suggested_profiles(8)`)
check('a sugestão traz só perfil público que publicou', sugestoes.every((s) => s.handle !== 'cris'))
check('a sugestão traz a Bia, que publicou', sugestoes.some((s) => s.handle === 'bia'))

// ---------------------------------------------------------------- cenário 5

console.log('\n## 5, curtir e comentar')

await asUser(A)
await db.query(`insert into public.post_likes (post_id, user_id) values ($1, $2)`, [postB, A])
await db.query(
  `insert into public.post_comments (post_id, user_id, body) values ($1, $2, 'Isso! 25 minutos contam.')`,
  [postB, A],
)

await asPostgres()
const contado = await one(`select like_count, comment_count from public.posts where id = $1`, [postB])
check('curtida sobe a contagem da publicação de OUTRA pessoa',
  contado.like_count === 1, String(contado.like_count))
check('comentário sobe a contagem', contado.comment_count === 1, String(contado.comment_count))

await asUser(B)
const cartao = await one(`select * from public.post_card($1)`, [postB])
check('o dono vê as interações', cartao.like_count === 1 && cartao.comment_count === 1)
const comentarios = await q(`select * from public.post_comments_page($1, null, 20)`, [postB])
check('o dono lê o comentário', comentarios.length === 1 && comentarios[0].handle === 'ana')
check('o dono pode apagar comentário da própria publicação', comentarios[0].can_delete === true)
check('mas o comentário não é dele', comentarios[0].mine === false)

await asUser(A)
await db.query(`delete from public.post_likes where post_id = $1 and user_id = $2`, [postB, A])
await asPostgres()
const descurtido = await one(`select like_count from public.posts where id = $1`, [postB])
check('descurtir desce a contagem', descurtido.like_count === 0, String(descurtido.like_count))

// ---------------------------------------------------------------- cenário 6

console.log('\n## 6, o que A não pode fazer com o que é de B')

await asUser(A)
await db.query(`update public.posts set caption = 'invadido' where id = $1`, [postB])
await db.query(`delete from public.posts where id = $1`, [postB])
await asPostgres()
const intacto = await one(`select caption from public.posts where id = $1`, [postB])
check('A não edita publicação de B', intacto?.caption !== 'invadido', String(intacto?.caption))
check('A não apaga publicação de B', intacto !== undefined)

/* Curtir o que não se pode ver: a policy de insert exige can_view_post. */
await asUser(D)
const curtiuEscondido = await erro(
  `insert into public.post_likes (post_id, user_id) values ($1, $2)`, [postC, D])
check('não dá pra curtir publicação que você não enxerga', curtiuEscondido !== null, 'passou')

const comentouEscondido = await erro(
  `insert into public.post_comments (post_id, user_id, body) values ($1, $2, 'oi')`, [postC, D])
check('não dá pra comentar publicação que você não enxerga', comentouEscondido !== null, 'passou')

/* Foto na publicação de outra pessoa: o trigger recusa. */
await asUser(D)
const fotoAlheia = await erro(
  `insert into public.post_media (post_id, user_id, path, position) values ($1, $2, $3, 1)`,
  [postB, D, `${D}/posts/x.jpg`],
)
check('não dá pra anexar foto na publicação de outra pessoa', fotoAlheia !== null, 'passou')

/* O arquivo: pode ler o da publicação que enxerga, não o da que não enxerga. */
await asUser(A)
const leFoto = (await one(`select public.can_read_social_file($1) as v`, [`${B}/posts/foto.jpg`])).v
check('A lê o arquivo da publicação que ela vê', leFoto === true)
/*
  Perfil PÚBLICO é legível por qualquer conta, inclusive por quem não segue: é
  o que "público" significa, e é a diferença entre "não está no meu feed" e
  "não posso ver". O feed é quem eu sigo; a publicação de um perfil aberto é
  visível a quem chegar nela.
*/
await asUser(D)
const lePublico = (await one(`select public.can_read_social_file($1) as v`, [`${B}/posts/foto.jpg`])).v
check('perfil público: o arquivo é legível mesmo sem seguir', lePublico === true)

/* Perfil FECHADO é o que fica fechado pra quem não foi aceito. */
await asPostgres()
await db.query(
  `insert into public.post_media (post_id, user_id, path, position) values ($1, $2, $3, 0)`,
  [postC, C, `${C}/posts/fechada.jpg`])
await asUser(D)
const naoLeFechado = (await one(`select public.can_read_social_file($1) as v`, [`${C}/posts/fechada.jpg`])).v
check('perfil fechado: o arquivo não é legível por quem não foi aceito', naoLeFechado === false)
await asUser(A)
const leFechadoAceita = (await one(`select public.can_read_social_file($1) as v`, [`${C}/posts/fechada.jpg`])).v
check('perfil fechado: quem foi aceito lê', leFechadoAceita === true)

await asUser(D)
const inventado = (await one(`select public.can_read_social_file($1) as v`, [`${B}/posts/chutado.jpg`])).v
check('caminho chutado não vira leitura', inventado === false)

// ---------------------------------------------------------------- cenário 7

console.log('\n## 7, o calendário')

await asUser(B)
const hoje = (await one(`select current_date as d`)).d
const cal = await q(`select * from public.profile_calendar($1, (current_date - 31), current_date)`, [B])
const celula = cal.find((linha) => String(linha.day).slice(0, 10) === String(hoje).slice(0, 10))
check('o dia de hoje tem célula', celula !== undefined)
check('a célula aponta pra publicação', celula?.post_id === postB)
check('a célula traz o caminho da foto', celula?.cover_path === `${B}/posts/foto.jpg`)
check('a célula conta uma publicação', Number(celula?.total) === 1, String(celula?.total))

/* Segunda publicação no mesmo dia: a capa vira a mais recente e o total sobe. */
const postB2 = (await one(
  `insert into public.posts (user_id, caption, day, created_at)
        values ($1, 'a segunda do dia', current_date, now() + interval '1 minute') returning id`, [B])).id
await db.query(
  `insert into public.post_media (post_id, user_id, path, position) values ($1, $2, $3, 0)`,
  [postB2, B, `${B}/posts/foto2.jpg`])

const cal2 = await q(`select * from public.profile_calendar($1, (current_date - 31), current_date)`, [B])
const celula2 = cal2.find((linha) => String(linha.day).slice(0, 10) === String(hoje).slice(0, 10))
check('a capa passa a ser a mais recente', celula2?.post_id === postB2)
check('o total avisa que são duas', Number(celula2?.total) === 2, String(celula2?.total))

const doDia = await q(`select * from public.posts_of_day($1, current_date)`, [B])
check('o dia abre as duas publicações', doDia.length === 2, String(doDia.length))

/* O álbum manual (0060) continua servindo de reserva num dia sem publicação. */
await db.query(
  `insert into public.day_photos (user_id, day, path) values ($1, current_date - 3, $2)`,
  [B, `${B}/fotos/velha.jpg`])
const cal3 = await q(`select * from public.profile_calendar($1, (current_date - 31), current_date)`, [B])
const reserva = cal3.find((linha) => linha.from_album === true)
check('dia sem publicação usa a foto do álbum', reserva?.cover_path === `${B}/fotos/velha.jpg`)

// ---------------------------------------------------------------- cenário 8

console.log('\n## 8, bloqueio')

await asUser(B)
await db.query(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [B, A])

await asPostgres()
const laco = await q(
  `select * from public.follows where (follower_id = $1 and following_id = $2) or (follower_id = $2 and following_id = $1)`,
  [A, B])
check('bloquear derruba o laço nos dois sentidos', laco.length === 0, String(laco.length))

await asUser(A)
const feedDepois = await q(`select * from public.feed_page(null, 10)`)
check('o conteúdo de quem bloqueou some do feed', !feedDepois.some((r) => r.user_id === B))
const vePost = await q(`select id from public.posts where id = $1`, [postB])
check('e some da leitura direta também', vePost.length === 0)

/* Seguir de novo não devolve o acesso: o bloqueio ganha da regra do perfil. */
await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [A, B])
const podeDeNovo = (await one(`select public.can_view_content_of($1) as v`, [B])).v
check('seguir de novo não fura o bloqueio', podeDeNovo === false)

/* Quem foi bloqueada não lê a linha do bloqueio. */
const veBloqueio = await q(`select * from public.blocks`)
check('quem foi bloqueada não vê a linha', veBloqueio.length === 0, String(veBloqueio.length))

await asUser(B)
const veuOProprio = await q(`select * from public.blocks`)
check('quem bloqueou vê a própria linha', veuOProprio.length === 1)

// ---------------------------------------------------------------- cenário 9

console.log('\n## 9, story')

await asUser(C)
const story = (await one(
  `insert into public.stories (user_id, path) values ($1, $2) returning id, expires_at`,
  [C, `${C}/stories/s1.jpg`])).id

await asUser(A)
const bandeja = await q(`select * from public.stories_tray()`)
check('o story do perfil fechado aparece pra quem foi aceito', bandeja.some((r) => r.user_id === C))
check('e vem marcado como não visto', Number(bandeja.find((r) => r.user_id === C)?.unseen) === 1)

await db.query(`insert into public.story_views (story_id, viewer_id) values ($1, $2)`, [story, A])
const bandeja2 = await q(`select * from public.stories_tray()`)
check('depois de visto o anel apaga', Number(bandeja2.find((r) => r.user_id === C)?.unseen) === 0)

/* O vencimento é da POLÍTICA: envelhecer a linha basta pra ela sumir. */
await asPostgres()
await db.query(`update public.stories set expires_at = now() - interval '1 minute' where id = $1`, [story])
await asUser(A)
const vencido = await q(`select id from public.stories where id = $1`, [story])
check('story vencido some da leitura sem faxina nenhuma', vencido.length === 0)
const arquivoVencido = (await one(`select public.can_read_social_file($1) as v`, [`${C}/stories/s1.jpg`])).v
check('e o arquivo dele para de ser legível junto', arquivoVencido === false)

await asUser(C)
const doDono = await q(`select id from public.stories where id = $1`, [story])
check('o dono ainda vê o próprio story vencido', doDono.length === 1)

// --------------------------------------------------------------- cenário 10

console.log('\n## 10, denúncia')

await asUser(A)
await db.query(
  `insert into public.reports (reporter_id, target_kind, target_id, reason)
        values ($1, 'publicacao', $2, 'spam')`, [A, postC])
const repetida = await erro(
  `insert into public.reports (reporter_id, target_kind, target_id, reason)
        values ($1, 'publicacao', $2, 'assedio')`, [A, postC])
check('denunciar o mesmo alvo duas vezes é recusado', repetida !== null, 'passou')

await db.query(`delete from public.reports where reporter_id = $1`, [A])
await asPostgres()
const sobrou = await q(`select * from public.reports`)
check('ninguém apaga a própria denúncia', sobrou.length === 1, String(sobrou.length))

await asUser(C)
const veAlheia = await q(`select * from public.reports`)
check('denúncia de outra pessoa não é legível', veAlheia.length === 0, String(veAlheia.length))

// ---------------------------------------------------------------------------

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed === 0 ? 0 : 1)
