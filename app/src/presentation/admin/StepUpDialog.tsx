import { useState } from 'react'
import type { MfaFactor } from '@/domain/auth/auth-service'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

/**
 * Reautenticação pra ação crítica: o código do app autenticador de novo.
 *
 * Verificar o TOTP renova o carimbo `amr` no token, e é esse carimbo que
 * `assert_admin_step_up` lê. Não existe "confirmar com senha": senha prova
 * que a pessoa sabe a senha; o segundo fator prova que ela está com o
 * aparelho agora.
 */
export function StepUpDialog({
  open,
  factors,
  onSettled,
}: {
  readonly open: boolean
  readonly factors: readonly MfaFactor[]
  readonly onSettled: (ok: boolean) => Promise<void>
}) {
  const { verifyMfa } = useAuth()
  const [code, setCode] = useState('')
  const factor = factors.find((item) => item.verified)

  const verify = useAsyncAction(async () => {
    if (!factor) throw new Error('Sem fator verificado.')
    await verifyMfa(factor.id, code)
    setCode('')
    await onSettled(true)
  })

  return (
    <Dialog
      open={open}
      title="Confirme o segundo fator"
      description="Essa ação é crítica. Digite o código atual do seu app autenticador."
      onClose={() => void onSettled(false)}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void verify.run()
        }}
      >
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => void onSettled(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={verify.running} disabled={code.replace(/\D/g, '').length !== 6}>
            Confirmar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
