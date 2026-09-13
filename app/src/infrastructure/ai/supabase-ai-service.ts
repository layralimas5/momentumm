import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import type { z } from 'zod/v4'
import { AiError, isAiErrorCode } from '@/domain/ai/ai-error'
import {
  AI_FUNCTION_NAME,
  AI_OUTPUT_SCHEMAS,
  type AiEndpointRequest,
  type AiKind,
} from '@/domain/ai/ai-prompts'
import type {
  AiDayPlan,
  AiDayRequest,
  AiPlanRequest,
  AiPlanSuggestion,
  AiProgressReading,
  AiProgressRequest,
  AiQuota,
  AiRecoveryPlan,
  AiRecoveryRequest,
  AiReviewDraft,
  AiReviewDraftRequest,
  AiReviewRequest,
  AiService,
} from '@/domain/ai/ai-service'
import { track } from '@/infrastructure/analytics/track'
import { supabase } from '@/infrastructure/supabase/client'
import { InfrastructureError } from '@/shared/errors'

/**
 * Momentumm AI — a implementação REAL, pela Edge Function `momentumm-ai`.
 *
 * O app nunca fala com o modelo: manda o pedido (com o contexto da conta) pra
 * função, autenticado com a sessão da pessoa, e recebe de volta a estrutura
 * já validada no servidor. Aqui ela é validada DE NOVO, com o mesmo schema
 * (`ai-prompts`): a fronteira entre dois processos é sempre um lugar onde o
 * formato pode ter divergido, e a prévia editável confia no que recebe.
 */

const NOT_CONFIGURED = 'A Momentumm AI ainda não está disponível nesse ambiente.'

interface EndpointFailure {
  readonly error?: { readonly code?: string; readonly message?: string }
}

interface EndpointSuccess {
  readonly result: unknown
  readonly usage?: { readonly used: number; readonly limit: number }
}

export class SupabaseAiService implements AiService {
  readonly simulated = false
  /** A franquia como o servidor a contou na última resposta. Null até a primeira chamada. */
  quota: AiQuota | null = null

  buildPlan(request: AiPlanRequest): Promise<AiPlanSuggestion> {
    return this.call({ kind: 'plan', request })
  }

  reorganizeDay(request: AiDayRequest): Promise<AiDayPlan> {
    return this.call({ kind: 'day', request })
  }

  readProgress(request: AiProgressRequest): Promise<AiProgressReading> {
    return this.call({ kind: 'progress', request })
  }

  draftReview(request: AiReviewDraftRequest): Promise<AiReviewDraft> {
    return this.call({ kind: 'review_draft', request })
  }

  planRecovery(request: AiRecoveryRequest): Promise<AiRecoveryPlan> {
    return this.call({ kind: 'recovery', request })
  }

  async summarizeReview(request: AiReviewRequest): Promise<string> {
    const { summary } = await this.call({ kind: 'review', request })
    return summary
  }

  private async call<K extends AiKind>(
    endpointRequest: Extract<AiEndpointRequest, { kind: K }>,
  ): Promise<z.infer<(typeof AI_OUTPUT_SCHEMAS)[K]>> {
    const startedAt = Date.now()
    const { data, error } = await supabase().functions.invoke<EndpointSuccess>(AI_FUNCTION_NAME, {
      body: endpointRequest,
    })

    if (error) {
      const translated = await translate(error)
      track('ai_call', 'ai', {
        kind: endpointRequest.kind,
        result: translated instanceof AiError ? translated.code : 'erro',
        duration_ms: Date.now() - startedAt,
      })
      throw translated
    }
    track('ai_call', 'ai', { kind: endpointRequest.kind, result: 'ok', duration_ms: Date.now() - startedAt })
    if (!data) throw new AiError('invalid_output', 'A IA respondeu vazio.')
    if (data.usage) this.quota = { used: data.usage.used, limit: data.usage.limit }

    const parsed = AI_OUTPUT_SCHEMAS[endpointRequest.kind].safeParse(data.result)
    if (!parsed.success) {
      throw new AiError('invalid_output', 'A IA devolveu um formato que o app não reconhece.')
    }
    return parsed.data as z.infer<(typeof AI_OUTPUT_SCHEMAS)[K]>
  }
}

/** O erro do functions-js vira um erro que a tela sabe mostrar. */
async function translate(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context
    if (response instanceof Response) {
      // 404 é a função ainda não implantada: o caso mais comum antes do deploy.
      if (response.status === 404) return new AiError('not_configured', NOT_CONFIGURED)
      const body = await readFailure(response)
      const code = body?.error?.code
      if (isAiErrorCode(code)) {
        return new AiError(code, body?.error?.message ?? NOT_CONFIGURED)
      }
    }
    return new AiError('model_unavailable', 'A IA respondeu com erro. Tenta de novo.')
  }

  if (error instanceof FunctionsFetchError) {
    // Função ausente responde ao preflight sem CORS, e o navegador entrega
    // isso como falha de rede: daqui não dá pra separar "não implantada" de
    // "sem conexão", então a mensagem cobre as duas.
    return new AiError(
      'model_unavailable',
      'Não consegui falar com a Momentumm AI. Ou ela ainda não foi configurada nesse ambiente, ou a conexão caiu.',
    )
  }

  return new InfrastructureError('Falha ao chamar a Momentumm AI.', error)
}

async function readFailure(response: Response): Promise<EndpointFailure | null> {
  try {
    return (await response.json()) as EndpointFailure
  } catch {
    return null
  }
}
