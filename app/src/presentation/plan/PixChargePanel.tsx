import { useEffect, useState } from 'react'
import type { PixCharge } from '@/domain/billing/billing-service'
import { formatBRL } from '@/domain/billing/billing-plans'
import { Button, buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

const COPIED_FEEDBACK_MS = 2000

/**
 * O QR da primeira cobrança, pra pagar sem sair do app. O PRO não abre
 * daqui: quem confirma é o webhook, e a tela fica escutando o plano virar
 * (`waiting`). Se a espera estourar, a pessoa não perdeu nada: a cobrança
 * continua válida e o e-mail do Asaas leva ao mesmo QR.
 */
export function PixChargePanel({
  charge,
  amountCents,
  state,
}: {
  readonly charge: PixCharge
  readonly amountCents: number
  readonly state: 'waiting' | 'timeout'
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(charge.qrCodePayload)
      setCopied(true)
    } catch {
      // Sem permissão de clipboard o código continua selecionável no <textarea> abaixo.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          src={`data:image/png;base64,${charge.qrCodeImage}`}
          alt="QR code do Pix pra pagar a assinatura"
          width={192}
          height={192}
          className="size-48 shrink-0 self-center rounded-xl bg-white p-2 sm:self-start"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Abre o app do teu banco, escolhe <strong className="text-ink">Pix</strong> e lê o QR ou cola o código.
            Valor: <strong className="tabular text-ink">{formatBRL(amountCents)}</strong>.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-faint">Pix copia e cola</span>
            <textarea
              readOnly
              rows={3}
              value={charge.qrCodePayload}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full resize-none rounded-xl border border-line bg-surface-hi px-3 py-2 font-mono text-xs break-all text-ink"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copy()} className="w-full sm:w-fit">
              <Icon name="check" className={cn('size-4', copied ? 'text-positive' : 'hidden')} />
              {copied ? 'Copiado' : 'Copiar código'}
            </Button>
            <a
              href={charge.invoiceUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'w-full sm:w-fit' })}
            >
              Abrir a fatura no Asaas
            </a>
          </div>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-busy={state === 'waiting' || undefined}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-ink',
          state === 'waiting' ? 'border-line bg-surface' : 'border-danger/40 bg-danger/10',
        )}
      >
        {state === 'waiting' ? (
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
          />
        ) : null}
        {state === 'waiting'
          ? 'Esperando o pagamento. Assim que o banco confirmar, o PRO abre sozinho.'
          : 'Ainda não recebemos a confirmação. Se você pagou, recarrega a página daqui a pouco; se não, o QR continua valendo e também está no teu e-mail.'}
      </p>
    </div>
  )
}
