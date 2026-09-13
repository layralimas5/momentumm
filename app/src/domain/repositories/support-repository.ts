import type { MyAccessGrant, MySupportRequest, PublicSettings } from '@/domain/admin/admin-schemas'
import type { CancelReason, SupportCategory } from '@/domain/support/support-request'

export interface SupportRequestEvent {
  readonly id: number
  readonly actorKind: 'usuario' | 'equipe' | 'sistema'
  readonly type: string
  readonly note: string | null
  readonly createdAt: Date
}

/**
 * O que a PESSOA faz com suporte, acesso excepcional e cancelamento.
 *
 * É a metade do canal que fica dentro do app comum. A outra metade
 * (`AdminGateway`) fica no painel, e as duas nunca leem a mesma tabela pelo
 * mesmo caminho: a pessoa lê pela RLS de dono, a equipe lê por função.
 */
export interface SupportRepository {
  openRequest(
    category: SupportCategory,
    subject: string,
    description: string,
  ): Promise<{ id: string; protocol: string }>
  listMyRequests(): Promise<readonly MySupportRequest[]>
  requestEvents(requestId: string): Promise<readonly SupportRequestEvent[]>
  addMessage(requestId: string, note: string): Promise<void>

  myAccessGrants(): Promise<readonly MyAccessGrant[]>
  respondAccess(grantId: string, decision: 'consentir' | 'negar' | 'revogar'): Promise<void>

  requestCancellation(reason: CancelReason, comment: string | null): Promise<{ accessUntil: Date | null }>

  publicSettings(): Promise<PublicSettings>
}
