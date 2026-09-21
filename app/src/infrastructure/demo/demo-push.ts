import type { PushDevice } from '@/domain/notifications/push-device'
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription-repository'

/**
 * No modo demo o aparelho fica só na memória: dá pra ligar e desligar o
 * lembrete na tela, mas ninguém envia nada. Não existe servidor pra isso.
 */
export class DemoPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly endpoints = new Set<string>()

  async save(device: PushDevice): Promise<void> {
    this.endpoints.add(device.endpoint)
  }

  async remove(endpoint: string): Promise<void> {
    this.endpoints.delete(endpoint)
  }

  async has(endpoint: string): Promise<boolean> {
    return this.endpoints.has(endpoint)
  }

  async touchPresence(): Promise<void> {
    // Sem servidor não há presença a marcar.
  }
}
