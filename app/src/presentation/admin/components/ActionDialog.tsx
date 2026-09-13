import { useState, type ReactNode } from 'react'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useAdmin } from '../admin-context'

const MIN_REASON = 5

/**
 * Toda ação administrativa passa por aqui: motivo obrigatório, confirmação
 * e, quando é crítica, verificação recente do segundo fator antes de
 * chamar o servidor.
 *
 * O motivo vai pra auditoria. Cinco caracteres é o mínimo pra "cliente
 * pediu" caber — e é o banco quem recusa abaixo disso, esta tela só evita
 * a viagem.
 */
export function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  critical = true,
  reasonLabel = 'Motivo (vai pra auditoria)',
  children,
  onConfirm,
  onClose,
}: {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly destructive?: boolean
  /** Exige o segundo fator verificado nos últimos cinco minutos. */
  readonly critical?: boolean
  readonly reasonLabel?: string
  readonly children?: ReactNode
  readonly onConfirm: (reason: string) => Promise<void>
  readonly onClose: () => void
}) {
  const admin = useAdmin()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const run = useAsyncAction(async () => {
    if (critical) {
      const ok = await admin.requireStepUp()
      if (!ok) return
    }
    await onConfirm(reason.trim())
    setReason('')
    setConfirmed(false)
    onClose()
  })

  const close = () => {
    if (run.running) return
    setReason('')
    setConfirmed(false)
    run.clearError()
    onClose()
  }

  return (
    <Dialog open={open} title={title} description={description} onClose={close}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void run.run()
        }}
      >
        {children}

        <Field label={reasonLabel} error={run.error}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={reason}
              maxLength={280}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: solicitação MM-202609-00012"
            />
          )}
        </Field>

        {destructive ? (
          <label className="flex items-start gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            Entendo que essa ação afeta a conta de outra pessoa e fica registrada com meu nome.
          </label>
        ) : null}

        {critical ? (
          <p className="text-xs text-ink-faint">
            Ação crítica: o código do autenticador vai ser pedido de novo se a última verificação
            tiver mais de cinco minutos.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close} disabled={run.running}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={destructive ? 'danger' : 'primary'}
            loading={run.running}
            disabled={reason.trim().length < MIN_REASON || (destructive && !confirmed)}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
