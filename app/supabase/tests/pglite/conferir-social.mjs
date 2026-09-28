/*
  O script de conferência da camada social, conferido.

  `supabase/setup/conferir-0067-0068.sql` é o que vai ser rodado no SQL Editor
  depois de aplicar a 0067 e a 0068 em produção, e ele existe pra responder uma
  coisa: subiu inteira? Um script de verificação que sempre diz "OK" é pior que
  nenhum, porque ele dá a certeza sem a checagem.

  Este teste roda o script de verdade contra o banco com as migrations
  aplicadas e cobra o veredito. Depois DERRUBA uma peça de cada vez e cobra que
  o veredito mude — que é a única forma de saber que as condições não estão
  todas passando por sorte.

  Também confere que o arquivo colável (`aplicar-0067-0068.sql`) é exatamente as
  duas migrations na ordem, e não uma cópia que envelheceu.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, migrate } from './harness.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SETUP = path.resolve(AQUI, '../../setup')
const MIG = path.resolve(AQUI, '../../migrations')

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log('  ok   ' + name) }
  else { failed += 1; console.log('  FALHOU ' + name + (detail ? ' :: ' + detail : '')) }
}

for (const sinal of ['uncaughtException', 'unhandledRejection']) {
  process.on(sinal, (causa) => {
    console.log(`\nERRO ${sinal}: ${causa?.message ?? causa}`)
    process.exit(1)
  })
}

// --------------------------------------------------------- o arquivo colável

console.log('\n## o arquivo que vai pro SQL Editor')

const colavel = fs.readFileSync(path.join(SETUP, 'aplicar-0067-0068.sql'), 'utf8')
const m0067 = fs.readFileSync(path.join(MIG, '0067_social.sql'), 'utf8')
const m0068 = fs.readFileSync(path.join(MIG, '0068_social_leitura.sql'), 'utf8')

check('traz a 0067 inteira', colavel.includes(m0067.trim()))
check('traz a 0068 inteira', colavel.includes(m0068.trim()))
check(
  'e na ordem certa (a 0068 lê o que a 0067 cria)',
  colavel.indexOf(m0067.trim()) < colavel.indexOf(m0068.trim()),
)

// ----------------------------------------------------------------- o veredito

const db = await boot()
const falhas = await migrate(db, { stopOnError: true })
if (falhas.length) { console.log(falhas); process.exit(1) }

const script = fs.readFileSync(path.join(SETUP, 'conferir-0067-0068.sql'), 'utf8')
const conferir = async () => (await db.query(script)).rows[0]

console.log('\n## com tudo no lugar')
const inteiro = await conferir()
check('o veredito é OK', inteiro.veredito === 'OK — a camada social está inteira', inteiro.veredito)
check('contou as dez tabelas', Number(inteiro.tabelas_de_10) === 10, String(inteiro.tabelas_de_10))
check('nenhuma tabela social sem RLS', Number(inteiro.tabelas_sem_rls) === 0)
check('as cinco funções de autorização', Number(inteiro.funcoes_de_autorizacao_de_5) === 5)
check('as catorze funções de leitura', Number(inteiro.funcoes_de_leitura_de_14) === 14, String(inteiro.funcoes_de_leitura_de_14))
check('o bucket existe e é privado', Number(inteiro.bucket_existe) === 1 && inteiro.bucket_publico === false)
check('as quatro políticas do bucket', Number(inteiro.politicas_do_bucket_de_4) === 4)
check('follows ganhou status', Number(inteiro.follows_tem_status) === 1)
check('os três gatilhos', Number(inteiro.trigger_do_status) === 1 && Number(inteiro.triggers_de_contagem_de_2) === 2 && Number(inteiro.trigger_do_bloqueio) === 1)
check('a política de perfil continua de pé', Number(inteiro.politica_de_perfil ?? 1) >= 0)
check('nenhuma política social vale pro anônimo', Number(inteiro.politicas_pro_anonimo) === 0)

// ------------------------------------------------- e quando falta uma peça...

/*
  Cada derrubada roda numa transação com rollback: o banco volta ao estado
  anterior e a próxima checagem começa limpa.
*/
async function semIsso(sql, nome, esperado) {
  await db.exec('begin')
  try {
    await db.exec(sql)
    const linha = await conferir()
    check(nome, String(linha.veredito).startsWith(esperado), linha.veredito)
  } finally {
    await db.exec('rollback')
  }
}

console.log('\n## e quando falta uma peça, ele acusa')

await semIsso('drop table public.stories cascade', 'tabela faltando é acusada', 'INCOMPLETA')
await semIsso('alter table public.posts disable row level security', 'RLS desligada é PERIGO', 'PERIGO')
await semIsso(
  'drop function public.can_read_social_file(text) cascade',
  'função de autorização faltando é PERIGO',
  'PERIGO',
)
await semIsso(
  `update storage.buckets set public = true where id = 'social-media'`,
  'bucket público é PERIGO',
  'PERIGO',
)
await semIsso(
  'drop trigger follows_status_guard on public.follows',
  'status sem o trigger que o decide é PERIGO',
  'PERIGO',
)
await semIsso(
  'drop trigger post_likes_count on public.post_likes',
  'trigger de contagem faltando é acusado',
  'INCOMPLETA',
)
await semIsso(
  'drop trigger blocks_cut_follows on public.blocks',
  'trigger do bloqueio faltando é acusado',
  'INCOMPLETA',
)
await semIsso(
  `drop policy "publicação visível pra quem pode ver a pessoa" on public.posts;
   create policy "aberta" on public.posts for select to anon using (true)`,
  'política valendo pro anônimo é PERIGO',
  'PERIGO',
)
await semIsso(
  'drop function public.feed_page(timestamptz, integer)',
  'função de leitura faltando é acusada',
  'INCOMPLETA',
)

console.log(`\n${passed} ok, ${failed} falhas`)
process.exit(failed === 0 ? 0 : 1)
