// Momentumm — ações administrativas sobre contas.
//
// A única porta pra ação que mexe em conta de outra pessoa. Ela existe por
// dois motivos que o banco sozinho não cobre:
//
//   1. Contexto de segurança na auditoria: IP e agente só chegam aqui.
//   2. Duas ações falam com o GoTrue por fora do SQL — reenviar a
//      confirmação de e-mail e apagar a conta (com os arquivos do Storage).
//
// O que ela NÃO faz: confiar em campo de papel vindo do cliente. O papel é
// lido de `user_roles` com service role; o nível de garantia (`aal`) e o
// carimbo do segundo fator (`amr`) vêm do JWT que o próprio GoTrue validou
// em `auth.getUser()`. E as ações de suspender, reativar, revogar sessões e
// iniciar exclusão são delegadas às funções do banco COM O JWT DA PESSOA,
// então `assert_admin_step_up` roda de novo lá dentro. Duas checagens, uma
// em cada camada, e nenhuma no navegador.
//
// Deploy:
//   supabase functions deploy admin-actions

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SESSION_MAX_MINUTES = 60
const STEP_UP_MAX_MINUTES = 5

type Action =
  | 'invite_user'
  | 'suspend'
  | 'reactivate'
  | 'revoke_sessions'
  | 'resend_confirmation'
  | 'start_deletion'
  | 'complete_deletion'

const ACTIONS: ReadonlySet<Action> = new Set([
  'invite_user',
  'suspend',
  'reactivate',
  'revoke_sessions',
  'resend_confirmation',
  'start_deletion',
  'complete_deletion',
])

