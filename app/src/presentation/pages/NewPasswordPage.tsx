import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MIN_PASSWORD_LENGTH, passwordStrength } from '@/domain/auth/password'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Field, PasswordInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

/**
 * O destino do link de recuperação.
 *
 * O Supabase abre uma sessão temporária ao processar o link — é ela que
 * autoriza a troca. Por isso aqui não se pede a senha antiga: quem chegou
 * provou ser dono da caixa de e-mail, que é a prova disponível quando a senha
 * foi esquecida.
 *
 * Sem sessão, a página não mostra formulário nenhum. Um campo de senha nova
 * que não tem como salvar é pior que uma mensagem de link vencido.
 */
export function NewPasswordPage() {
  const { user, loading, completePasswordReset } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)

  const submit = useAsyncAction(async () => {
    await completePasswordReset(password)
    setDone(true)
  })

  if (loading) return null

  if (done) return <Navigate to="/app" replace />

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <Wordmark className="mx-auto mb-4 w-32 sm:w-36" />
        <h1 className="mt-10 text-2xl font-semibold tracking-tight text-ink">
          Esse link não vale mais
        </h1>
        <p className="mt-2 text-pretty text-sm text-ink-muted">
          Links de recuperação expiram por segurança. Pede um novo na tela de entrada.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => window.location.assign('/entrar')}>
          Voltar pro login
        </Button>
      </main>
    )
  }

  const strength = passwordStrength(password)
  const matches = confirmation.length === 0 || confirmation === password

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Wordmark className="mx-auto mb-4 w-32 sm:w-36" />

      <h1 className="mt-10 text-2xl font-semibold tracking-tight text-ink">Cria uma senha nova</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Ao salvar, as sessões abertas nos outros dispositivos são encerradas.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!matches) return
          void submit.run()
        }}
      >
        {submit.error ? <ErrorNote message={submit.error} /> : null}

        <Field
          label="Senha nova"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Uma frase curta funciona melhor que um código.`}
        >
          {(id, describedBy) => (
            <PasswordInput
              id={id}
              aria-describedby={describedBy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          )}
        </Field>

        {/* A barra descreve, não decide: quem recusa é a validação do domínio. */}
        <div className="flex items-center gap-2" aria-hidden="true">
          {(['fraca', 'media', 'forte'] as const).map((nivel, index) => (
            <span
              key={nivel}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= ['fraca', 'media', 'forte'].indexOf(strength) && password.length > 0
                  ? strength === 'forte'
                    ? 'bg-positive'
                    : strength === 'media'
                      ? 'bg-flame'
                      : 'bg-danger'
                  : 'bg-surface-top',
              )}
            />
          ))}
        </div>

        <Field
          label="Repete a senha nova"
          error={matches ? null : 'As duas senhas precisam ser iguais.'}
        >
          {(id, describedBy) => (
            <PasswordInput
              id={id}
              aria-describedby={describedBy}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" loading={submit.running} disabled={!matches}>
          Salvar e entrar
        </Button>
      </form>
    </main>
  )
}
