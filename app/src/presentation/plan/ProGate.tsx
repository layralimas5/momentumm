import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { PRO_BENEFITS } from './pro-benefits'

interface ProGateProps {
  readonly title: string
  /** O que esse recurso faz quando liberado, dito pela utilidade e não pela tecnologia. */
  readonly description: string
  readonly className?: string
}

/**
 * O lugar de um recurso que só existe no PRO.
 *
 * A tela continua acessível — a pessoa vê o que existe e o que ele responde —
 * mas o painel não finge funcionar. É a exceção à regra "nenhum bloqueio por
 * banner": aqui não há versão menor do recurso pra mostrar, então o que resta
 * é dizer em voz alta o que ele faz e como liberar.
 */
export function ProGate({ title, description, className }: ProGateProps) {
  return (
    <Panel tone="brand" className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-dim text-brand-ink">
          <Icon name="raio" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-brand-ink uppercase">PRO</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm text-pretty text-ink-muted">{description}</p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {PRO_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2 text-sm text-ink-muted">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            {benefit}
          </li>
        ))}
      </ul>

      <Link
        to="/#pro"
        className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hi"
      >
        <Icon name="raio" className="size-4" />
        Conhecer o PRO
      </Link>
    </Panel>
  )
}
