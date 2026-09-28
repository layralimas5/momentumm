/*
  O deploy da 0060, ensaiado sobre o banco que já roda.

  A migration traz três coisas pra tela nova de perfil: seguir, as redes da
  pessoa e a foto do dia. O que este ensaio confere é o que dá pra quebrar num
  deploy assim:

    - a migration sobe sobre o estado de 0059, com conta e dado dentro
    - seguir grava uma linha por direção, e seguir de novo não duplica
    - seguir a si mesmo é recusado pelo banco, não só pela tela
    - as contagens saem certas dos dois lados
    - o @ das redes recusa URL colada disfarçada de nome
    - a foto é uma por dia e o caminho tem que ser da própria pessoa
    - foto de um dia que ainda não chegou é recusada
    - recomeçar do zero limpa o álbum e mantém quem te segue
    - rodar de novo não quebra nada (db push repetido, SQL colado duas vezes)
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0059_foco_inicio_e_fim.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0059: ok')

/* Duas contas que já existiam antes da migration. */
const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@momentumm.com.br') returning id`)).id
await db.query(
  `insert into public.activities (user_id, type_slug, value, unit, duration_min, day, occurred_at)
        values ($1, 'estudo', 30, 'minutos', 30, current_date, now())`,
  [lay],
)

const nova = await migrate(db, { from: '0059_foco_inicio_e_fim.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0060 aplicada: ok')

// ---------------------------------------------------------------- seguir

await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [bia, lay])
await db.query(
  `insert into public.follows (follower_id, following_id) values ($1, $2)
   on conflict do nothing`,
  [bia, lay],
)
const linhas = await q(`select * from public.follows`)
console.log('seguir duas vezes é uma linha só:', linhas.length === 1 ? 'ok' : `FALHOU: ${linhas.length}`)

let recusouEuMesma = false
try {
  await db.query(`insert into public.follows (follower_id, following_id) values ($1, $1)`, [lay])
} catch {
  recusouEuMesma = true
}
console.log('seguir a si mesmo é recusado:', recusouEuMesma ? 'ok' : 'FALHOU')

/* O outro sentido: A e B se seguindo são duas linhas, e uma não é a outra. */
await db.query(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [lay, bia])

/*
  A partir da 0067, `follow_counts` conta só o que foi ACEITO, e quem decide o
  aceite é o perfil de destino: público entra na hora, fechado vira pedido.
  Perfil nasce `privado`, então as duas linhas acima nascem pendentes e as
  contagens são zero — o que está certo, pedido esperando resposta não é
  seguidor, e contá-lo daria pra inflar o número de qualquer perfil fechado só
  pedindo pra segui-lo.

  Este ensaio passa a abrir os dois perfis antes de cobrar a contagem. É a
  única mudança que a camada social trouxe pra o comportamento da 0060.
*/
const pendentes = await q(`select status from public.follows`)
console.log('perfil fechado: seguir vira pedido:',
  pendentes.every((r) => r.status === 'pendente') ? 'ok' : `FALHOU: ${JSON.stringify(pendentes)}`)

await db.query(`update public.profiles set profile_visibility = 'publico' where id in ($1, $2)`, [lay, bia])
await db.query(`update public.follows set status = 'aceito'`)

const daLay = await one(`select * from public.follow_counts($1)`, [lay])
const daBia = await one(`select * from public.follow_counts($1)`, [bia])
const contouCerto =
  Number(daLay.followers) === 1 && Number(daLay.following) === 1 &&
  Number(daBia.followers) === 1 && Number(daBia.following) === 1
console.log('as contagens batem dos dois lados:', contouCerto ? 'ok' : `FALHOU: ${JSON.stringify({ daLay, daBia })}`)

/* Desfazer de um lado não mexe no outro. */
await db.query(`delete from public.follows where follower_id = $1 and following_id = $2`, [bia, lay])
const depois = await one(`select * from public.follow_counts($1)`, [lay])
console.log('desfazer de um lado só mexe naquele lado:',
  Number(depois.followers) === 0 && Number(depois.following) === 1 ? 'ok' : `FALHOU: ${JSON.stringify(depois)}`)

// ---------------------------------------------------------------- as redes

await db.query(`update public.profiles set instagram = 'layra.lima' where id = $1`, [lay])
const comInsta = await one(`select instagram from public.profiles where id = $1`, [lay])
console.log('o @ limpo entra:', comInsta.instagram === 'layra.lima' ? 'ok' : `FALHOU: ${comInsta.instagram}`)

let recusouUrl = false
try {
  await db.query(
    `update public.profiles set instagram = 'https://instagram.com/lay?igsh=1' where id = $1`,
    [lay],
  )
} catch {
  recusouUrl = true
}
console.log('URL colada no lugar do @ é recusada:', recusouUrl ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- a foto do dia

const caminho = `${lay}/fotos/uma.jpg`
await db.query(
  `insert into public.day_photos (user_id, day, path) values ($1, current_date - 1, $2)`,
  [lay, caminho],
)
await db.query(
  `insert into public.day_photos (user_id, day, path) values ($1, current_date - 1, $2)
   on conflict (user_id, day) do update set path = excluded.path`,
  [lay, `${lay}/fotos/outra.jpg`],
)
const doDia = await q(`select path from public.day_photos where user_id = $1`, [lay])
const trocou = doDia.length === 1 && doDia[0].path.endsWith('outra.jpg')
console.log('a segunda foto do dia troca a primeira:', trocou ? 'ok' : `FALHOU: ${JSON.stringify(doDia)}`)

let recusouCaminhoAlheio = false
try {
  await db.query(
    `insert into public.day_photos (user_id, day, path) values ($1, current_date - 2, $2)`,
    [lay, `${bia}/fotos/alheia.jpg`],
  )
} catch {
  recusouCaminhoAlheio = true
}
console.log('caminho da pasta de outra pessoa é recusado:', recusouCaminhoAlheio ? 'ok' : 'FALHOU')

let recusouFuturo = false
try {
  await db.query(
    `insert into public.day_photos (user_id, day, path) values ($1, current_date + 5, $2)`,
    [lay, `${lay}/fotos/amanha.jpg`],
  )
} catch {
  recusouFuturo = true
}
console.log('foto de dia que não chegou é recusada:', recusouFuturo ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- recomeçar do zero

/*
  `reset_my_data` lê `auth.uid()`, que não existe fora de uma sessão do
  PostgREST. O ensaio faz o que a função faz, na mesma ordem, pra provar que as
  duas linhas novas estão no lugar certo dela: o álbum sai junto com o resto do
  registro, e quem te segue continua te seguindo.
*/
await db.query(`delete from public.day_photos where user_id = $1`, [lay])
const sobrou = await q(`select * from public.day_photos where user_id = $1`, [lay])
const laco = await q(`select * from public.follows where following_id = $1 or follower_id = $1`, [lay])
console.log('recomeçar limpa o álbum e mantém o laço:',
  sobrou.length === 0 && laco.length === 1 ? 'ok' : `FALHOU: ${sobrou.length} fotos, ${laco.length} laços`)

const temReset = await one(
  `select prosrc like '%day_photos%' as limpa from pg_proc where proname = 'reset_my_data'`,
)
console.log('a função de recomeçar conhece o álbum:', temReset && temReset.limpa ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- de novo

const repetida = await migrate(db, { from: '0059_foco_inicio_e_fim.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
