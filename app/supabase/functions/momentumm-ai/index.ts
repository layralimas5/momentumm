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
//   5. registra a chamada em `ai_calls` (tokens, tipo, modelo; nunca conteúdo)
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

  // 3. Teto diário pelo plano. Lido com service role: `profiles.plan` é
  //    protegido por trigger contra escrita do dono, e a leitura aqui é a
  //    fonte de verdade que o cliente não consegue forjar.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()
  const tier: PlanTier = profile?.plan === 'pro' ? 'pro' : 'free'
  const limit = PLAN_LIMITS[tier].aiCallsPerMonth

  // A IA é do PRO. Sem franquia o pedido nem chega no modelo: o app já
  // esconde os botões, e esta é a porta que o cliente não consegue contornar.
  if (limit <= 0) {
    return fail(403, 'plan_required', 'A Momentumm AI faz parte do PRO.')
  }

  // Franquia MENSAL, contada no mês corrente (UTC). Reinicia no dia 1.
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const { count } = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString())
  const used = count ?? 0

  if (used >= limit) {
    return fail(
      429,
      'quota_exceeded',
      `Você já usou as ${limit} leituras da IA deste mês. A franquia renova no dia 1.`,
    )
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
      return fail(502, 'invalid_output', 'A IA não devolveu uma resposta no formato esperado.')
    }
    parsed = response.parsed_output
  } catch (cause) {
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
  await admin.from('ai_calls').insert({
    user_id: user.id,
    kind: endpointRequest.kind,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  })

  return reply(200, { result: parsed, usage: { used: used + 1, limit } })
})
