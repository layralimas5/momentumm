import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { can as roleCan, type AdminCapability } from '@/domain/admin/admin-role'
import { adminGateFor, type AdminSession } from '@/domain/admin/admin-session'
import type { MfaFactor } from '@/domain/auth/auth-service'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { AdminContext, type AdminState } from './admin-context'
import { StepUpDialog } from './StepUpDialog'

/** De quanto em quanto tempo a sessão administrativa é reconferida no servidor. */
const RECHECK_MS = 30_000

/**
 * O estado administrativo da sessão, lido do servidor.
 *
 * `admin_me()` responde papel, nível e o carimbo do segundo fator direto do
 * JWT. Nada é guardado em `localStorage` nem derivado do perfil: a cada
 * meio minuto o provider pergunta de novo, e quando a hora vence a tela
 * cai pra porta de verificação sozinha — sem esperar a próxima ação falhar.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [factors, setFactors] = useState<readonly MfaFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const pendingStepUp = useRef<((ok: boolean) => void) | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const [next, nextFactors] = await Promise.all([container.admin.me(), auth.listMfaFactors()])
      if (!mounted.current) return
      setSession(next)
      setFactors(nextFactors)
    } catch {
      // Sem leitura, sem painel: falhar pro lado de menos privilégio.
      if (mounted.current) setSession(null)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [auth])

  useEffect(() => {
    mounted.current = true
    void refresh()
    const timer = window.setInterval(() => void refresh(), RECHECK_MS)
    return () => {
      mounted.current = false
      window.clearInterval(timer)
    }
  }, [refresh])

  const requireStepUp = useCallback(async () => {
    if (session?.stepUpValid) return true
    return new Promise<boolean>((resolve) => {
      pendingStepUp.current = resolve
      setStepUpOpen(true)
    })
  }, [session])

  const settleStepUp = useCallback(
    async (ok: boolean) => {
      setStepUpOpen(false)
      if (ok) await refresh()
      pendingStepUp.current?.(ok)
      pendingStepUp.current = null
    },
    [refresh],
  )

  const hasMfaFactor = factors.some((factor) => factor.verified)
  const role = session?.role ?? null

  const value = useMemo<AdminState>(
    () => ({
      session,
      role,
      gate: adminGateFor(session, hasMfaFactor),
      loading,
      hasMfaFactor,
      can: (capability: AdminCapability) => roleCan(role, capability),
      refresh,
      requireStepUp,
    }),
    [session, role, hasMfaFactor, loading, refresh, requireStepUp],
  )

  return (
    <AdminContext.Provider value={value}>
      {children}
      <StepUpDialog open={stepUpOpen} factors={factors} onSettled={settleStepUp} />
    </AdminContext.Provider>
  )
}
