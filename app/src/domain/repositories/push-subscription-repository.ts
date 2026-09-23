import type { PushDevice } from '@/domain/notifications/push-device'

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
}
