// Momentumm — o e-mail do sexto dia: o teste do PRO acaba amanhã.
//
// Roda uma vez por dia (pg_cron → pg_net → aqui, migration 0040). Pergunta
// ao banco quem tem teste terminando nas próximas 36 horas, ainda não foi
// avisado e não assinou, manda um e-mail pra cada um e carimba o envio. A
// regra de "quem" mora inteira em `trial_notices_due()`; aqui fica só o
// envio.
//
// O SMTP é o mesmo dos e-mails de conta (Gmail do app, `docs/email-transacional.md`).
// Quem chama precisa do `x-notice-token` igual a `TRIAL_NOTICE_TOKEN`. Não é
// uma pessoa: por isso o deploy é sem verificação de JWT.
//
//   supabase secrets set TRIAL_NOTICE_TOKEN=<32+ caracteres>
//   supabase secrets set SMTP_HOSTNAME=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true
//   supabase secrets set SMTP_USERNAME=momentumm.suport@gmail.com SMTP_PASSWORD=<senha de app>
//   supabase functions deploy trial-ending --no-verify-jwt
//
// Um envio que falha NÃO é carimbado: a pessoa entra na fila do dia
// seguinte, que ainda está dentro da janela de 36 horas.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import nodemailer from 'nodemailer'
// O preço vem do domínio empacotado (`npm run billing:bundle`), nunca escrito
// à mão aqui: e-mail com preço errado é problema de cobrança, não de texto.
import { PRO_PRICES, formatBRL } from '../_shared/billing.ts'

const APP_URL = 'https://www.momentumm.com.br'
const SIGNATURE_URL = `${APP_URL}/app/assinatura`
const PRICE_LINE = `${formatBRL(PRO_PRICES.mensal.amountCents)} por mês ou ${formatBRL(PRO_PRICES.anual.amountCents)} por ano. Pix ou cartão, e dá pra cancelar quando quiser.`

interface DueRow {
  readonly user_id: string
  readonly email: string
  readonly first_name: string | null
  readonly ends_at: string
  readonly hours_left: number
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** "24 de setembro": o dia em que o PRO para, escrito como gente fala. */
function endDay(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

/*
  O texto não ameaça e não esconde. Diz o que para de funcionar, diz que
  nada é apagado e diz o preço. Quem não quiser assinar continua com a
  conta: um e-mail que finge que a pessoa vai perder tudo queima a marca
  por uma conversão que não vem.
*/
function emailFor(row: DueRow): { subject: string; html: string; text: string } {
  const name = row.first_name?.trim() ? `${row.first_name.trim()}, s` : 'S'
  const day = endDay(row.ends_at)
  const subject = 'Seu PRO de teste acaba amanhã'

  const text = [
    `${name}eu teste do PRO vai até ${day}.`,
    '',
    'Depois disso a conta volta pro gratuito. Nada é apagado: teus objetivos, teu plano, teus hábitos e teu histórico continuam onde estão. O que sai de cena é o Momentumm AI, o histórico completo e as estatísticas longas.',
    '',
    `Pra seguir com tudo: ${SIGNATURE_URL}`,
    '',
    PRICE_LINE,
    '',
    'Momentumm',
  ].join('\n')

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#08080b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Depois de ${day} a conta volta pro gratuito, com tudo guardado.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#08080b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#101014;border:1px solid #232329;border-radius:16px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="font-size:13px;letter-spacing:0.38em;font-weight:600;color:#f4f4f5;">MOMENTU<span style="color:#8878ff;">MM</span></span>
              </td>
            </tr>
            <tr>
              <td style="font-size:22px;line-height:1.3;font-weight:700;color:#f4f4f5;padding-bottom:12px;">Teu PRO de teste vai até ${day}</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#a1a1aa;padding-bottom:16px;">
                Depois disso a conta volta pro gratuito. <strong style="color:#f4f4f5;">Nada é apagado</strong>: teus objetivos, teu plano, teus hábitos e teu histórico continuam onde estão.
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;color:#a1a1aa;padding-bottom:24px;">
                O que sai de cena é o Momentumm AI, o histórico completo e as estatísticas longas.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;">
                <a href="${SIGNATURE_URL}" style="display:inline-block;background-color:#6d5cff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:12px;">Seguir com o PRO</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#8b8b96;padding-bottom:24px;">
                ${PRICE_LINE}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #232329;padding-top:20px;font-size:12px;line-height:1.6;color:#8b8b96;">
                Não quer assinar agora? Não precisa fazer nada: a conta continua funcionando no gratuito.<br /><br />
                Momentumm · <a href="${APP_URL}" style="color:#8878ff;text-decoration:none;">momentumm.com.br</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

Deno.serve(async (request: Request) => {
  const expected = Deno.env.get('TRIAL_NOTICE_TOKEN') ?? ''
  const given = request.headers.get('x-notice-token') ?? ''
  if (expected.length < 32 || !timingSafeEqual(expected, given)) {
    return new Response(JSON.stringify({ error: 'não autorizado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const { data, error } = await supabase.rpc('trial_notices_due', { p_hours: 36 })
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const due = (data ?? []) as DueRow[]
  if (due.length === 0) {
    return new Response(JSON.stringify({ due: 0, sent: 0 }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOSTNAME') ?? 'smtp.gmail.com',
    port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
    secure: (Deno.env.get('SMTP_SECURE') ?? 'true') === 'true',
    auth: {
      user: Deno.env.get('SMTP_USERNAME') ?? '',
      pass: Deno.env.get('SMTP_PASSWORD') ?? '',
    },
  })

  const from = `Momentumm <${Deno.env.get('SMTP_USERNAME') ?? ''}>`
  const sent: string[] = []
  const failed: string[] = []

  for (const row of due) {
    const message = emailFor(row)
    try {
      await transport.sendMail({
        from,
        to: row.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })
      sent.push(row.user_id)
    } catch (cause) {
      // Sem carimbo: entra na fila de amanhã, ainda dentro das 36 horas.
      failed.push(row.user_id)
      console.error('falhou o aviso de fim de teste', row.user_id, String(cause).slice(0, 200))
    }
  }

  if (sent.length > 0) {
    const { error: markError } = await supabase.rpc('mark_trial_notice_sent', { p_users: sent })
    if (markError) console.error('falhou ao carimbar o aviso', markError.message)
  }

  return new Response(JSON.stringify({ due: due.length, sent: sent.length, failed: failed.length }), {
    headers: { 'content-type': 'application/json' },
  })
})
