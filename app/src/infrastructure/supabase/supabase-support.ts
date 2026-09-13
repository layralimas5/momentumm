import { z } from 'zod'
import {
  myAccessGrantSchema,
  mySupportRequestSchema,
  publicSettingsSchema,
  type PublicSettings,
} from '@/domain/admin/admin-schemas'
import type { SupportRepository, SupportRequestEvent } from '@/domain/repositories/support-repository'
import type { CancelReason, SupportCategory } from '@/domain/support/support-request'
import { InfrastructureError } from '@/shared/errors'
import { supabase } from './client'
import { rpc, rpcVoid, translateRpcError } from './rpc'

/**
 * A pessoa e o suporte, pelo lado dela.
 *
 * Leitura das próprias solicitações vai pela RLS de dono (`select` com
 * `user_id = auth.uid()` na política). Abrir, responder, consentir e
 * cancelar são funções: elas validam ritmo, estado e forma antes de gravar.
 */
export class SupabaseSupportRepository implements SupportRepository {
  async openRequest(category: SupportCategory, subject: string, description: string) {
    return rpc(
      'open_support_request',
      { p_category: category, p_subject: subject, p_description: description },
      z.object({ id: z.string().uuid(), protocol: z.string() }),
    )
  }

  async listMyRequests() {
    const { data, error } = await supabase()
      .from('support_requests')
      .select('id, protocol, category, status, subject, opened_at, updated_at, resolution')
      .order('opened_at', { ascending: false })
    if (error) throw translateRpcError(error)
    return z.array(mySupportRequestSchema).parse(data ?? [])
  }

  async requestEvents(requestId: string): Promise<readonly SupportRequestEvent[]> {
    const { data, error } = await supabase()
      .from('support_request_events')
      .select('id, actor_kind, type, note, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    if (error) throw new InfrastructureError('Não consegui ler o histórico.', error)
    return z
      .array(
        z.object({
          id: z.number(),
          actor_kind: z.enum(['usuario', 'equipe', 'sistema']),
          type: z.string(),
          note: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(data ?? [])
      .map((row) => ({
        id: row.id,
        actorKind: row.actor_kind,
        type: row.type,
        note: row.note,
        createdAt: new Date(row.created_at),
      }))
  }

  addMessage(requestId: string, note: string) {
    return rpcVoid('add_support_message', { p_request: requestId, p_note: note })
  }

  myAccessGrants() {
    return rpc('my_content_access_grants', {}, z.array(myAccessGrantSchema))
  }

  respondAccess(grantId: string, decision: 'consentir' | 'negar' | 'revogar') {
    return rpcVoid('respond_content_access', { p_grant: grantId, p_decision: decision })
  }

  async requestCancellation(reason: CancelReason, comment: string | null) {
    const result = await rpc(
      'request_cancellation',
      { p_reason: reason, p_comment: comment },
      z.object({ id: z.string().uuid(), access_until: z.string().nullable() }),
    )
    return { accessUntil: result.access_until ? new Date(result.access_until) : null }
  }

  async publicSettings(): Promise<PublicSettings> {
    return rpc('public_settings', {}, publicSettingsSchema)
  }
}
