import { isQuizTheme, type QuizThemeKey } from '@/domain/entities/quiz'

/**
 * O funil de aquisição: do carrossel até a assinatura.
 *
 * Os nomes são a mesma lista de `public.quiz_event_names()`. O banco recusa
 * nome fora dela, e o teste em `funnel-events.test.ts` confere que as duas
 * listas batem. Metade dos eventos acontece ANTES de existir conta, então
 * eles não passam por `product_events` (que exige sessão): a sessão anônima
 * do quiz é a chave.
 *
 * Os seis primeiros são da LANDING, e por isso vêm antes de `quiz_viewed`:
 * a mesma sessão que registra a visita registra o quiz depois, e é isso que
 * responde "qual conteúdo trouxe alguém que começou o quiz". Sem eles a
 * página inicial era um buraco no funil: dava pra ver quem começou o quiz e
 * quem assinou, nunca quem chegou e foi embora antes de clicar.
 */
export const FUNNEL_EVENTS = [
  'landing_viewed',
  'hero_cta_clicked',
  'secondary_cta_clicked',
  'pricing_viewed',
  'pricing_cta_clicked',
  'faq_opened',
  'quiz_viewed',
  'quiz_started',
  'quiz_question_answered',
  'quiz_completed',
  'quiz_abandoned',
  'lead_captured',
  'diagnosis_viewed',
  'plan_preview_viewed',
  'signup_started',
  'signup_completed',
  'plan_activated',
  'first_action_completed',
  'trial_started',
  'checkout_started',
  'subscription_completed',
] as const
export type FunnelEventName = (typeof FUNNEL_EVENTS)[number]

/** A ordem do funil como o painel vai mostrar. */
export const FUNNEL_STAGES: readonly { readonly event: FunnelEventName; readonly label: string }[] = [
  { event: 'landing_viewed', label: 'Visitas na página' },
  { event: 'quiz_viewed', label: 'Abriram o quiz' },
  { event: 'quiz_started', label: 'Inícios do quiz' },
  { event: 'quiz_completed', label: 'Quiz concluído' },
  { event: 'lead_captured', label: 'Contato deixado' },
  { event: 'signup_completed', label: 'Cadastro' },
  { event: 'plan_activated', label: 'Plano ativado' },
  { event: 'first_action_completed', label: 'Primeira ação' },
  { event: 'trial_started', label: 'Trial' },
  { event: 'subscription_completed', label: 'Assinatura' },
]

/** De onde a pessoa veio. Só chaves conhecidas e valores curtos. */
export interface QuizAttribution {
  readonly source: string | null
  readonly medium: string | null
  readonly campaign: string | null
  readonly content: string | null
  readonly theme: QuizThemeKey | null
}

export const EMPTY_ATTRIBUTION: QuizAttribution = {
  source: null,
  medium: null,
  campaign: null,
  content: null,
  theme: null,
}

export const MAX_ATTRIBUTION_LENGTH = 60

/** Lê `utm_*` e `tema` da URL. Valor comprido é cortado; caractere estranho, removido. */
export function readAttribution(params: URLSearchParams): QuizAttribution {
  const theme = params.get('tema')
  return {
    source: clean(params.get('utm_source')),
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
    theme: isQuizTheme(theme) ? theme : null,
  }
}

export function hasAttribution(value: QuizAttribution): boolean {
  return (
    value.source !== null ||
    value.medium !== null ||
    value.campaign !== null ||
    value.content !== null ||
    value.theme !== null
  )
}

function clean(value: string | null): string | null {
  if (!value) return null
  const trimmed = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, MAX_ATTRIBUTION_LENGTH)
  return trimmed.length > 0 ? trimmed : null
}
