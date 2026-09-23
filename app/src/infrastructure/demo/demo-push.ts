import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '@/domain/notifications/notification-types'
import type { PushDevice } from '@/domain/notifications/push-device'
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription-repository'

/**
 * No modo demo o aparelho fica só na memória: dá pra ligar e desligar o
 * lembrete na tela, mas ninguém envia nada. Não existe servidor pra isso.
 */
export class DemoPushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly endpoints = new Set<string>()
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES

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

  async loadPreferences(): Promise<NotificationPreferences> {
    return this.preferences
  }

  async savePreferences(preferences: NotificationPreferences): Promise<void> {
    this.preferences = preferences
  }

  async markOpened(): Promise<void> {
    // Sem servidor não existe aviso a carimbar.
  }

  async markConverted(): Promise<void> {
    // Idem.
  }
}
