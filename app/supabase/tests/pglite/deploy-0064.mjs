/*
  O deploy da 0064, ensaiado sobre o banco que já roda.

  A migration traz a Rotina: a regra (`routine_items`) e a execução do dia
  (`routine_occurrences`). O que este ensaio confere é o que dá pra quebrar:

    - a migration sobe sobre o estado de 0063, com contas dentro
    - a rotina é PRIVADA: ninguém lê, escreve nem apaga a rotina de outra pessoa
    - as quatro políticas do molde existem nas duas tabelas
    - a ocorrência é UMA por item por dia
    - o `user_id` da ocorrência é carimbado pelo dono do item, não pelo cliente
    - marcar um item na segunda não marca o mesmo item na quarta
    - concluir carimba a hora; desmarcar apaga o carimbo
    - item recorrente não nasce preso a uma data, e o de uma vez só exige a data
    - `dias-semana` sem nenhum dia é recusado
    - a rotina sai na exportação da pessoa
    - "recomeçar do zero" leva a rotina junto
    - apagar o item leva as ocorrências dele
    - rodar de novo não quebra nada
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0063_convite_de_clube.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0063: ok')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id
const bia = (await one(`insert into auth.users (email) values ('bia@momentumm.com.br') returning id`)).id

const nova = await migrate(db, { from: '0063_convite_de_clube.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0064 aplicada: ok')

/*
  A sessão é simulada como o Supabase faz: o PAPEL vira `authenticated` e o
  claim carrega o `sub`. Trocar só o claim deixaria a consulta rodando como
  dono do banco, que ignora RLS, e o ensaio de privacidade passaria sem provar
  nada.
*/
async function sessao(userId) {
  await db.exec(
    `select set_config('role', 'authenticated', false);
     select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, role: 'authenticated' })}', false)`,
  )
}

const comoDono = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`)

/*
  Buraco do stub, não do produto.

  No Supabase o papel `authenticated` já tem `usage` nos schemas `auth` e
  `storage`; o harness cria os dois na mão e sem grant nenhum. Sem isto,
  `export_my_data` (que é `security invoker`, de propósito, pra rodar com a RLS
  de quem pede) morre em "permission denied for schema auth" ao chamar
  `auth.uid()`, e o ensaio culparia a migration por uma falta do ensaio.
*/
await db.exec(`
  grant usage on schema auth to anon, authenticated;
  grant usage on schema storage to anon, authenticated;
  grant select on auth.users to authenticated;
  grant select on storage.objects to authenticated;
