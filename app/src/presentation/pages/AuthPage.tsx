import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

type Mode = 'entrar' | 'criar'

export function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('criar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = useAsyncAction(async () => {
    if (mode === 'entrar') await signIn(email, password)
    else await signUp(email, password, name)
  })

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/app'
    return <Navigate to={from} replace />
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Wordmark className="text-lg" />

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
        {mode === 'criar' ? 'Criar conta' : 'Entrar'}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {mode === 'criar'
          ? 'Leva menos de um minuto. Depois é só registrar o primeiro dia.'
          : 'Bom te ver de novo.'}
      </p>

      {container.demo ? (
        <p className="mt-4 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
          Modo demo ativo: qualquer e-mail e senha entram, e os dados ficam só nesse navegador.
        </p>
      ) : null}

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit.run()
        }}
      >
        {submit.error ? <ErrorNote message={submit.error} /> : null}

        {mode === 'criar' ? (
          <Field label="Nome">
            {(id) => (
              <TextInput
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            )}
          </Field>
        ) : null}

        <Field label="E-mail">
          {(id) => (
            <TextInput
              id={id}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          )}
        </Field>

        <Field label="Senha" hint={mode === 'criar' ? 'Mínimo de 6 caracteres.' : undefined}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              type="password"
              aria-describedby={describedBy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submit.running}>
          {mode === 'criar' ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {mode === 'criar' ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'criar' ? 'entrar' : 'criar')
            submit.clearError()
          }}
          className="font-medium text-brand-hi hover:underline"
        >
          {mode === 'criar' ? 'Entrar' : 'Criar agora'}
        </button>
      </p>
    </main>
  )
}
