// Momentumm AI — o endpoint.
//
// É a única porta entre o app e o modelo. A chave da Anthropic mora no
// segredo desta função (`ANTHROPIC_API_KEY`) e nunca sai daqui; o app manda
// o contexto da conta com o JWT da pessoa, e a função:
//
//   1. confirma quem está pedindo (JWT válido = usuário do Supabase)
//   2. lê o plano da conta e conta as chamadas de hoje: teto por plano
//   3. monta o prompt com as MESMAS regras que o app conhece
//      (`src/domain/ai/ai-prompts.ts`, compartilhado via import map)
//   4. chama o modelo com saída estruturada e valida a resposta com o zod
//   5. registra a chamada em `ai_calls` (tokens, tipo, modelo, duração e
//      resultado; nunca conteúdo) — inclusive as recusadas por limite,
//      bloqueio ou erro, com zero tokens, pra central de IA do painel
//
// Os tetos vêm de `product_settings` (`ai.limits`, editado pelo owner no
// painel): desligamento geral, função por função, franquia mensal por
// plano, teto diário de segurança, ritmo por minuto e bloqueio por conta
// (`ai_blocks`). `PLAN_LIMITS` do domínio é o padrão quando a chave não
// existe.
//
// Nada do pedido ou da resposta vai pra log: nem prompt, nem contexto, nem
// JWT. O que a função escreve em `ai_calls` é o suficiente pra teto e custo.
//
// Deploy:
//   supabase functions deploy momentumm-ai
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (opcional) supabase secrets set MOMENTUMM_AI_MODEL=claude-opus-5
//
// `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já vêm
// injetados pelo runtime das Edge Functions.

import Anthropic from 'npm:@anthropic-ai/sdk@0.125.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.125.0/helpers/zod'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
// `shared.ts` é gerado por `npm run ai:bundle` a partir de
// `src/domain/ai/edge-shared.ts`: o bundler do Supabase não resolve os imports
// sem extensão do app, então o domínio chega aqui já empacotado.
import {
  AI_OUTPUT_SCHEMAS,
  AI_SYSTEM_PROMPT,
  aiEndpointRequestSchema,
  PLAN_LIMITS,
  userPromptFor,
  type AiEndpointRequest,
  type AiErrorCode,
  type PlanTier,
} from './shared.ts'

const DEFAULT_MODEL = 'claude-opus-5'
/** Por pessoa. Cinco leituras num minuto já é mais do que qualquer tela pede. */
const DEFAULT_CALLS_PER_MINUTE = 5
/** Teto diário de segurança: acima disso é script, não uso. */
const DEFAULT_DAILY_SAFETY_LIMIT = 25

interface AiLimits {
  readonly enabled: boolean
  readonly monthlyPerPlan: Readonly<Record<PlanTier, number>>
  readonly dailySafetyLimit: number
  readonly perMinute: number
  readonly kinds: Readonly<Record<string, boolean>>
}

