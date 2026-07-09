import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '@/application/auth/auth-service'
import type { Profile } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { profileUseCases } from '@/presentation/app/use-cases'
import { AuthContext, type AuthContextValue } from '@/presentation/auth/auth-context'

/** Disponibiliza sessão, perfil e ações de auth pra toda a árvore. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadFor(u: AuthUser | null) {
      if (!u) {
        if (active) setProfile(null)
        return
      }
      try {
        const p = await profileUseCases.getMine(u.id)
        if (active) setProfile(p)
      } catch {
        if (active) setProfile(null)
      }
    }

    // Sessão inicial + perfil.
    container.auth
      .getUser()
      .then(async (u) => {
        if (!active) return
        setUser(u)
        await loadFor(u)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Mudanças de sessão (login/logout) → recarrega o perfil.
    const unsubscribe = container.auth.onChange((u) => {
      if (!active) return
      setUser(u)
      void loadFor(u)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback((email: string, password: string) => {
    return container.auth.signIn(email, password)
  }, [])

  const signUp = useCallback((email: string, password: string) => {
    return container.auth.signUp(email, password)
  }, [])

  const signOut = useCallback(async () => {
    await container.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, isDemo: container.usingDemoData, signIn, signUp, signOut }),
    [user, profile, loading, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
