/**
 * Port de autenticação. A aplicação depende dessa interface; a implementação
 * concreta (Supabase, demo) vive na infraestrutura. Regra de dependência: pra dentro.
 */

export interface AuthUser {
  readonly id: string
  readonly email: string | null
}

/** Cancela a inscrição de mudanças de sessão. */
export type Unsubscribe = () => void

export interface AuthService {
  /** Sessão atual (rápido, a partir do storage local). */
  getUser(): Promise<AuthUser | null>
  /** Observa login/logout; retorna função pra cancelar a inscrição. */
  onChange(callback: (user: AuthUser | null) => void): Unsubscribe
  /** Cria conta. needsEmailConfirmation = true quando exige confirmar e-mail. */
  signUp(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}
