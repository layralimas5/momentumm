import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ADMIN_ROLE_LABELS } from '@/domain/admin/admin-role'
import type { MfaEnrollment, MfaFactor } from '@/domain/auth/auth-service'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useAdmin } from './admin-context'

/**
 * As duas portas antes do painel: cadastrar o fator, ou verificá-lo.
 *
 * A sessão administrativa dura uma hora a partir da verificação — é o
 * carimbo do JWT que o banco lê, não um relógio de tela. Verificar de novo
 * renova o carimbo e reabre o painel.
 */
export function MfaGate() {
  const admin = useAdmin()

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <LogoMark className="size-8" />
          <div>
            <p className="text-sm font-semibold text-ink">Painel administrativo</p>
            <p className="text-xs text-ink-faint">
              {admin.role ? ADMIN_ROLE_LABELS[admin.role] : ''}
            </p>
          </div>
        </div>

        {admin.gate === 'enroll_mfa' ? <EnrollStep /> : <VerifyStep />}

        <p className="mt-6 text-xs text-ink-faint">
          <Link to="/app" className="underline-offset-2 hover:underline">
            Voltar pro app
          </Link>
        </p>
      </div>
    </div>
  )
}

function EnrollStep() {
  const auth = useAuth()
  const admin = useAdmin()
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [code, setCode] = useState('')

  const start = useAsyncAction(async () => {
    setEnrollment(await auth.startMfaEnrollment())
  })

  const confirm = useAsyncAction(async () => {
    if (!enrollment) return
    await auth.confirmMfaEnrollment(enrollment.factorId, code)
    setCode('')
    await admin.refresh()
  })

  return (
    <div className="mt-6 flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Ative a verificação em duas etapas
      </h1>
      <p className="text-sm text-ink-muted">
        Conta com papel administrativo só entra no painel com o segundo fator. Sem ele, o banco
        recusa todas as leituras e ações.
      </p>

      {enrollment ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void confirm.run()
          }}
        >
          <div
            className="w-fit rounded-xl bg-white p-3"
            // O SVG vem do próprio GoTrue, não de conteúdo de usuário.
            dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
          />
          <p className="text-xs break-all text-ink-faint">
            Sem câmera? Digita a chave: <code className="text-ink">{enrollment.secret}</code>
          </p>
          <Field label="Código de seis dígitos" error={confirm.error}>
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" loading={confirm.running}>
            Ativar e entrar
          </Button>
        </form>
      ) : (
        <>
          <Button loading={start.running} onClick={() => void start.run()}>
            Gerar código do autenticador
          </Button>
          {start.error ? <p className="text-sm text-danger">{start.error}</p> : null}
        </>
      )}
    </div>
  )
}

function VerifyStep() {
  const auth = useAuth()
  const admin = useAdmin()
  const [factors, setFactors] = useState<readonly MfaFactor[]>([])
  const [code, setCode] = useState('')

  useEffect(() => {
    void auth.listMfaFactors().then(setFactors)
  }, [auth])

  const factor = factors.find((item) => item.verified)

  const verify = useAsyncAction(async () => {
    if (!factor) return
    await auth.verifyMfa(factor.id, code)
    setCode('')
    await admin.refresh()
  })

  const expired = admin.session?.aal === 'aal2' && !admin.session.sessionValid

  return (
    <form
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void verify.run()
      }}
    >
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        {expired ? 'Sessão administrativa expirada' : 'Confirme o segundo fator'}
      </h1>
      <p className="text-sm text-ink-muted">
        {expired
          ? 'A sessão do painel venceu. Digite o código pra continuar de onde parou.'
          : 'Digite o código do seu app autenticador pra abrir o painel.'}
      </p>

      <Field label="Código de seis dígitos" error={verify.error}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
      </Field>

      <Button type="submit" loading={verify.running} disabled={!factor || code.replace(/\D/g, '').length !== 6}>
        Entrar no painel
      </Button>
    </form>
  )
}
