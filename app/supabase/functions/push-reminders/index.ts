// Momentumm — o aviso que traz alguém de volta pro próximo passo.
//
// Roda a cada hora (pg_cron → pg_net → aqui, migration 0036). Pergunta ao
// banco QUEM deveria receber e QUAL aviso — `notifications_due()`, migrations
// 0050 e 0055 —, e manda um Web Push pra cada aparelho inscrito.
//
// A regra inteira mora no banco, de propósito: horário, inatividade, cooldown,
// preferências e prioridade entre os tipos são decisões sobre a pessoa, e
// precisam ser as mesmas pra quem consulta o SQL e pra quem lê o código. Aqui
// fica só o envio, a copy e o que fazer quando o endpoint morre.
//
// Compatibilidade: se o banco ainda não tem a 0050 (`notifications_due`
// ausente), a função cai na `push_reminders_due(hour)` da 0036 e manda o aviso
// antigo. Um deploy de app não pode ficar sem lembrete porque a migration
// ainda não subiu.
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

const APP_URL = 'https://www.momentumm.com.br/app'
/** Hora padrão do modo de compatibilidade (0036). */
const LEGACY_HOUR = 19

type NotificationKind =
  | 'proximo_passo'
  | 'continuidade'
  | 'progresso'
  | 'dia_dificil'
  | 'retomada'
  | 'social'

