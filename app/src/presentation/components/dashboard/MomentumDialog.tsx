import type { DayKey } from '@/domain/entities/day'
import {
  heldBackNote,
  MOMENTUM_LEVEL_LABELS,
  type MomentumPoint,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { MomentumNextAction as NextAction } from '@/domain/entities/momentum-next-action'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { MomentumBreakdown } from './MomentumBreakdown'
import { MomentumDrivers } from './MomentumDrivers'
import { MomentumHistoryChart } from './MomentumHistoryChart'
import { MomentumNextAction } from './MomentumNextAction'
import { MomentumRules } from './MomentumRules'

/**
 * "Entender meu score", inteiro.
 *
 * Um diálogo e não uma tela: a pergunta "por que 62?" nasce olhando o 62, e
 * mandar a pessoa pra outra rota faria ela perder o dia de vista pra ler sobre
 * ele. O mesmo componente serve desktop e celular — o `Dialog` já sobe como
 * folha embaixo em tela estreita e centraliza em tela larga.
 */
export function MomentumDialog({
  open,
  momentum,
  history,
  today,
  recommendation,
  nextAction = null,
  onClose,
}: {
  readonly open: boolean
  readonly momentum: MomentumScore
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly recommendation: string
  /** A ação que mais sobe o número hoje. Null quando não há nada em aberto. */
  readonly nextAction?: NextAction | null
  readonly onClose: () => void
}) {
  const held = heldBackNote(momentum)
  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  return (
    <Dialog
      open={open}
      title="Entender meu score"
      description="De onde vieram os pontos, e o que mexeu neles desde a semana passada."
      size="lg"
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-gradient-brand tabular text-5xl leading-none font-semibold tracking-tight">
            {momentum.value}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>
              <Delta delta={momentum.delta} hasHistory={momentum.hasEnoughData} />
            </div>
            <p className="mt-1.5 text-sm text-pretty text-ink-muted">{momentum.headline}</p>
          </div>
        </div>

        {momentum.hasEnoughData ? null : (
          <p
            role="status"
            className="rounded-card border border-line bg-surface-hi/40 px-4 py-3 text-sm text-pretty text-ink-muted"
          >
            Tua conta ainda tem menos de uma semana de registro. O número já é calculado com
            os teus dados reais, mas ele só fica estável quando houver histórico pra comparar.
          </p>
        )}

        {/* Curva reta no zero não é informação: some até existir o que mostrar. */}
        {history.length > 1 && history.some((point) => point.value > 0) ? (
          <section aria-labelledby="momentum-historico">
            <h3 id="momentum-historico" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Evolução
            </h3>
            <MomentumHistoryChart history={history} today={today} className="mt-2" />
          </section>
        ) : null}

        {held ? (
          <p role="status" className="text-xs text-pretty text-ink-faint">
            {held}
          </p>
        ) : null}

        <MomentumNextAction action={nextAction} />

        <MomentumDrivers drivers={momentum.drivers} hasEnoughData={momentum.hasEnoughData} />

        <section aria-labelledby="momentum-fatores">
          <h3 id="momentum-fatores" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Os quatro fatores
          </h3>
          <MomentumBreakdown momentum={momentum} className="mt-3" />
        </section>

        <p className="flex items-start gap-2 rounded-card border border-brand/25 bg-brand-dim/30 px-4 py-3 text-sm text-pretty text-ink">
          <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-brand-ink" />
          <span>{recommendation}</span>
        </p>

        <MomentumRules />
      </div>
    </Dialog>
  )
}

function Delta({ delta, hasHistory }: { readonly delta: number; readonly hasHistory: boolean }) {
  if (!hasHistory) {
    return <span className="text-xs text-ink-faint">primeira semana de registro</span>
  }

  const flat = delta === 0
  const rising = delta > 0

  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 text-xs',
        flat ? 'text-ink-faint' : rising ? 'text-positive' : 'text-flame',
      )}
    >
      <Icon name={flat ? 'minimo' : rising ? 'subir' : 'descer'} className="size-3.5" />
      {flat ? 'igual à semana passada' : `${rising ? '+' : ''}${delta} vs. semana passada`}
    </span>
  )
}
