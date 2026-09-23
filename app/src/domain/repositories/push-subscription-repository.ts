import type { PushDevice } from '@/domain/notifications/push-device'
import type {
  NotificationPreferences,
  NotificationType,
} from '@/domain/notifications/notification-types'

/**
 * Os aparelhos da pessoa que aceitaram o lembrete, e o carimbo de presença
 * que decide se o lembrete é preciso.
 *
 * `touchPresence` é chamado ao abrir o app e ao voltar pra aba: é a única
 * fonte de "abriu hoje". Sem ele, todo mundo receberia aviso todo dia.
 */
export interface PushSubscriptionRepository {
  /** Grava (ou atualiza) o aparelho atual. Idempotente pelo endpoint. */
  save(device: PushDevice): Promise<void>
  /** Esquece o aparelho: o servidor para de tentar avisar por ele. */
  remove(endpoint: string): Promise<void>
  /** Este endpoint está gravado pra esta conta? */
  has(endpoint: string): Promise<boolean>
  touchPresence(timezone: string): Promise<void>

  /** O que essa conta aceita receber. Sem linha gravada, valem os padrões. */
  loadPreferences(): Promise<NotificationPreferences>
  savePreferences(preferences: NotificationPreferences): Promise<void>

  /**
   * A pessoa abriu o app por um aviso. Idempotente: reabrir pelo histórico do
   * navegador não vira uma segunda abertura.
   */
  markOpened(type: NotificationType): Promise<void>

  /**
   * A pessoa avançou depois de ter aberto por um aviso. Só vale dentro de
   * algumas horas — o avanço da noite não é crédito do aviso da manhã.
   */
  markConverted(): Promise<void>
}
