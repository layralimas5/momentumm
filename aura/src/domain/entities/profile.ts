/**
 * Perfil da usuária — papel e status de assinatura. Governa o acesso ao app
 * (só assinatura ativa entra) e à área de admin (só papel admin).
 * Camada de domínio: pura, sem dependências.
 */

export type UserRole = 'user' | 'admin'

/** pending: sem acesso · active: pagante · canceled/blocked: sem acesso. */
export type SubscriptionStatus = 'pending' | 'active' | 'canceled' | 'blocked'

export interface Profile {
  readonly id: string
  email: string | null
  role: UserRole
  subscriptionStatus: SubscriptionStatus
  plan: string | null
  readonly createdAt: string
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending: 'Pendente',
  active: 'Ativa',
  canceled: 'Cancelada',
  blocked: 'Bloqueada',
}

export const ProfileRules = {
  /** Tem acesso ao app? Só quem está com assinatura ativa. */
  hasAppAccess(profile: Pick<Profile, 'subscriptionStatus'>): boolean {
    return profile.subscriptionStatus === 'active'
  },

  isAdmin(profile: Pick<Profile, 'role'>): boolean {
    return profile.role === 'admin'
  },
} as const
