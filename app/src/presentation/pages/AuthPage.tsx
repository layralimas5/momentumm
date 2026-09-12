import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { MIN_PASSWORD_LENGTH } from '@/domain/auth/password'
import { Icon } from '@/presentation/components/ui/Icon'

type Mode = 'entrar' | 'criar' | 'recuperar'

export function AuthPage() {
  const { user, loading, signIn, signUp, signInWithGoogle, requestPasswordReset } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('criar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // O aceite de verdade é gravado na primeira entrada (LegalGate): aqui é o consentimento na hora de criar.
  const [consent, setConsent] = useState(false)

  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const submit = useAsyncAction(async () => {
    if (mode === 'entrar') {
      await signIn(email, password)
      return
    }

    if (mode === 'recuperar') {
      await requestPasswordReset(email)
      // Sempre marca como enviado, mesmo pra e-mail sem conta: a tela não
      // pode virar um verificador de quem tem cadastro aqui.
      setResetSent(true)
      return
    }

    setAwaitingConfirmation(await signUp(email, password, name))
  })

  const google = useAsyncAction(async () => {
    await signInWithGoogle()
  })

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/app'
    return <Navigate to={from} replace />
  }

  /*
    Conta criada, sessão ainda não. Antes disso a tela tentava entrar e voltava
    pro formulário em branco, sem dizer nada — e a pessoa ficava tentando o
    mesmo cadastro de novo achando que tinha falhado.
  */
  if (awaitingConfirmation) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <Wordmark className="h-6 sm:h-7" />

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
          Confirma teu e-mail
        </h1>
        <p className="mt-2 text-pretty text-sm text-ink-muted">
          A conta foi criada. Mandamos um link pra <strong className="text-ink">{email}</strong> —
          abre ele e volta aqui pra entrar.
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          Se não chegar em alguns minutos, olha o spam. O link vale por 24 horas.
        </p>

        <Button
          className="mt-6"
          variant="secondary"
          onClick={() => {
            setAwaitingConfirmation(false)
            setMode('entrar')
            setPassword('')
          }}
        >
          Já confirmei, quero entrar
        </Button>
      </main>
    )
  }

  /*
    O aviso de recuperação é o MESMO pra e-mail cadastrado e não cadastrado.

    Dizer "não achamos esse e-mail" entrega, sem custo nenhum, a lista de quem
    usa o produto: o formulário de recuperação é o mais barato de automatizar,
    porque não exige nem tentativa de senha.
  */
  if (resetSent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <Wordmark className="h-6 sm:h-7" />

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Confere teu e-mail</h1>
        <p className="mt-2 text-pretty text-sm text-ink-muted">
          Se <strong className="text-ink">{email}</strong> puder receber acesso, o link de nova
          senha chega em instantes. Olha também o spam.
        </p>

        <Button
          className="mt-6"
          variant="secondary"
          onClick={() => {
            setResetSent(false)
            setMode('entrar')
          }}
        >
          Voltar pro login
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Wordmark className="h-6 sm:h-7" />

      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
        {mode === 'criar' ? 'Criar conta' : mode === 'recuperar' ? 'Recuperar acesso' : 'Entrar'}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {mode === 'criar'
          ? 'Leva menos de um minuto. Depois é só registrar o primeiro dia.'
          : mode === 'recuperar'
            ? 'Diz teu e-mail e a gente manda um link pra criar uma senha nova.'
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

        {mode === 'recuperar' ? null : (
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={google.running}
              onClick={() => void google.run()}
            >
              <Icon name="raio" className="size-4" />
              Continuar com Google
            </Button>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-faint">ou com e-mail</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        {google.error ? <ErrorNote message={google.error} /> : null}

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

        {mode === 'recuperar' ? null : (
          <Field
            label="Senha"
            hint={
              mode === 'criar'
                ? `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Uma frase curta funciona melhor que um código.`
                : undefined
            }
          >
            {(id, describedBy) => (
              <TextInput
                id={id}
                type="password"
                aria-describedby={describedBy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                minLength={mode === 'criar' ? MIN_PASSWORD_LENGTH : 1}
                required
              />
            )}
          </Field>
        )}

        {mode === 'criar' ? (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
            />
            <span>
              Li e aceito os{' '}
              <Link to="/termos" target="_blank" rel="noreferrer" className="text-brand-hi hover:underline">
                Termos de uso
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" target="_blank" rel="noreferrer" className="text-brand-hi hover:underline">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
        ) : null}

        <Button type="submit" size="lg" loading={submit.running} disabled={mode === 'criar' && !consent}>
          {mode === 'criar' ? 'Criar conta' : mode === 'recuperar' ? 'Mandar o link' : 'Entrar'}
        </Button>

        {mode === 'entrar' ? (
          <button
            type="button"
            onClick={() => {
              setMode('recuperar')
              submit.clearError()
            }}
            className="min-h-11 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Esqueci minha senha
          </button>
        ) : null}
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