function readLimits(raw: unknown): AiLimits {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const monthly = (typeof value['monthlyPerPlan'] === 'object' && value['monthlyPerPlan'] !== null
    ? value['monthlyPerPlan']
    : {}) as Record<string, unknown>
  const number = (candidate: unknown, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback
  return {
    enabled: value['enabled'] !== false,
    monthlyPerPlan: {
      free: number(monthly['free'], PLAN_LIMITS.free.aiCallsPerMonth),
      pro: number(monthly['pro'], PLAN_LIMITS.pro.aiCallsPerMonth),
    },
    dailySafetyLimit: number(value['dailySafetyLimit'], DEFAULT_DAILY_SAFETY_LIMIT),
    perMinute: number(value['perMinute'], DEFAULT_CALLS_PER_MINUTE),
    kinds: (typeof value['kinds'] === 'object' && value['kinds'] !== null ? value['kinds'] : {}) as Record<string, boolean>,
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fail(status: number, code: AiErrorCode, message: string): Response {
  return reply(status, { error: { code, message } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return fail(405, 'invalid_request', 'Método não suportado.')

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return fail(503, 'not_configured', 'A Momentumm AI ainda não foi configurada nesse ambiente.')
  }

  // 1. Quem está pedindo. O cliente com a anon key + o JWT da pessoa é o que
  //    faz `auth.getUser()` responder; sem JWT válido, 401.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization') ?? ''

  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser()
  if (authError || !user) return fail(401, 'unauthorized', 'Sessão inválida. Entra de novo.')

  // 2. O pedido. O contexto é validado só na forma: quem monta é o app, e a
  //    IA lê o que estiver lá como texto.
  let endpointRequest: AiEndpointRequest
  try {
    const raw: unknown = await request.json()
    endpointRequest = aiEndpointRequestSchema.parse(raw) as AiEndpointRequest
  } catch {
    return fail(400, 'invalid_request', 'Pedido malformado.')
  }

  // 3. Tetos. O plano vem de `plan_for_user` (assinatura, cortesia ou teste
  //    de 7 dias, avaliados AGORA) e `ai.limits` de `product_settings`, os dois
  //    lidos com service role: são as fontes de verdade que o cliente não
  //    consegue forjar, e um teste vencido não passa por aqui mesmo que o
  //    agendador ainda não tenha fechado a linha.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const startedAt = Date.now()

  const record = async (
    status: 'ok' | 'erro' | 'limite' | 'bloqueado',
    errorCode: string | null,
    usage = { input_tokens: 0, output_tokens: 0 },
    model = DEFAULT_MODEL,
  ) => {
    await admin.from('ai_calls').insert({
      user_id: user.id,
      kind: endpointRequest.kind,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      status,
      error_code: errorCode,
      duration_ms: Date.now() - startedAt,
    })
  }

  const [{ data: effectivePlan }, { data: rawLimits }] = await Promise.all([
    admin.rpc('plan_for_user', { p_user: user.id }),
    admin.rpc('setting_value', { p_key: 'ai.limits' }),
  ])
  const tier: PlanTier = effectivePlan === 'pro' ? 'pro' : 'free'
  const limits = readLimits(rawLimits)
  const limit = limits.monthlyPerPlan[tier]

  if (!limits.enabled) {
    await record('bloqueado', 'disabled')
    return fail(503, 'not_configured', 'A Momentumm AI está temporariamente desligada.')
  }
  if (limits.kinds[endpointRequest.kind] === false) {
    await record('bloqueado', 'kind_disabled')
    return fail(503, 'not_configured', 'Essa função da IA está temporariamente indisponível.')
  }

  // A IA é do PRO. Sem franquia o pedido nem chega no modelo: o app já
  // esconde os botões, e esta é a porta que o cliente não consegue contornar.
  if (limit <= 0) {
    await record('limite', 'plan_required')
    return fail(403, 'plan_required', 'A Momentumm AI faz parte do PRO.')
  }

  const { data: blocked } = await admin.rpc('ai_block_active', { p_user: user.id })
  if (blocked === true) {
    await record('bloqueado', 'account_blocked')
    return fail(403, 'unauthorized', 'A Momentumm AI está temporariamente bloqueada nesta conta.')
  }

  // Franquia MENSAL, contada no mês corrente (UTC). Só chamada concluída gasta.
  const { data: usedRaw } = await admin.rpc('ai_calls_this_month', { p_user: user.id })
  const used = typeof usedRaw === 'number' ? usedRaw : 0

  if (used >= limit) {
    await record('limite', 'quota_exceeded')
    return fail(
      429,
      'quota_exceeded',
      `Você já usou as ${limit} leituras da IA deste mês. A franquia renova no dia 1.`,
    )
  }

  // Teto diário de segurança: segura custo de conta comprometida ou script.
  const { data: todayRaw } = await admin.rpc('ai_calls_today_for', { p_user: user.id })
  if ((typeof todayRaw === 'number' ? todayRaw : 0) >= limits.dailySafetyLimit) {
    await record('limite', 'daily_limit')
    return fail(429, 'rate_limited', 'Limite diário de leituras atingido. Volta amanhã.')
  }

  // Ritmo: a franquia segura o custo do mês; isto segura script e duplo toque.
  const { data: lastMinute } = await admin.rpc('ai_calls_last_minute', { p_user: user.id })
  if ((lastMinute ?? 0) >= limits.perMinute) {
    await record('limite', 'rate_limited')
    return fail(429, 'rate_limited', 'Muitas leituras seguidas. Espera um minuto e tenta de novo.')
  }

  // 4. O modelo. Saída estruturada validada pelo mesmo schema que o app usa
  //    ao ler a resposta; `parsed_output` nulo é resposta que não fechou.
  const model = Deno.env.get('MOMENTUMM_AI_MODEL') ?? DEFAULT_MODEL
  const schema = AI_OUTPUT_SCHEMAS[endpointRequest.kind]
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let parsed: unknown
  let usage = { input_tokens: 0, output_tokens: 0 }
  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 4096,
      system: [{ type: 'text', text: AI_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPromptFor(endpointRequest) }],
      output_config: { effort: 'medium', format: zodOutputFormat(schema) },
    })
    usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }

    if (response.stop_reason === 'refusal' || response.parsed_output === null) {
      await record('erro', 'invalid_output', usage, model)
      return fail(502, 'invalid_output', 'A IA não devolveu uma resposta no formato esperado.')
    }
    parsed = response.parsed_output
  } catch (cause) {
    const code =
      cause instanceof Anthropic.RateLimitError ? 'model_rate_limited'
      : cause instanceof Anthropic.AuthenticationError ? 'model_auth'
      : cause instanceof Anthropic.APIError ? `model_${cause.status}`
      : 'model_unreachable'
    await record('erro', code, usage, model)
    // A central de erros recebe só código e classe: nem prompt, nem contexto.
    await admin.rpc('report_error', {
      p_code: `momentumm_ai.${code}`,
      p_module: 'ai',
      p_message: cause instanceof Error ? `${cause.name}: ${cause.message}` : 'erro desconhecido',
      p_environment: 'producao',
      p_app_version: 'momentumm-ai@2',
      p_severity: cause instanceof Anthropic.AuthenticationError ? 'critica' : 'alta',
    })
    if (cause instanceof Anthropic.RateLimitError) {
      return fail(503, 'model_unavailable', 'A IA está no limite agora. Tenta de novo em um minuto.')
    }
    if (cause instanceof Anthropic.AuthenticationError) {
      return fail(503, 'not_configured', 'A chave da Momentumm AI foi recusada. Confere o segredo da função.')
    }
    if (cause instanceof Anthropic.APIError) {
      return fail(502, 'model_unavailable', `A IA respondeu com erro (${cause.status}). Tenta de novo.`)
    }
    return fail(502, 'model_unavailable', 'Não deu pra falar com a IA agora.')
  }

  // 5. Registro. Nunca o conteúdo: só o suficiente pra teto, custo e auditoria.
  await record('ok', null, usage, model)

  return reply(200, { result: parsed, usage: { used: used + 1, limit } })
})
