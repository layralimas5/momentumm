/**
 * Os gatilhos de retorno.
 *
 * Cada tipo existe pra responder uma pergunta diferente de "por que abrir o
 * app agora". A lista é a mesma do enum `public.notification_type` — o banco
 * recusa o que não estiver nela.
 */

export const NOTIFICATION_TYPES = [
  'proximo_passo',
  'continuidade',
  'progresso',
  'dia_dificil',
  'retomada',
  'social',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface NotificationSpec {
  readonly type: NotificationType
  readonly label: string
  /** O que a pessoa recebe, em uma frase. Aparece na tela de preferências. */
  readonly description: string
  /** Ligado por padrão numa conta nova. */
  readonly defaultOn: boolean
}

/**
 * `progresso` nasce desligado, e é o único.
 *
 * É a única categoria que não pede ação de quem recebe — é uma leitura, e
 * leitura pode esperar a pessoa abrir o app por conta própria. Um aviso que
 * não muda o que alguém vai fazer é o primeiro a ensinar a ignorar os outros.
 */
export const NOTIFICATION_SPECS: readonly NotificationSpec[] = [
  {
    type: 'proximo_passo',
    label: 'Próximo passo',
    description: 'Quando existe uma ação sua pra hoje e o dia ainda cabe.',
    defaultOn: true,
  },
  {
    type: 'continuidade',
    label: 'Continuidade',
    description: 'Quando você avançou ontem e o próximo passo já está pronto.',
    defaultOn: true,
  },
  {
    type: 'dia_dificil',
    label: 'Dia difícil',
    description: 'No fim do dia, quando a ação continua em aberto, com a saída de adaptar.',
    defaultOn: true,
  },
  {
    type: 'retomada',
    label: 'Retomada',
    description: 'Depois de alguns dias parados, pra lembrar que nada foi perdido.',
    defaultOn: true,
  },
  {
    type: 'social',
    label: 'Juntos',
    description: 'Quando sua dupla avança ou manda um incentivo.',
    defaultOn: true,
  },
  {
    type: 'progresso',
    label: 'Progresso da semana',
    description: 'Um resumo de como a semana está andando. Desligado por padrão.',
    defaultOn: false,
  },
]

export const DEFAULT_NOTIFICATION_TYPES: readonly NotificationType[] = NOTIFICATION_SPECS.filter(
  (spec) => spec.defaultOn,
).map((spec) => spec.type)

export interface NotificationPreferences {
  readonly types: readonly NotificationType[]
  /** Hora preferida do aviso diário, no fuso da pessoa. */
  readonly preferredHour: number
  /** Janela de silêncio. Atravessa a meia-noite quando `from > to`. */
  readonly quietFrom: number
  readonly quietTo: number
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  types: DEFAULT_NOTIFICATION_TYPES,
  preferredHour: 19,
  quietFrom: 22,
  quietTo: 7,
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}
