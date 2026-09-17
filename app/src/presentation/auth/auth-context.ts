import { createContext } from 'react'
import type { AuthUser, MfaEnrollment, MfaFactor, SessionInfo } from '@/domain/auth/auth-service'
import type { PlanTrial } from '@/domain/billing/trial'
import type { Profile } from '@/domain/entities/profile'

export interface AuthState {
  readonly user: AuthUser | null
  readonly profile: Profile | null
  /**
   * O que o SERVIDOR diz sobre a sessão: nível de garantia, se há segundo
   * fator registrado e se ela pode agir como administrativa.
   *
   * Fica separado de `user` porque muda por outros motivos — completar o MFA
   * eleva a sessão sem trocar de usuário — e porque nenhuma tela deve
   * derivar permissão do perfil, que é editável pelo dono.
   */
  readonly session: SessionInfo | null
  /**
   * O teste de 7 dias do PRO desta conta, como o servidor devolveu ao abrir
   * a sessão. `null` sem teste (contas do demo, por exemplo). Quem decide se
   * ele ainda vale é `profile.plan`, gravado pelo banco; isto aqui é o que
   * a tela usa pra dizer "até quando".
   */
  readonly trial: PlanTrial | null
  readonly loading: boolean

  signIn(email: string, password: string): Promise<void>
  /**
   * Devolve `true` quando falta confirmar o e-mail — o que inclui, de
   * propósito, o caso de a conta já existir. A tela mostra a mesma mensagem
   * nos dois: dizer "esse e-mail já tem conta" transforma o formulário num
   * verificador de e-mails.
   */
  signUp(email: string, password: string, name: string): Promise<boolean>
  signInWithGoogle(): Promise<void>
  /** Sempre resolve. Não revela se o e-mail existe. */
  requestPasswordReset(email: string): Promise<void>
  updatePassword(currentPassword: string, newPassword: string): Promise<void>
  completePasswordReset(newPassword: string): Promise<void>
  /** `everywhere` derruba as sessões dos outros dispositivos também. */
  signOut(everywhere?: boolean): Promise<void>

  listMfaFactors(): Promise<readonly MfaFactor[]>
  startMfaEnrollment(): Promise<MfaEnrollment>
  confirmMfaEnrollment(factorId: string, code: string): Promise<void>
  verifyMfa(factorId: string, code: string): Promise<void>
  removeMfaFactor(factorId: string): Promise<void>

  refreshProfile(): Promise<void>
  /** Relê a sessão depois de MFA, troca de senha ou concessão de papel. */
  refreshSession(): Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
