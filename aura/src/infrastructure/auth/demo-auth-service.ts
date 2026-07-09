import type { AuthService, AuthUser, Unsubscribe } from '@/application/auth/auth-service'

/** Usuária de demonstração — sempre "logada" quando o Supabase não está configurado. */
const DEMO_USER: AuthUser = { id: 'demo', email: 'voce@aura.app' }

/**
 * Auth de demonstração: mantém a app navegável sem backend. Não há login real —
 * a demo já entra direto, com os dados de exemplo em memória.
 */
export class DemoAuthService implements AuthService {
  async getUser(): Promise<AuthUser | null> {
    return DEMO_USER
  }

  onChange(callback: (user: AuthUser | null) => void): Unsubscribe {
    callback(DEMO_USER)
    return () => {}
  }

  async signUp(): Promise<{ needsEmailConfirmation: boolean }> {
    return { needsEmailConfirmation: false }
  }

  async signIn(): Promise<void> {}

  async signOut(): Promise<void> {}
}
