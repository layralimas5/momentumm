import { Link } from 'react-router-dom'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { PRO_BENEFITS, PRO_TAGLINE } from './pro-benefits'

export interface PlanLimitNotice {
  /** O recurso que a pessoa tentou usar agora. Sem isso vira propaganda solta. */
  readonly feature: string
  readonly message: string
}

interface PlanLimitDialogProps {
  readonly notice: PlanLimitNotice | null
  readonly onClose: () => void
}

/**
 * O limite do plano, no momento em que ele encosta.
 *
 * Um diálogo só pra desktop e celular: o `Dialog` já vira folha embaixo em
 * tela estreita. Aparece apenas depois de um toque que o limite recusou,
 * explicando o que aquilo destrava. Nada de pop-up ao abrir o app.
 */
export function PlanLimitDialog({ notice, onClose }: PlanLimitDialogProps) {
  return (
    <Dialog
      open={notice !== null}
      title={notice?.feature ?? 'Momentumm PRO'}
      description={notice?.message ?? ''}
      onClose={onClose}
    >
      <p className="text-sm text-ink-muted">{PRO_TAGLINE}</p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {PRO_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2.5 text-sm text-ink">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            {benefit}
          </li>
        ))}
      </ul>

      <Link
        to="/app/assinatura"
        onClick={onClose}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hi active:bg-brand-hi"
      >
        <Icon name="raio" className="size-4" />
        Assinar o PRO
      </Link>

      <Button variant="ghost" size="lg" className="mt-2 h-11 w-full" onClick={onClose}>
        Agora não
      </Button>
    </Dialog>
  )
}
