import { z } from 'zod'
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_TYPES,
  type NotificationPreferences,
  type NotificationType,
} from '@/domain/notifications/notification-types'
import type { PushDevice } from '@/domain/notifications/push-device'
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription-repository'
import { InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import { rpcVoid, translateRpcError } from './rpc'

const preferencesRow = z.object({
  types: z.array(z.enum(NOTIFICATION_TYPES)),
  preferred_hour: z.number().int(),
  quiet_from: z.number().int(),
  quiet_to: z.number().int(),
})

/**
 * Os aparelhos inscritos, pela RLS de dono (`push_subscriptions`), e a
 * presença por função (`touch_my_presence`, que é quem escreve a data e o
 * fuso). O envio do aviso é do servidor, na Edge Function `push-reminders`.
 */
export class SupabasePushSubscriptionRepository implements PushSubscriptionRepository {
  async save(device: PushDevice): Promise<void> {
    const {
      data: { user },
    } = await supabase().auth.getUser()
    if (!user) throw new InfrastructureError('Sessão expirada.')

    const { error } = await supabase()
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: device.endpoint,
          p256dh: device.p256dh,
          auth: device.auth,
          user_agent: device.userAgent,
          failed_at: null,
        },
        { onConflict: 'endpoint' },
      )
    if (error) throw new InfrastructureError('Não consegui ligar o lembrete.', error)
  }

  async remove(endpoint: string): Promise<void> {
    const { error } = await supabase().from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) throw new InfrastructureError('Não consegui desligar o lembrete.', error)
  }

  async has(endpoint: string): Promise<boolean> {
    const { data, error } = await supabase()
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', endpoint)
      .maybeSingle()
    if (error) throw new InfrastructureError('Não consegui ler o lembrete.', error)
    return data !== null
  }

  async touchPresence(timezone: string): Promise<void> {
    await rpcVoid('touch_my_presence', { p_timezone: timezone })
  }

  /**
   * Conta sem linha de preferência é conta que nunca mexeu nisso: valem os
   * padrões, e eles são os MESMOS que o banco aplica em `decide_notification`.
   * Duas listas de padrão diferentes fariam a tela mostrar uma coisa e o
   * servidor mandar outra.
   */
  async loadPreferences(): Promise<NotificationPreferences> {
    const { data, error } = await supabase()
      .from('notification_preferences')
      .select('types, preferred_hour, quiet_from, quiet_to')
      .maybeSingle()
    if (error) throw new InfrastructureError('Não consegui ler suas preferências.', error)
    if (!data) return DEFAULT_PREFERENCES

    const parsed = preferencesRow.safeParse(data)
    if (!parsed.success) return DEFAULT_PREFERENCES

    return {
      types: parsed.data.types,
      preferredHour: parsed.data.preferred_hour,
      quietFrom: parsed.data.quiet_from,
      quietTo: parsed.data.quiet_to,
    }
  }

  async savePreferences(preferences: NotificationPreferences): Promise<void> {
    const { error } = await supabase().rpc('save_notification_preferences', {
      p_types: [...preferences.types],
      p_preferred_hour: preferences.preferredHour,
      p_quiet_from: preferences.quietFrom,
      p_quiet_to: preferences.quietTo,
    })
    if (error) throw translateRpcError(error)
  }

  async markOpened(type: NotificationType): Promise<void> {
    await rpcVoid('mark_notification_opened', { p_type: type })
  }

  async markConverted(): Promise<void> {
    await rpcVoid('mark_notification_converted', {})
  }
}
