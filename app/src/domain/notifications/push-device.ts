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

/** Hora local em que o lembrete chega. A mesma da função `push_reminders_due`. */
export const REMINDER_HOUR = 19
