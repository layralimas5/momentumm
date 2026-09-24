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
  'reminder_enabled',
  'reminder_disabled',

  /*
    O laço de retenção. Nada aqui duplica o que já existia: "abriu o app" é
    `session_start`, "viu o Hoje" é `feature_view`, "concluiu uma ação" é
    `task_completed`. Só entram os passos que ainda não tinham registro.
  */
  'primary_action_viewed',
  'action_started',
  'day_completed',
  'day_adapt_requested',
  'day_adapt_completed',
  'recovery_shown',
  'recovery_completed',
  'review_started',
  'achievement_unlocked',

  /* Juntos — a dupla de accountability. */
  'pair_invite_created',
  'pair_invite_opened',
  'pair_invite_accepted',
  'pair_created',
  'pair_viewed',
  'encouragement_sent',
  'encouragement_received',
  'pair_return_started',
  'pair_left',

  /*
    Gatilhos de retorno.

    Não existe `notification_scheduled`: a arquitetura não agenda nada com
    antecedência. O banco DECIDE o aviso na hora do envio (`decide_notification`),
    e um evento de agendamento seria um nome sem fato por trás.
  */
  'notification_sent',
  'notification_opened',
  'notification_converted',
  'notification_failed',

  /*
    A permissão e o aparelho. Sem eles a única leitura possível é "poucas
    pessoas recebem aviso", sem saber onde a fila quebra: se o convite não
    aparece, se aparece e ninguém aceita, ou se o navegador recusa depois.
  */
  'notification_permission_prompted',
  'notification_permission_granted',
  'notification_permission_denied',
  'push_subscription_created',

  /* Instalação do app. `pwa_installed` só existe no Android: o iOS não avisa. */
  'pwa_install_prompted',
  'pwa_installed',
  'ios_install_shown',
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
  'juntos',
  'notificacoes',
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
  juntos: 'Juntos',
  notificacoes: 'Notificações',
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
  /** uuid da ação. Cabe no teto de 40 caracteres que o banco aplica. */
  readonly action_id?: string
  readonly objective_id?: string
  /** A ação era a destacada como "o que importa hoje"? */
  readonly primary?: boolean
  readonly xp?: number
  readonly minutes?: number
  /** Estado da tela Hoje no momento do evento (`TodayStateKey`). */
  readonly state?: string
  readonly days_since_signup?: number
  readonly days_since_activity?: number
  readonly notification_type?: string
  readonly trigger?: string
  readonly destination?: string
  /** Tempo entre o envio da notificação e a abertura dela. */
  readonly elapsed_ms?: number
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
    ['/app/juntos', 'juntos'],
  ]
  for (const [prefix, feature] of table) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return feature
  }
  return null
}

export function isProductEvent(value: string): value is ProductEventName {
  return (PRODUCT_EVENTS as readonly string[]).includes(value)
}
