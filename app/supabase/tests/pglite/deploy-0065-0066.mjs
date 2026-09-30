/*
  O deploy da 0065: o lembrete por item da rotina.

    - a migration sobe sobre o estado de 0064
    - o item com lembrete entra na fila quando a hora chega
    - antes da hora, não entra
    - item já feito, pulado ou reagendado não é lembrado
    - o carimbo é por ITEM: dois compromissos no mesmo dia mandam dois avisos
    - carimbado, o mesmo item não volta no mesmo dia
    - item pausado, arquivado ou sem lembrete fica de fora
    - rodar de novo não quebra nada
*/
import { boot, migrate } from './harness.mjs'

const db = await boot()
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const one = async (sql, params = []) => (await q(sql, params))[0]

const base = await migrate(db, { until: '0064_rotina.sql', stopOnError: true })
if (base.length) { console.log('base falhou:', base); process.exit(1) }
console.log('base em 0064: ok')

const lay = (await one(`insert into auth.users (email) values ('lay@momentumm.com.br') returning id`)).id

const nova = await migrate(db, { from: '0064_rotina.sql', stopOnError: true })
if (nova.length) { console.log('FALHOU:', nova); process.exit(1) }
console.log('0065 e 0066 aplicadas: ok')

// Presença e assinatura de push, que é o que a fila exige.
await q(`insert into public.user_presence (user_id, last_active_at, timezone)
         values ($1, now(), 'America/Sao_Paulo')
         on conflict (user_id) do update set timezone = excluded.timezone`, [lay])
await q(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
         values ($1, 'https://exemplo/1', 'chave', 'auth')`, [lay])

// A hora local de agora, pra montar os casos em relação a ela.
const agora = (await one(`select (now() at time zone 'America/Sao_Paulo')::time as t,
                                 (now() at time zone 'America/Sao_Paulo')::date as d`))
const emMinutos = (min) => {
  const [h, m] = String(agora.t).split(':').map(Number)
  const total = h * 60 + m + min
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

const daqui10 = await one(
  `insert into public.routine_items (user_id, title, time_of_day, reminder_min, recurrence)
   values ($1, 'Treino', $2, 10, 'diario') returning id`,
  [lay, emMinutos(10)],
)
const daqui5h = await one(
  `insert into public.routine_items (user_id, title, time_of_day, reminder_min, recurrence)
   values ($1, 'Jantar', $2, 10, 'diario') returning id`,
  [lay, emMinutos(300)],
)
await q(
  `insert into public.routine_items (user_id, title, time_of_day, recurrence)
   values ($1, 'Sem lembrete', $2, 'diario')`,
  [lay, emMinutos(10)],
)
await q(
  `insert into public.routine_items (user_id, title, time_of_day, reminder_min, recurrence, paused_at)
   values ($1, 'Pausado', $2, 10, 'diario', now())`,
  [lay, emMinutos(10)],
)

const fila = await q(`select * from public.routine_reminders_due()`)
console.log('o item da hora entra na fila:',
  fila.length === 1 && fila[0].item_id === daqui10.id ? 'ok' : `FALHOU: ${JSON.stringify(fila.map((f) => f.title))}`)
console.log('o de daqui a cinco horas fica fora:',
  fila.every((f) => f.item_id !== daqui5h.id) ? 'ok' : 'FALHOU')
console.log('sem lembrete e pausado ficam fora:',
  fila.every((f) => !['Sem lembrete', 'Pausado'].includes(f.title)) ? 'ok' : 'FALHOU')
console.log('a fila diz quanto falta:',
  fila[0] && fila[0].minutes_left >= 0 && fila[0].minutes_left <= 11 ? 'ok' : `FALHOU: ${fila[0]?.minutes_left}`)

// Um segundo compromisso na mesma hora: o carimbo é por item.
const outro = await one(
  `insert into public.routine_items (user_id, title, time_of_day, reminder_min, recurrence)
   values ($1, 'Remédio', $2, 10, 'diario') returning id`,
  [lay, emMinutos(10)],
)
console.log('dois compromissos na mesma hora mandam dois:',
  (await q(`select * from public.routine_reminders_due()`)).length === 2 ? 'ok' : 'FALHOU')

await q(`select public.mark_routine_reminder_sent($1, $2, $3::date)`, [lay, daqui10.id, agora.d])
const depois = await q(`select * from public.routine_reminders_due()`)
console.log('carimbado, o item sai da fila:',
  depois.length === 1 && depois[0].item_id === outro.id ? 'ok' : 'FALHOU')

await q(`select public.mark_routine_reminder_sent($1, $2, $3::date)`, [lay, daqui10.id, agora.d])
console.log('carimbar de novo não duplica:',
  (await q(`select count(*)::int as n from public.notification_log
             where type = 'rotina' and entity_id = $1`, [daqui10.id]))[0].n === 1 ? 'ok' : 'FALHOU')

// Quem já resolveu o dia não é lembrado.
await q(`insert into public.routine_occurrences (user_id, item_id, day, status)
         values ($1, $2, $3::date, 'feito')`, [lay, outro.id, agora.d])
console.log('quem já fez não é lembrado:',
  (await q(`select * from public.routine_reminders_due()`)).length === 0 ? 'ok' : 'FALHOU')

const repetida = await migrate(db, { from: '0064_rotina.sql', stopOnError: true })
console.log('rodar a migration de novo:', repetida.length === 0 ? 'ok' : `FALHOU: ${JSON.stringify(repetida)}`)
