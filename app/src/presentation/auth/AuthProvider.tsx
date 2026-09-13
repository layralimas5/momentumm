import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthUser, SessionInfo } from '@/domain/auth/auth-service'
import {
  assertThrottle,
  clearAttempts,
  registerFailure,
  type AttemptLog,
  type ThrottledAction,
} from '@/domain/auth/auth-throttle'
import type { Profile } from '@/domain/entities/profile'
import { devAutoLogin } from '@/infrastructure/config/env'
import { container } from '@/infrastructure/container'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  /*
    O freio de tentativas vive em ref, não em estado.

    Ele não desenha nada — quem mostra a espera é a exceção que sobe — e
    guardá-lo em `useState` faria cada tentativa falha rerenderizar a árvore
    inteira embaixo do provider. Em ref ele sobrevive aos renders e morre com
    a aba, que é exatamente o alcance de um freio de navegador.
  */
  const attempts = useRef<AttemptLog>({})

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

  const loadSession = useCallback(async () => {
    try {
      const next = await container.auth.currentSession()
      if (mounted.current) setSession(next)
    } catch {
      // Sem leitura de sessão o app trata como sessão comum: falhar pro lado
      // de MENOS privilégio é a única falha aceitável aqui.
      if (mounted.current) setSession(null)
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    void (async () => {
      let current = await container.auth.currentUser()
      // Só em `vite dev`, com as credenciais no .env.local: entra sozinho.
      if (!current && devAutoLogin && !container.demo) {
        try {
          current = await container.auth.signIn(devAutoLogin.email, devAutoLogin.password)
        } catch {
          // Senha errada no .env.local cai na tela de login normal.
        }
      }
      if (!mounted.current) return
      setUser(current)
      await Promise.all([loadProfile(current), current ? loadSession() : Promise.resolve()])
      if (mounted.current) setLoading(false)
    })()

    const unsubscribe = container.auth.onChange((nextUser) => {
      if (!mounted.current) return
      setUser(nextUser)
      void loadProfile(nextUser)
      if (nextUser) void loadSession()
      else setSession(null)
    })

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [loadProfile, loadSession])

  /**
   * Roda a tentativa com o freio na frente e a contagem atrás.
   *
   * Só o FRACASSO conta. Acertar a senha na quarta tentativa zera a escada —
   * punir quem entrou é transformar uma proteção contra robô em castigo pra
   * quem tem duas senhas na cabeça.
   */
  const throttled = useCallback(
    async <T,>(action: ThrottledAction, run: () => Promise<T>): Promise<T> => {
      assertThrottle(attempts.current, action)
      try {
        const result = await run()
        attempts.current = clearAttempts(attempts.current, action)
        return result
      } catch (cause) {
        attempts.current = registerFailure(attempts.current, action)
        throw cause
      }
    },
    [],
  )

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      profile,
      loading,

      async signIn(email, password) {
        const next = await throttled('login', () => container.auth.signIn(email, password))
        setUser(next)
        await Promise.all([loadProfile(next), loadSession()])
      },

      async signUp(email, password, name) {
        const { user: next, needsConfirmation } = await throttled('cadastro', () =>
          container.auth.signUp(email, password, name),
        )

        // Sem sessão não dá pra carregar perfil: o RLS recusaria a leitura e o
        // app entraria num estado logado-mas-sem-dados.
        if (needsConfirmation || !next) return true

        setUser(next)
        await Promise.all([loadProfile(next), loadSession()])
        return false
      },

      async signInWithGoogle() {
        // O redirect volta pra rota de entrada, que já sabe mandar pro app
        // quando encontra sessão.
        await container.auth.signInWithGoogle(`${window.location.origin}/entrar`)
      },

      async requestPasswordReset(email) {
        await throttled('recuperacao', () =>
          container.auth.requestPasswordReset(email, `${window.location.origin}/nova-senha`),
        )
      },

      async updatePassword(currentPassword, newPassword) {
        await container.auth.updatePassword(currentPassword, newPassword)
        await loadSession()
      },

      async completePasswordReset(newPassword) {
        await container.auth.completePasswordReset(newPassword)
        await loadSession()
      },

      async signOut(everywhere = false) {
        await container.auth.signOut(everywhere)
        setUser(null)
        setProfile(null)
        setSession(null)
      },

      listMfaFactors: () => container.auth.listMfaFactors(),
      startMfaEnrollment: () => container.auth.startMfaEnrollment(),

      async confirmMfaEnrollment(factorId, code) {
        await container.auth.confirmMfaEnrollment(factorId, code)
        // Confirmar o fator eleva a sessão pra aal2: a leitura precisa
        // acontecer agora, senão a tela continua achando que é aal1.
        await loadSession()
      },

      async verifyMfa(factorId, code) {
        await container.auth.verifyMfa(factorId, code)
        await loadSession()
      },

      async removeMfaFactor(factorId) {
        await container.auth.removeMfaFactor(factorId)
        await loadSession()
      },

      async refreshProfile() {
        await loadProfile(user)
      },

      refreshSession: loadSession,
    }),
    [user, session, profile, loading, loadProfile, loadSession, throttled],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
