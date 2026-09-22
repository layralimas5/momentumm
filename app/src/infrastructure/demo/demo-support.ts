import type { AdminGateway } from '@/domain/admin/admin-gateway'
import type { MyAccessGrant, MySupportRequest, PublicSettings } from '@/domain/admin/admin-schemas'
import type { SupportRepository, SupportRequestEvent } from '@/domain/repositories/support-repository'
import type { CancelReason, SupportCategory } from '@/domain/support/support-request'
import { DomainError } from '@/shared/errors'

/**
 * Suporte no modo demo: as solicitações vivem na memória da aba.
 *
 * Existe pra tela de Configurações funcionar sem Supabase — a pessoa abre
 * uma solicitação e vê o protocolo. Ninguém do outro lado vai responder, e
 * a tela diz isso.
 */
export class DemoSupportRepository implements SupportRepository {
  private requests: MySupportRequest[] = []
  private events = new Map<string, SupportRequestEvent[]>()
  private counter = 0

  async openRequest(category: SupportCategory, subject: string, description: string) {
    if (description.trim().length === 0) throw new DomainError('Conta o que aconteceu.')
    this.counter += 1
    const id = `demo-${this.counter}`
    const protocol = `MM-DEMO-${String(this.counter).padStart(5, '0')}`
    const now = new Date()
    this.requests = [
      { id, protocol, category, status: 'aberta', subject, opened_at: now, updated_at: now, resolution: null },
      ...this.requests,
    ]
    this.events.set(id, [{ id: 1, actorKind: 'usuario', type: 'aberta', note: null, createdAt: now }])
    return { id, protocol }
  }

  async listMyRequests() {
    return this.requests
  }

  async requestEvents(requestId: string) {
    return this.events.get(requestId) ?? []
  }

  async addMessage(requestId: string, note: string) {
    const list = this.events.get(requestId) ?? []
    list.push({ id: list.length + 1, actorKind: 'usuario', type: 'mensagem', note, createdAt: new Date() })
    this.events.set(requestId, list)
  }

  async myAccessGrants(): Promise<readonly MyAccessGrant[]> {
    return []
  }

  async respondAccess() {
    throw new DomainError('No modo demo não existe pedido de acesso.')
  }

  async requestCancellation(_reason: CancelReason, _comment: string | null) {
    return { accessUntil: null }
  }

  async publicSettings(): Promise<PublicSettings> {
    return {}
  }
}

const UNAVAILABLE = 'O painel administrativo só existe com o Supabase configurado.'

/**
 * No modo demo o painel NÃO existe. Nada de dado inventado pra preencher
 * gráfico: a rota diz que precisa do Supabase e para aí.
 */
export class DemoAdminGateway implements AdminGateway {
  async me() {
    return {
      role: null,
      aal: 'aal1' as const,
      mfaRequired: true,
      mfaVerifiedAt: null,
      sessionValid: false,
      sessionExpiresAt: null,
      stepUpValid: false,
      stepUpExpiresAt: null,
    }
  }

  overview(): never {
    throw new DomainError(UNAVAILABLE)
  }
  listUsers(): never {
    throw new DomainError(UNAVAILABLE)
  }
  userDetail(): never {
    throw new DomainError(UNAVAILABLE)
  }
  userLogs(): never {
    throw new DomainError(UNAVAILABLE)
  }
  exportUserAdminData(): never {
    throw new DomainError(UNAVAILABLE)
  }
  runUserAction(): never {
    throw new DomainError(UNAVAILABLE)
  }
  inviteUser(): never {
    throw new DomainError(UNAVAILABLE)
  }
  subscriptionMetrics(): never {
    throw new DomainError(UNAVAILABLE)
  }
  listSubscriptions(): never {
    throw new DomainError(UNAVAILABLE)
  }
  cancellations(): never {
    throw new DomainError(UNAVAILABLE)
  }
  updateCancellation(): never {
    throw new DomainError(UNAVAILABLE)
  }
  aiMetrics(): never {
    throw new DomainError(UNAVAILABLE)
  }
  blockAi(): never {
    throw new DomainError(UNAVAILABLE)
  }
  unblockAi(): never {
    throw new DomainError(UNAVAILABLE)
  }
  listErrors(): never {
    throw new DomainError(UNAVAILABLE)
  }
  errorMetrics(): never {
    throw new DomainError(UNAVAILABLE)
  }
  setErrorStatus(): never {
    throw new DomainError(UNAVAILABLE)
  }
  retention(): never {
    throw new DomainError(UNAVAILABLE)
  }
  featureUsage(): never {
    throw new DomainError(UNAVAILABLE)
  }
  quizFunnel(): never {
    throw new DomainError(UNAVAILABLE)
  }
  evolutionMetrics(): never {
    throw new DomainError(UNAVAILABLE)
  }
  listRequests(): never {
    throw new DomainError(UNAVAILABLE)
  }
  requestDetail(): never {
    throw new DomainError(UNAVAILABLE)
  }
  updateRequest(): never {
    throw new DomainError(UNAVAILABLE)
  }
  requestContentAccess(): never {
    throw new DomainError(UNAVAILABLE)
  }
  readScopedContent(): never {
    throw new DomainError(UNAVAILABLE)
  }
  settings(): never {
    throw new DomainError(UNAVAILABLE)
  }
  updateSetting(): never {
    throw new DomainError(UNAVAILABLE)
  }
  listAdmins(): never {
    throw new DomainError(UNAVAILABLE)
  }
  grantRole(): never {
    throw new DomainError(UNAVAILABLE)
  }
  revokeRole(): never {
    throw new DomainError(UNAVAILABLE)
  }
  audit(): never {
    throw new DomainError(UNAVAILABLE)
  }
}
