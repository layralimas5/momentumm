import { createContext, useContext } from 'react'
import type { AdminCapability, AdminRole } from '@/domain/admin/admin-role'
import type { AdminGate, AdminSession } from '@/domain/admin/admin-session'

export interface AdminState {
  readonly session: AdminSession | null
  readonly role: AdminRole | null
  readonly gate: AdminGate
  readonly loading: boolean
  readonly hasMfaFactor: boolean
  can(capability: AdminCapability): boolean
  /** Relê `admin_me()` e os fatores. Depois de verificar o TOTP, sempre. */
  refresh(): Promise<void>
  /**
   * Garante verificação recente antes de uma ação crítica.
   *
   * Se o carimbo do segundo fator tem menos de cinco minutos, resolve na
   * hora. Senão abre o diálogo de código e só resolve quando o servidor
   * confirmar — ou devolve `false` se a pessoa desistir. O banco checa de
   * novo (`assert_admin_step_up`); isto aqui é pra a pessoa não descobrir a
   * exigência pela mensagem de erro.
   */
  requireStepUp(): Promise<boolean>
}

export const AdminContext = createContext<AdminState | null>(null)

export function useAdmin(): AdminState {
  const value = useContext(AdminContext)
  if (!value) throw new Error('useAdmin precisa estar dentro de AdminProvider.')
  return value
}
