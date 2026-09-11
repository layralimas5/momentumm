/**
 * O que a Edge Function `momentumm-ai` importa do domínio.
 *
 * O bundler do Supabase não resolve import sem extensão (`./ai-context` em
 * vez de `./ai-context.ts`), e o app inteiro é escrito assim. Em vez de
 * reescrever o domínio pra agradar o Deno, este arquivo é o ponto de entrada
 * que o esbuild empacota em `supabase/functions/momentumm-ai/shared.ts`
 * (`npm run ai:bundle`). A função importa o pacote, e a regra continua
 * morando num lugar só: aqui.
 */
export {
  AI_OUTPUT_SCHEMAS,
  AI_SYSTEM_PROMPT,
  aiEndpointRequestSchema,
  userPromptFor,
  type AiEndpointRequest,
} from './ai-prompts'
export type { AiErrorCode } from './ai-error'
export { PLAN_LIMITS, type PlanTier } from '../entities/plan'
