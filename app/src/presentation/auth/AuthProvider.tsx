import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthUser } from '@/domain/auth/auth-service'
import type { Profile } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const loadProfile = useCallback(async (nextUser: AuthUser | null) => {
    if (!nextUser) {
      setProfile(null)
      return
    }
    try {
      const found = await container.profiles.findById(nextUser.id)
      if (mounted.current) setProfile(found)
    } catch {
      // Perfil ausente não pode travar a sessão: a tela de perfil trata isso.
      if (mounted.current) setProfile(null)
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    void (async () => {
      const current = await container.auth.currentUser()
      if (!mounted.current) return
      setUser(current)
      await loadProfile(current)
      if (mounted.current) setLoading(false)
    })()

    const unsubscribe = container.auth.onChange((nextUser) => {
      if (!mounted.current) return
      setUser(nextUser)
      void loadProfile(nextUser)
    })

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      async signIn(email, password) {
        const next = await container.auth.signIn(email, password)
        setUser(next)
        await loadProfile(next)
      },
      async signUp(email, password, name) {
        const next = await container.auth.signUp(email, password, name)
        setUser(next)
        await loadProfile(next)
      },
      async signOut() {
        await container.auth.signOut()
        setUser(null)
        setProfile(null)
      },
      async refreshProfile() {
        await loadProfile(user)
      },
    }),
    [user, profile, loading, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
