/*
  Quem opera o produto nunca vê "isso faz parte do PRO".

  O teste existe por causa de um caso real: a 0034 deu cortesia infinita a
  owner e admin num backfill, e quem recebeu o papel DEPOIS ficou de fora —
  a dona do produto abrindo o próprio app e sendo convidada a assinar.

  Backfill resolve o passado. Aqui a pergunta é sobre o futuro: conceder o
  papel AGORA já deixa a conta PRO?
*/
import { boot, migrate } from './harness.mjs'

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

/*
  A cortesia é lida como TEXTO, sempre.

  O driver do PGlite devolve `infinity` de um timestamptz como `null` em
  JavaScript — o valor está gravado certo no banco (`::text` prova), mas a
  conversão pro tipo Date não tem como representar infinito. Ler como número
  ou data aqui faria o teste acusar um bug que não existe, que foi exatamente
  o que aconteceu na primeira versão deste arquivo.
*/
const cortesia = async (user) =>
  (await one(`select plan_courtesy_until::text as t from public.profiles where id = $1`, [user])).t

const plano = async (user) =>
  (await one(`select plan from public.profiles where id = $1`, [user])).plan

console.log('\n## Papel concedido depois da implantação')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id

/*
  Conta nova nasce PRO pelo teste de 7 dias (0034), não por cortesia. É a
  distinção que importa aqui: o teste ACABA, e é no oitavo dia que a dona do
  produto seria convidada a assinar o próprio app.
*/
check('conta nova não tem cortesia, só o teste', (await cortesia(lay)) === null)

await db.exec(`insert into public.user_roles (user_id, role) values ('${lay}', 'owner')`)

check('virar owner concede cortesia na hora', (await cortesia(lay)) === 'infinity', String(await cortesia(lay)))
check('o plano em cache é pro', (await plano(lay)) === 'pro')
check('plan_for_user concorda',
  (await one(`select public.plan_for_user('${lay}') as p`)).p === 'pro')

/* E continua PRO depois de o teste de 7 dias vencer, que é o ponto. */
await db.exec(`update public.plan_trials
                  set status = 'encerrado',
                      started_at = now() - interval '9 days',
                      ends_at = now() - interval '2 days'
                where user_id = '${lay}'`)
check('com o teste vencido, o owner continua PRO',
  (await one(`select public.plan_for_user('${lay}') as p`)).p === 'pro')

console.log('\n## Papel promovido de suporte pra admin')

const ana = (await one(`insert into auth.users (email) values ('ana@momentumm.com.br') returning id`)).id
await db.exec(`insert into public.user_roles (user_id, role) values ('${ana}', 'support')`)
check('suporte não ganha cortesia', (await cortesia(ana)) === null)

await db.exec(`update public.user_roles set role = 'admin' where user_id = '${ana}'`)
check('promover pra admin concede a cortesia', (await cortesia(ana)) === 'infinity')

console.log('\n## Quem não tem papel continua como estava')

const gente = (await one(`insert into auth.users (email) values ('gente@exemplo.com') returning id`)).id
check('conta comum não ganha cortesia', (await cortesia(gente)) === null)

console.log('\n## A guarda continua de pé')

/*
  A cortesia não pode ser auto-concedida: o trigger da 0034 recusa a escrita
  de quem não é service_role, admin, nem está no meio de uma sincronização.
  Se este teste passar a falhar, alguém abriu a porta pra qualquer conta se
  dar PRO infinito com um update no próprio perfil.
*/
await db.exec(`select set_config('role','authenticated',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: gente, role: 'authenticated' })}',false)`)
let recusou = false
try {
  await db.query(`update public.profiles set plan_courtesy_until = 'infinity' where id = '${gente}'`)
} catch {
  recusou = true
}
check('ninguém se dá cortesia sozinho', recusou)

await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)

console.log('\n## Backfill roda duas vezes sem estragar nada')

const antes = await cortesia(lay)
await db.exec(`do $$
begin
  perform set_config('momentumm.plan_sync', '1', true);
  update public.profiles p
     set plan_courtesy_until = 'infinity'
   where (p.plan_courtesy_until is null or p.plan_courtesy_until <= now())
     and exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('owner','admin'));
  perform set_config('momentumm.plan_sync', '', true);
end $$`)
check('a cortesia de quem já tinha não é mexida', (await cortesia(lay)) === antes)

console.log(`\n${passed} ok, ${failed} falharam`)
process.exit(failed > 0 ? 1 : 0)