interface ActionRequest {
  readonly action: Action
  readonly userId: string
  readonly reason: string
  readonly requestId?: string | null
  /** Só em `invite_user`. */
  readonly email?: string | null
  readonly name?: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, code: string, message: string): Response {
  return reply(status, { error: { code, message } })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** As claims do token, decodificadas. O token já foi validado por `auth.getUser()`. */
function claimsOf(authorization: string): Record<string, unknown> | null {
  const token = authorization.replace(/^Bearer\s+/i, '')
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function totpVerifiedAt(claims: Record<string, unknown>): Date | null {
  const amr = claims['amr']
  if (!Array.isArray(amr)) return null
  let latest: number | null = null
  for (const entry of amr) {
    if (typeof entry !== 'object' || entry === null) continue
    const method = (entry as { method?: unknown }).method
    const timestamp = (entry as { timestamp?: unknown }).timestamp
    if (method === 'totp' && typeof timestamp === 'number') {
      latest = latest === null ? timestamp : Math.max(latest, timestamp)
    }
  }
  return latest === null ? null : new Date(latest * 1000)
}

function minutesSince(date: Date | null): number {
  if (!date) return Number.POSITIVE_INFINITY
  return (Date.now() - date.getTime()) / 60_000
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return fail(405, 'invalid_request', 'Método não suportado.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization') ?? ''

  // 1. Quem está pedindo. Sem JWT válido, 401 — antes de ler o corpo.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser()
  if (authError || !user) return fail(401, 'unauthorized', 'Sessão inválida.')

  const claims = claimsOf(authorization)
  if (!claims) return fail(401, 'unauthorized', 'Sessão inválida.')

  // 2. O papel, lido do banco com service role. Nunca do corpo do pedido.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  const role = roleRow?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return fail(403, 'forbidden', 'Sem permissão para esta operação.')
  }

  // 3. MFA: aal2, sessão administrativa dentro da hora, verificação recente.
  //    A exigência é um interruptor do owner (`admin.security.requireMfa`);
  //    desligado, papel basta — e o painel avisa em vermelho.
  const { data: security } = await admin.rpc('setting_value', { p_key: 'admin.security' })
  const mfaRequired = (security as { requireMfa?: unknown } | null)?.requireMfa !== false
  const verifiedAt = totpVerifiedAt(claims)
  if (mfaRequired && claims['aal'] !== 'aal2') {
    return fail(403, 'mfa_required', 'Esta operação exige verificação em duas etapas.')
  }
  if (mfaRequired && minutesSince(verifiedAt) > SESSION_MAX_MINUTES) {
    return fail(403, 'session_expired', 'Sessão administrativa expirada: confirme o segundo fator de novo.')
  }
  if (mfaRequired && minutesSince(verifiedAt) > STEP_UP_MAX_MINUTES) {
    return fail(403, 'step_up_required', 'Ação crítica: confirme o segundo fator novamente.')
  }

  // 4. O pedido.
  let body: ActionRequest
  try {
    const raw = (await request.json()) as Partial<ActionRequest>
    if (!raw.action || !ACTIONS.has(raw.action)) throw new Error('action')
    const isInvite = raw.action === 'invite_user'
    if (isInvite) {
      if (typeof raw.email !== 'string' || !EMAIL.test(raw.email.trim())) throw new Error('email')
      if (typeof raw.name !== 'string' || raw.name.trim().length < 2) throw new Error('name')
    } else if (typeof raw.userId !== 'string' || !UUID.test(raw.userId)) throw new Error('userId')
    if (typeof raw.reason !== 'string' || raw.reason.trim().length < 5) throw new Error('reason')
    if (raw.requestId != null && (typeof raw.requestId !== 'string' || !UUID.test(raw.requestId))) {
      throw new Error('requestId')
    }
    body = {
      action: raw.action,
      userId: isInvite ? '' : (raw.userId as string),
      reason: raw.reason.trim().slice(0, 280),
      requestId: raw.requestId ?? null,
      email: isInvite ? (raw.email as string).trim().toLowerCase() : null,
      name: isInvite ? (raw.name as string).trim().slice(0, 60) : null,
    }
  } catch {
    return fail(400, 'invalid_request', 'Pedido malformado: ação, conta e motivo (mínimo 5 caracteres) são obrigatórios.')
  }

  // Contexto pra auditoria: só IP e agente, truncado. Nada do corpo.
  const context = {
    ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim().slice(0, 45) || null,
    ua: (request.headers.get('user-agent') ?? '').slice(0, 120) || null,
    via: 'admin-actions',
  }

  const audit = async (action: string, result: 'ok' | 'negado' | 'erro', reason: string, after: unknown = null) => {
    await admin.rpc('record_admin_audit', {
      p_action: action,
      p_resource_type: 'user',
      p_resource_id: body.userId,
      p_target_user: body.userId,
      p_result: result,
      p_reason: reason,
      p_before: null,
      p_after: after,
      p_context: context,
    })
  }

  // 5. Executar. As quatro primeiras rodam no banco COM O JWT DA PESSOA, então
  //    `assert_admin_step_up` confere papel e carimbo de novo lá dentro.
  try {
    switch (body.action) {
      case 'invite_user': {
        // O GoTrue manda o link de convite; a pessoa escolhe a senha lá. O
        // e-mail não volta pro painel nem pra auditoria: só o id criado.
        const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email as string, {
          data: { name: body.name },
          redirectTo: `${Deno.env.get('MOMENTUMM_SITE_URL') ?? 'https://momentumm.app'}/nova-senha`,
        })
        if (error || !data.user) {
          await admin.rpc('record_admin_audit', {
            p_action: 'user.invite', p_resource_type: 'user', p_resource_id: null, p_target_user: null,
            p_result: 'erro', p_reason: body.reason, p_before: null, p_after: null, p_context: context,
          })
          return fail(409, 'invite_failed', 'Não consegui convidar: e-mail já cadastrado ou limite de envio.')
        }
        await admin.rpc('record_admin_audit', {
          p_action: 'user.invite', p_resource_type: 'user', p_resource_id: data.user.id, p_target_user: data.user.id,
          p_result: 'ok', p_reason: body.reason, p_before: null, p_after: null, p_context: context,
        })
        return reply(200, { ok: true, userId: data.user.id })
      }
      case 'suspend': {
        const { error } = await asUser.rpc('admin_suspend_user', {
          p_user: body.userId,
          p_reason: body.reason,
          p_context: context,
        })
        if (error) return fail(403, 'refused', error.message)
        return reply(200, { ok: true })
      }
      case 'reactivate': {
        const { error } = await asUser.rpc('admin_reactivate_user', {
          p_user: body.userId,
          p_reason: body.reason,
          p_context: context,
        })
        if (error) return fail(403, 'refused', error.message)
        return reply(200, { ok: true })
      }
      case 'revoke_sessions': {
        const { error } = await asUser.rpc('admin_revoke_sessions', {
          p_user: body.userId,
          p_reason: body.reason,
          p_context: context,
        })
        if (error) return fail(403, 'refused', error.message)
        return reply(200, { ok: true })
      }
      case 'start_deletion': {
        if (!body.requestId) {
          return fail(400, 'invalid_request', 'A exclusão exige a solicitação aberta pela pessoa.')
        }
        const { data, error } = await asUser.rpc('admin_start_deletion', {
          p_user: body.userId,
          p_request: body.requestId,
          p_reason: body.reason,
          p_context: context,
        })
        if (error) return fail(403, 'refused', error.message)
        return reply(200, { ok: true, result: data })
      }
      case 'resend_confirmation': {
        // GoTrue só reenvia pra conta ainda não confirmada; o e-mail nunca
        // volta pro painel — a função lê e usa, e só.
        const { data: target, error: lookupError } = await admin.auth.admin.getUserById(body.userId)
        if (lookupError || !target.user?.email) {
          await audit('user.resend_confirmation', 'erro', body.reason)
          return fail(404, 'not_found', 'Conta não encontrada.')
        }
        if (target.user.email_confirmed_at) {
          await audit('user.resend_confirmation', 'negado', 'e-mail já confirmado')
          return fail(409, 'already_confirmed', 'Esse e-mail já está confirmado.')
        }
        const { error } = await asUser.auth.resend({ type: 'signup', email: target.user.email })
        if (error) {
          await audit('user.resend_confirmation', 'erro', body.reason)
          return fail(502, 'provider_error', 'Não consegui reenviar agora. O limite é um envio por minuto por endereço.')
        }
        await audit('user.resend_confirmation', 'ok', body.reason)
        return reply(200, { ok: true })
      }
      case 'complete_deletion': {
        // Só depois do prazo agendado por `admin_start_deletion`. O banco
        // responde se está pronto; a função apaga arquivos e depois a conta,
        // e a conta leva junto (por cascata) todas as tabelas do domínio.
        const { data: ready } = await admin.rpc('deletion_ready', { p_user: body.userId })
        if (ready !== true) {
          await audit('user.deletion_complete', 'negado', 'prazo não vencido ou exclusão não iniciada')
          return fail(409, 'not_ready', 'A exclusão ainda não foi iniciada ou o prazo de 7 dias não venceu.')
        }
        for (const folder of ['fotos', 'audios', 'anexos']) {
          const { data: files } = await admin.storage.from('user-media').list(`${body.userId}/${folder}`, { limit: 1000 })
          const paths = (files ?? []).map((file) => `${body.userId}/${folder}/${file.name}`)
          if (paths.length > 0) await admin.storage.from('user-media').remove(paths)
        }
        // A auditoria ANTES do delete: depois dele o alvo já não existe e a
        // chave estrangeira viraria nulo. A linha diz o id no resource_id.
        await audit('user.deletion_complete', 'ok', body.reason, { storage_purged: true })
        const { error } = await admin.auth.admin.deleteUser(body.userId)
        if (error) {
          await audit('user.deletion_complete', 'erro', body.reason)
          return fail(502, 'provider_error', 'Os arquivos foram removidos, mas a conta não pôde ser apagada agora.')
        }
        return reply(200, { ok: true })
      }
    }
  } catch (cause) {
    // Nunca o objeto do erro: só o suficiente pra central de erros.
    await admin.rpc('report_error', {
      p_code: 'admin_actions.unhandled',
      p_module: 'edge_function',
      p_message: cause instanceof Error ? `${cause.name}: ${cause.message}` : 'erro desconhecido',
      p_environment: 'producao',
      p_app_version: 'admin-actions@1',
      p_severity: 'alta',
    })
    return fail(500, 'internal', 'Falha ao executar a ação.')
  }

  return fail(400, 'invalid_request', 'Ação desconhecida.')
})