interface DueRow {
  readonly subscription_id: string
  readonly user_id: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly first_name: string | null
  readonly kind: NotificationKind
  readonly days_away: number
  readonly partner_name: string | null
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
 * A copy de cada tipo.
 *
 * Nenhuma frase cobra, nenhuma menciona o que ficou por fazer e nenhuma cita o
 * conteúdo da ação — a notificação aparece na tela bloqueada, onde qualquer
 * pessoa lê, e o objetivo de alguém não é assunto de quem está ao lado. O que
 * chega é sempre a mesma promessa: existe um próximo passo, ele continua aqui,
 * e ele cabe no dia que sobrou.
 *
 * `proximo_passo` tem três versões porque é o que mais se repete; a escolha é
 * estável por pessoa e por dia (não sorteia a cada tentativa) e varia ao longo
 * dos dias, que é o que impede o aviso de virar um ruído decorado.
 */
const PROXIMO_PASSO: readonly ReminderPayload[] = [
  {
    title: 'Seu próximo passo',
    body: 'Seu próximo passo continua aqui. Que tal fazer só o que cabe hoje?',
    url: APP_URL,
    tag: 'momentumm-proximo-passo',
  },
  {
    title: 'Ainda dá pra avançar',
    body: 'Ainda dá para avançar um pouco hoje. Seu próximo passo está pronto.',
    url: APP_URL,
    tag: 'momentumm-proximo-passo',
  },
  {
    title: 'Só continuar',
    body: 'Você não precisa fazer tudo. Só continuar de onde parou.',
    url: APP_URL,
    tag: 'momentumm-proximo-passo',
  },
]

/** Espalha o id da pessoa em um número estável. Nada de aleatório por chamada. */
function hashOf(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function reminderFor(row: DueRow): ReminderPayload {
  const nome = row.first_name?.trim() ?? ''
  const oi = nome ? `${nome}, ` : ''
  const diaDoAno = Math.floor(Date.now() / 86_400_000)

  switch (row.kind) {
    case 'retomada':
      return {
        title: 'Vamos retomar?',
        body:
          row.days_away >= 7
            ? `${oi}o plano te espera do jeito que você deixou. Um passo hoje e ele volta a andar.`
            : `${oi}alguns dias saíram do plano. Seu progresso continua aqui.`,
        url: APP_URL,
        tag: 'momentumm-retomada',
      }

    case 'social':
      return {
        title: row.partner_name ? `${row.partner_name} avançou hoje` : 'Sua dupla avançou',
        body: `${oi}sua dupla se mexeu hoje. Seu próximo passo também está pronto.`,
        url: APP_URL,
        tag: 'momentumm-juntos',
      }

    case 'dia_dificil':
      return {
        title: 'O dia ainda cabe',
        body: `${oi}dia corrido acontece. Dá pra fazer a versão mínima e manter o ritmo.`,
        url: APP_URL,
        tag: 'momentumm-dia-dificil',
      }

    case 'continuidade':
      return {
        title: 'De onde você parou',
        body: `${oi}você avançou ontem. O próximo passo já está esperando.`,
        url: APP_URL,
        tag: 'momentumm-continuidade',
      }

    case 'progresso':
      return {
        title: 'Sua semana até aqui',
        body: `${oi}sua semana tem mais movimento do que parece. Dá uma olhada.`,
        url: APP_URL,
        tag: 'momentumm-progresso',
      }

    case 'proximo_passo':
    default: {
      const escolha = PROXIMO_PASSO[(hashOf(row.user_id) + diaDoAno) % PROXIMO_PASSO.length]
      return { ...escolha, body: `${oi}${escolha.body.charAt(0).toLowerCase()}${escolha.body.slice(1)}` }
    }
  }
}

/**
 * O link do aviso carrega o TIPO, nunca a ação.
 *
 * O app lê `?n=` pra carimbar a abertura (`mark_notification_opened`) e cair
 * no Hoje, que é onde a ação está destacada. Mandar o id da ação na URL seria
 * expor uma chave interna num endereço que a pessoa pode colar em qualquer
 * lugar, e a tela não precisa dele pra mostrar o que importa.
 */
function linkFor(payload: ReminderPayload, kind: NotificationKind): string {
  const url = new URL(payload.url)
  url.searchParams.set('n', kind)
  return url.href
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} não configurada`)
  return value
}

type Admin = ReturnType<typeof createClient>

/**
 * A fila, com o caminho de compatibilidade.
 *
 * `notifications_due()` é a decisão completa (0050 + 0055). Se ela ainda não
 * existe no banco, `push_reminders_due(hour)` responde a pergunta antiga
 * ("não abriu hoje") e o aviso sai como `proximo_passo`. Deploy do app e
 * migration não sobem no mesmo segundo, e a janela entre os dois não pode
 * ser uma noite sem lembrete pra ninguém.
 */
async function loadDue(admin: Admin, hour: number): Promise<{ rows: DueRow[]; legacy: boolean }> {
  const { data, error } = await admin.rpc('notifications_due')

  if (!error) return { rows: (data ?? []) as DueRow[], legacy: false }

  const ausente = error.code === 'PGRST202' || /does not exist|could not find/i.test(error.message)
  if (!ausente) throw error

  console.warn('notifications_due ausente: usando push_reminders_due (0036)')
  const legado = await admin.rpc('push_reminders_due', { p_hour: hour })
  if (legado.error) throw legado.error

  const rows = (legado.data ?? []) as Array<Omit<DueRow, 'kind' | 'partner_name'>>
  return {
    rows: rows.map((row) => ({ ...row, kind: 'proximo_passo' as const, partner_name: null })),
    legacy: true,
  }
}

/** Analytics nunca derruba um envio: o erro fica no log e o aviso segue. */
async function logEvent(
  admin: Admin,
  user: string,
  name: string,
  metadata: Record<string, string | number | boolean>,
): Promise<void> {
  const { error } = await admin.rpc('log_notification_event', {
    p_user: user,
    p_name: name,
    p_metadata: metadata,
  })
  if (error) console.warn('log_notification_event', name, error.message)
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

  const hour = Number(new URL(req.url).searchParams.get('hour') ?? LEGACY_HOUR)

  let due: DueRow[]
  let legacy: boolean
  try {
    const fila = await loadDue(admin, hour)
    due = fila.rows
    legacy = fila.legacy
  } catch (cause) {
    console.error('fila de notificações', cause)
    return Response.json({ error: 'due_query_failed' }, { status: 500 })
  }

  let sent = 0
  let dropped = 0
  let failed = 0

  for (const row of due) {
    const payload = reminderFor(row)
    const url = linkFor(payload, row.kind)

    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ ...payload, url }),
        { TTL: 6 * 60 * 60, urgency: 'normal' },
      )

      if (legacy) {
        await admin.rpc('mark_push_reminded', { p_subscription_id: row.subscription_id })
      } else {
        await admin.rpc('mark_notification_sent', {
          p_user: row.user_id,
          p_type: row.kind,
          p_subscription_id: row.subscription_id,
        })
        await logEvent(admin, row.user_id, 'notification_sent', {
          notification_type: row.kind,
          days_since_activity: row.days_away,
        })
      }
      sent += 1
    } catch (cause) {
      const status = (cause as { statusCode?: number }).statusCode

      if (status === 404 || status === 410) {
        // O aparelho não existe mais (app desinstalado, permissão revogada).
        // Guardar a assinatura morta só faria a fila crescer pra sempre.
        await admin.from('push_subscriptions').delete().eq('id', row.subscription_id)
        dropped += 1
      } else {
        console.error('push send', row.subscription_id, status, (cause as Error).message)
        await admin
          .from('push_subscriptions')
          .update({ failed_at: new Date().toISOString() })
          .eq('id', row.subscription_id)
        if (!legacy) {
          await logEvent(admin, row.user_id, 'notification_failed', {
            notification_type: row.kind,
            result: String(status ?? 'erro').slice(0, 40),
          })
        }
        failed += 1
      }
    }
  }

  return Response.json({ hour, legacy, due: due.length, sent, dropped, failed })
})
