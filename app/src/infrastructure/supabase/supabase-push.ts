import type { PushDevice } from '@/domain/notifications/push-device'
import type { PushSubscriptionRepository } from '@/domain/repositories/push-subscription-repository'
import { InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import { rpcVoid } from './rpc'

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
}
