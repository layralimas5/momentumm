import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Mail, CheckCircle2 } from 'lucide-react'
import { AuraMark } from '@/presentation/components/AuraMark'
import { Button } from '@/presentation/components/ui/Button'
import { useAuth } from '@/presentation/auth/use-auth'

type Mode = 'login' | 'signup'

const copy: Record<Mode, { title: string; subtitle: string; cta: string; alt: string; altLink: string; altTo: string }> = {
  login: {
    title: 'Bem-vinda de volta',
    subtitle: 'Continue de onde você parou.',
    cta: 'Entrar',
    alt: 'Ainda não tem conta?',
    altLink: 'Criar conta grátis',
    altTo: '/criar-conta',
  },
  signup: {
    title: 'Comece sua jornada',
    subtitle: 'Crie sua conta grátis e dê o primeiro passo.',
    cta: 'Criar minha conta',
    alt: 'Já tem conta?',
    altLink: 'Entrar',
    altTo: '/entrar',
  },
}

/** Mensagens amigáveis pros erros mais comuns do Supabase Auth. */
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Esse e-mail já tem uma conta. Tente entrar.'
  if (m.includes('at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('valid email')) return 'Digite um e-mail válido.'
  if (m.includes('rate limit')) return 'Muitas tentativas. Espere um instante e tente de novo.'
  return message
}

export function AuthPage({ mode }: { mode: Mode }) {
  const reduce = useReducedMotion()
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const t = copy[mode]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  // Já logada (inclui modo demo) → direto pro app.
  if (user) return <Navigate to="/app" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUp(email.trim(), password)
        if (needsEmailConfirmation) {
          setConfirmSent(true)
          return
        }
      } else {
        await signIn(email.trim(), password)
      }
      navigate('/app')
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-5 py-10 dark:bg-zinc-950">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <Link to="/" className="mb-8 flex justify-center" aria-label="Aura — início">
          <AuraMark />
        </Link>

        {confirmSent ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Mail className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Confirme seu e-mail
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail pra
              ativar a conta e depois é só entrar.
            </p>
            <Link to="/entrar" className="mt-6 inline-block">
              <Button variant="secondary">Ir para o login</Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Um instante...
                  </>
                ) : (
                  <>
                    {mode === 'signup' && <CheckCircle2 className="h-4 w-4" />}
                    {t.cta}
                  </>
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {t.alt}{' '}
              <Link to={t.altTo} className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
                {t.altLink}
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
