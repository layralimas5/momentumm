/**
 * Um aparelho inscrito no Web Push: o endereço que o navegador deu e as duas
 * chaves que cifram a mensagem pra ele. É o que o app grava e o servidor lê
 * na hora de avisar; o conteúdo do aviso nunca passa por aqui.
 */
export interface PushDevice {
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly userAgent: string | null
}

/**
 * O que o navegador diz sobre notificação neste aparelho. `unsupported`
 * cobre também o iPhone com o site aberto no Safari: lá o push só existe
 * depois de "Adicionar à Tela de Início".
 */
export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * A hora preferida padrão do resumo do dia, no fuso da pessoa. É o valor
 * inicial de `notification_preferences.preferred_hour`, e vale pros avisos que
 * têm hora marcada (retomada, continuidade, progresso, dupla).
 *
 * O lembrete do próximo passo NÃO usa esta hora: ele chega quando faz
 * sentido — ação de hoje ainda em aberto e algumas horas sem atividade —,
 * dentro da janela abaixo. A regra mora no banco (`decide_notification`);
 * estas constantes existem pra tela conseguir dizer a mesma coisa.
 */
export const REMINDER_HOUR = 19

/** A faixa do dia em que um aviso pode chegar, no fuso da pessoa. */
export const NOTIFICATION_WINDOW = { startHour: 8, endHour: 21, endMinute: 30 } as const

/** Horas de silêncio no app antes de o lembrete do próximo passo valer a pena. */
export const INACTIVITY_HOURS = 4