`)

// 2026-09-28 é segunda; 30 é quarta.
const SEGUNDA = '2026-09-28'
const QUARTA = '2026-09-30'

// ---------------------------------------------------------------- criar

await sessao(lay)

const treino = await one(
  `insert into public.routine_items (user_id, title, time_of_day, recurrence, weekdays)
   values ($1, 'Treino', '18:30', 'dias-semana', array[1,3,5]::smallint[])
   returning id, day, "order"`,
  [lay],
)
console.log('item recorrente nasce sem data presa:', treino?.id && treino.day === null ? 'ok' : 'FALHOU')

let recusouSemDia = false
try {
  await q(
    `insert into public.routine_items (user_id, title, recurrence, weekdays)
     values ($1, 'Vazio', 'dias-semana', '{}'::smallint[])`,
    [lay],
  )
} catch (erro) {
  recusouSemDia = erro.code === '23514'
}
console.log('dias específicos sem nenhum dia é recusado:', recusouSemDia ? 'ok' : 'FALHOU')

let recusouUnicaSemData = false
try {
  await q(
    `insert into public.routine_items (user_id, title, recurrence) values ($1, 'Dentista', 'unica')`,
    [lay],
  )
} catch (erro) {
  recusouUnicaSemData = erro.code === '23514'
}
console.log('item de uma vez só exige a data:', recusouUnicaSemData ? 'ok' : 'FALHOU')

const dentista = await one(
  `insert into public.routine_items (user_id, title, time_of_day, recurrence, day)
   values ($1, 'Dentista', '10:30', 'unica', $2::date) returning id`,
  [lay, '2026-09-29'],
)
console.log('compromisso sem objetivo é legítimo:', dentista?.id ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- o dia

await q(
  `insert into public.routine_occurrences (user_id, item_id, day, status, planned_time)
   values ($1, $2, $3::date, 'feito', '18:30')`,
  [lay, treino.id, SEGUNDA],
)

const naSegunda = await one(
  `select status, completed_at from public.routine_occurrences where item_id = $1 and day = $2::date`,
  [treino.id, SEGUNDA],
)
console.log('concluir carimba a hora:',
  naSegunda?.status === 'feito' && naSegunda.completed_at !== null ? 'ok' : 'FALHOU')

const naQuarta = await q(
  `select * from public.routine_occurrences where item_id = $1 and day = $2::date`,
  [treino.id, QUARTA],
)
console.log('a segunda concluída não conclui a quarta:', naQuarta.length === 0 ? 'ok' : 'FALHOU')

await q(
  `update public.routine_occurrences set status = 'pendente' where item_id = $1 and day = $2::date`,
  [treino.id, SEGUNDA],
)
const desmarcada = await one(
  `select completed_at from public.routine_occurrences where item_id = $1 and day = $2::date`,
  [treino.id, SEGUNDA],
)
console.log('desmarcar apaga o carimbo:', desmarcada?.completed_at === null ? 'ok' : 'FALHOU')

let recusouDuplicada = false
try {
  await q(
    `insert into public.routine_occurrences (user_id, item_id, day) values ($1, $2, $3::date)`,
    [lay, treino.id, SEGUNDA],
  )
} catch (erro) {
  recusouDuplicada = erro.code === '23505'
}
console.log('uma ocorrência por item por dia:', recusouDuplicada ? 'ok' : 'FALHOU')

await q(
  `update public.routine_occurrences
      set status = 'reagendado', moved_to_day = $3::date
    where item_id = $1 and day = $2::date`,
  [treino.id, SEGUNDA, QUARTA],
)
const movida = await one(
  `select moved_to_day from public.routine_occurrences where item_id = $1 and day = $2::date`,
  [treino.id, SEGUNDA],
)
console.log('reagendar guarda o destino:', movida?.moved_to_day !== null ? 'ok' : 'FALHOU')

let recusouMoverProMesmoDia = false
try {
  await q(
    `update public.routine_occurrences set moved_to_day = day where item_id = $1 and day = $2::date`,
    [treino.id, SEGUNDA],
  )
} catch (erro) {
  recusouMoverProMesmoDia = erro.code === '23514'
}
console.log('não dá pra reagendar pro próprio dia:', recusouMoverProMesmoDia ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- privacidade

await sessao(bia)

const leuDaLay = await q(`select * from public.routine_items where user_id = $1`, [lay])
console.log('ninguém lê a rotina de outra pessoa:', leuDaLay.length === 0 ? 'ok' : 'FALHOU')

const leuOcorrencias = await q(`select * from public.routine_occurrences where user_id = $1`, [lay])
console.log('nem as ocorrências:', leuOcorrencias.length === 0 ? 'ok' : 'FALHOU')

const apagou = await q(`delete from public.routine_items where id = $1 returning id`, [treino.id])
console.log('nem apaga:', apagou.length === 0 ? 'ok' : 'FALHOU')

const editou = await q(
  `update public.routine_items set title = 'Invadido' where id = $1 returning id`,
  [treino.id],
)
console.log('nem edita:', editou.length === 0 ? 'ok' : 'FALHOU')

/*
  O carimbo do dono.

  Sem o trigger, a Bia escreveria uma ocorrência com o `user_id` dela apontando
  pro item da Lay: a linha passaria na política (é dela) e a rotina da Lay
  passaria a ter um dia que ela não marcou.
*/
let recusouItemAlheio = false
try {
  await q(
    `insert into public.routine_occurrences (user_id, item_id, day) values ($1, $2, $3::date)`,
    [bia, treino.id, '2026-10-05'],
  )
} catch (erro) {
  recusouItemAlheio = erro.code === '42501'
}
console.log('não dá pra marcar o item de outra pessoa:', recusouItemAlheio ? 'ok' : 'FALHOU')

const politicas = await q(
  `select tablename, cmd, roles::text from pg_policies
    where schemaname = 'public' and tablename in ('routine_items', 'routine_occurrences')`,
)
const porTabela = (nome) => politicas.filter((linha) => linha.tablename === nome)
const quatroComandos = (nome) =>
  ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].every((cmd) =>
    porTabela(nome).some((linha) => linha.cmd === cmd),
  )
console.log('as quatro políticas do molde, nas duas tabelas:',
  quatroComandos('routine_items') && quatroComandos('routine_occurrences') ? 'ok' : 'FALHOU')
console.log('nenhuma política vale pro anônimo:',
  politicas.every((linha) => linha.roles.includes('authenticated') && !linha.roles.includes('anon'))
    ? 'ok'
    : `FALHOU: ${JSON.stringify(politicas.map((l) => l.roles))}`)

// ---------------------------------------------------------------- exportar, recomeçar, apagar

await sessao(lay)

const exportado = (await one(`select public.export_my_data() as dados`)).dados
console.log('a rotina sai na exportação:',
  Array.isArray(exportado.routine_items) && exportado.routine_items.length === 2 ? 'ok' : 'FALHOU')
console.log('as ocorrências saem junto:',
  Array.isArray(exportado.routine_occurrences) && exportado.routine_occurrences.length === 1
    ? 'ok'
    : 'FALHOU')
console.log('a exportação não vaza o dono nas linhas:',
  exportado.routine_items.every((linha) => !('user_id' in linha)) ? 'ok' : 'FALHOU')
console.log('o resto da exportação continua de pé:',
  Array.isArray(exportado.habits) && Array.isArray(exportado.tasks) ? 'ok' : 'FALHOU')

await q(`delete from public.routine_items where id = $1`, [dentista.id])
const sobrou = await q(`select * from public.routine_items where user_id = $1`, [lay])
console.log('o dono apaga o próprio item:', sobrou.length === 1 ? 'ok' : 'FALHOU')

await q(`select public.reset_my_data()`)
const depoisDoReset = await q(`select * from public.routine_items where user_id = $1`, [lay])
const ocorrenciasDepois = await q(`select * from public.routine_occurrences where user_id = $1`, [lay])
console.log('recomeçar do zero leva a rotina:',
  depoisDoReset.length === 0 ? 'ok' : 'FALHOU')
console.log('e leva as ocorrências pela cascata:',
  ocorrenciasDepois.length === 0 ? 'ok' : 'FALHOU')

// ---------------------------------------------------------------- repetição

await comoDono()
const repetida = await migrate(db, { from: '0063_convite_de_clube.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
