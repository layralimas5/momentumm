import type { AdminRole } from './admin-role'

/**
 * O que o servidor diz sobre a sessão administrativa (`admin_me()`).
 *
 * Nada aqui é derivado no cliente: papel, nível de garantia e carimbo do
 * segundo fator vêm do banco, que os lê do JWT assinado. A tela só decide
 * qual PORTA mostrar.
 */
export interface AdminSession {
  readonly role: AdminRole | null
  readonly aal: 'aal1' | 'aal2'
  readonly mfaVerifiedAt: Date | null
  readonly sessionValid: boolean
  readonly sessionExpiresAt: Date | null
  readonly stepUpValid: boolean
  readonly stepUpExpiresAt: Date | null
}

export type AdminGate =
  /** Sem papel: a rota nem existe pra essa pessoa. */
  | 'forbidden'
  /** Tem papel, mas nunca registrou um fator. Precisa cadastrar antes de entrar. */
  | 'enroll_mfa'
  /** Tem fator, mas a sessão está em aal1 ou o carimbo venceu. */
  | 'verify_mfa'
  | 'open'

export function adminGateFor(session: AdminSession | null, hasMfaFactor: boolean): AdminGate {
  if (!session || !session.role) return 'forbidden'
  if (!hasMfaFactor) return 'enroll_mfa'
  if (!session.sessionValid) return 'verify_mfa'
  return 'open'
}

/** Minutos até a sessão administrativa vencer. Zero quando já venceu. */
export function minutesLeft(until: Date | null, now: Date = new Date()): number {
  if (!until) return 0
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 60_000))
}
