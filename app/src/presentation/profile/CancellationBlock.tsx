import { useState } from 'react'
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  MAX_CANCEL_COMMENT,
  type CancelReason,
} from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { reportError } from '@/infrastructure/errors/error-reporter'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

/**
 * O cancelamento do PRO, em dois passos que a pessoa vê como um.
 *
 * Primeiro o PEDIDO (motivo obrigatório de lista fechada, comentário
 * opcional lido só por owner e admin e apagado em 90 dias) — é o que o
 * painel usa pra entender por que as pessoas saem. Depois o cancelamento
 * DE VERDADE, no Asaas, pela função de cobrança. Se o segundo passo falhar,
 * o pedido fica registrado e a equipe conclui pelo painel; a tela diz isso.
 * O acesso PRO continua até o fim do período já pago.
 */
export function CancellationBlock({ onCanceled }: { readonly onCanceled?: () => void } = {}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CancelReason>('nao_uso')
  const [comment, setComment] = useState('')
  const [accessUntil, setAccessUntil] = useState<Date | null | 'sent'>(null)

  const submit = useAsyncAction(async () => {
    const result = await container.support.requestCancellation(reason, comment.trim() || null)
    try {
      await container.billing.cancelSubscription()
      setAccessUntil(result.accessUntil ?? 'sent')
    } catch (error) {
      // O pedido já está gravado: a equipe conclui pelo provedor, e o erro
      // vai pro painel pra ela saber que precisa.
      reportError({
        code: 'billing_cancel_failed',
        module: 'edge_function',
        message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        severity: 'alta',
      })
      setAccessUntil('sent')
    }
    setOpen(false)
    onCanceled?.()
  })

  if (accessUntil) {
    return (
      <p aria-live="polite" className="mt-3 text-xs text-ink-muted">
        Pedido de cancelamento recebido.{' '}
        {accessUntil !== 'sent'
          ? `Seu PRO continua até ${accessUntil.toLocaleDateString('pt-BR')}.`
          : 'A equipe conclui pelo provedor de pagamento e você recebe a confirmação.'}
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
      >
        Cancelar assinatura
      </button>
    )
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit.run()
      }}
    >
      <Field label="Por que você está cancelando?">
        {(id) => (
          <Select id={id} value={reason} onChange={(event) => setReason(event.target.value as CancelReason)}>
            {CANCEL_REASONS.map((item) => (
              <option key={item} value={item}>
                {CANCEL_REASON_LABELS[item]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label="Quer contar mais? (opcional)"
        hint={`${comment.length}/${MAX_CANCEL_COMMENT}. Lido só por quem cuida do produto e apagado em 90 dias.`}
        error={submit.error}
      >
        {(id, describedBy) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            value={comment}
            maxLength={MAX_CANCEL_COMMENT}
            rows={3}
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-xl border border-line bg-surface-hi px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand"
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="danger" loading={submit.running}>
          Confirmar cancelamento
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  )
}
