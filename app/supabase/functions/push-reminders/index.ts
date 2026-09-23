// Momentumm — o lembrete de quem não abriu o app hoje.
//
// Roda a cada hora (pg_cron → pg_net → aqui, migration 0036). Pergunta ao
// banco quem está na hora certa do próprio fuso, não abriu o app hoje e ainda
// não foi lembrado, e manda um Web Push pra cada aparelho inscrito. A regra
// de "quem" mora inteira em `push_reminders_due()`; aqui fica só o envio.
//
// Quem chama precisa do `x-reminder-token` igual a `PUSH_REMINDER_TOKEN`.
// Não é uma pessoa: por isso o deploy é sem verificação de JWT.
//
//   supabase functions deploy push-reminders --no-verify-jwt
//   supabase secrets set PUSH_REMINDER_TOKEN=<32+ caracteres>
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
//
// As chaves VAPID nascem uma vez com `npx web-push generate-vapid-keys`. A
// pública vai também pro app (`VITE_VAPID_PUBLIC_KEY`): trocar uma sem a
// outra invalida toda assinatura existente.
//
// Endpoint morto (404/410) apaga a assinatura; outro erro marca `failed_at`
// e o aparelho sai da fila até a pessoa religar o lembrete no app.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import webpush from 'web-push'

const REMINDER_HOUR = 19
const APP_URL = 'https://www.momentumm.com.br/app'

interface DueRow {
  readonly subscription_id: string
  readonly user_id: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly first_name: string | null
  readonly days_away: number
}

interface ReminderPayload {
  readonly title: string
  readonly body: string
  readonly url: string
  readonly tag: string
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * A mensagem cresce com os dias fora, sem cobrar. Um dia é "o de hoje
 * ainda cabe"; vários é o Modo Retomada chamando, que é o que o app abre.
 */
function reminderFor(firstName: string | null, daysAway: number): ReminderPayload {
  const name = firstName?.trim() ? `${firstName.trim()}, ` : ''
  const body =
    daysAway <= 1
      ? `${name}sua ação de hoje ainda cabe. Dez minutos já contam.`
      : daysAway <= 3
        ? `${name}${daysAway} dias sem registrar. Volta com a versão mínima e o ritmo segue.`
        : `${name}o plano te espera do jeito que você deixou. Um passo hoje e ele volta a andar.`

  return {
    title: daysAway <= 1 ? 'Seu Momentumm de hoje' : 'Vamos retomar?',
    body,
    url: APP_URL,
    tag: 'momentumm-daily',
  }
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} não configurada`)
  return value
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const expected = Deno.env.get('PUSH_REMINDER_TOKEN')?.trim() ?? ''
  const given = req.headers.get('x-reminder-token') ?? ''
  if (!expected || !timingSafeEqual(expected, given)) {
    return new Response('unauthorized', { status: 401 })
  }

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const hour = Number(new URL(req.url).searchParams.get('hour') ?? REMINDER_HOUR)
  const { data, error } = await admin.rpc('push_reminders_due', { p_hour: hour })
  if (error) {
    console.error('push_reminders_due', error)
    return Response.json({ error: 'due_query_failed' }, { status: 500 })
  }

  const due = (data ?? []) as DueRow[]
  let sent = 0
  let dropped = 0
  let failed = 0

  for (const row of due) {
    const payload = reminderFor(row.first_name, row.days_away)
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60, urgency: 'normal' },
      )
      await admin.rpc('mark_push_reminded', { p_subscription_id: row.subscription_id })
      sent += 1
    } catch (cause) {
      const status = (cause as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', row.subscription_id)
        dropped += 1
      } else {
        console.error('push send', row.subscription_id, status, (cause as Error).message)
        await admin
          .from('push_subscriptions')
          .update({ failed_at: new Date().toISOString() })
          .eq('id', row.subscription_id)
        failed += 1
      }
    }
  }

  return Response.json({ hour, due: due.length, sent, dropped, failed })
})
