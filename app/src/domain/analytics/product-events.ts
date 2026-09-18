/**
 * Os eventos de uso que o app registra — e SÓ eles.
 *
 * A lista é a mesma de `public.product_event_names()`: o banco recusa nome
 * fora dela, então mudar aqui sem mudar lá só produz evento que não grava.
 * Nenhum evento carrega texto escrito pela pessoa: o payload é fechado por
 * chave (`ProductEventMetadata`) e cada valor é curto.
 */
export const PRODUCT_EVENTS = [
  'session_start',
  'feature_view',
  'onboarding_completed',
  'objective_created',
  'task_created',
  'task_completed',
  'habit_logged',
  'review_completed',
  'momentum_viewed',
  'ai_call',
  'recovery_started',
  'share_exported',
  'record_created',
  'cancellation_requested',
  'support_opened',
  'plan_limit_hit',
  'checkout_started',
  'subscription_canceled',
  'trial_started',
  'trial_ended',
] as const
export type ProductEventName = (typeof PRODUCT_EVENTS)[number]

export const PRODUCT_FEATURES = [
  'hoje',
  'objetivos',
  'habitos',
  'plano',
  'progresso',
  'review',
  'momentum_score',
  'ai',
  'retomada',
  'compartilhamento',
  'registro_texto',
  'registro_foto',
  'registro_voz',
  'circulo',
  'desafios',
  'foco',
  'insights',
  'perfil',
  'evolucao',
  'configuracoes',
  'assinatura',
] as const
export type ProductFeature = (typeof PRODUCT_FEATURES)[number]

export const FEATURE_LABELS: Readonly<Record<ProductFeature, string>> = {
  hoje: 'Hoje',
  objetivos: 'Objetivos',
  habitos: 'Hábitos',
  plano: 'Plano',
  progresso: 'Progresso',
  review: 'Review semanal',
  momentum_score: 'Momentumm Score',
  ai: 'Momentumm AI',
  retomada: 'Modo Retomada',
  compartilhamento: 'Compartilhamento',
  registro_texto: 'Registro por texto',
  registro_foto: 'Registro por foto',
  registro_voz: 'Registro por voz',
  circulo: 'Círculo',
  desafios: 'Desafios',
  foco: 'Foco',
  insights: 'Leituras do ritmo',
  perfil: 'Perfil',
  evolucao: 'Evolução',
  configuracoes: 'Configurações',
  assinatura: 'Assinatura',
}

/** Só estas chaves entram. O banco descarta o resto. */
export interface ProductEventMetadata {
  readonly kind?: string
  readonly mode?: string
  readonly template?: string
  readonly source?: string
  readonly count?: number
  readonly duration_ms?: number
  readonly result?: string
  readonly limit?: string
}

/**
 * Que recurso cada rota do app representa. Rota sem recurso (detalhe de
 * desafio, perfil de amigo) não gera visualização — ela é parte do recurso
 * pai, e contar duas vezes inflaria o pai.
 */
export function featureForRoute(pathname: string): ProductFeature | null {
  const path = pathname.replace(/\/+$/, '')
  if (path === '/app') return 'hoje'
  const table: readonly (readonly [string, ProductFeature])[] = [
    ['/app/objetivos', 'objetivos'],
    ['/app/habitos', 'habitos'],
    ['/app/plano', 'plano'],
    ['/app/progresso', 'progresso'],
    ['/app/review', 'review'],
    ['/app/ia', 'ai'],
    ['/app/circulo', 'circulo'],
    ['/app/desafios', 'desafios'],
    ['/app/foco', 'foco'],
    ['/app/insights', 'insights'],
    ['/app/perfil', 'perfil'],
    ['/app/evolucao', 'evolucao'],
    ['/app/configuracoes', 'configuracoes'],
    ['/app/assinatura', 'assinatura'],
  ]
  for (const [prefix, feature] of table) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return feature
  }
  return null
}

export function isProductEvent(value: string): value is ProductEventName {
  return (PRODUCT_EVENTS as readonly string[]).includes(value)
}
