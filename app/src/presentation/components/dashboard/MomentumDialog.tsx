import type { DayKey } from '@/domain/entities/day'
import {
  MOMENTUM_LEVEL_LABELS,
  type MomentumPoint,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { MomentumBreakdown } from './MomentumBreakdown'
import { MomentumDrivers } from './MomentumDrivers'
import { MomentumHistoryChart } from './MomentumHistoryChart'
import { UpgradeHint } from './UpgradeHint'

/**
 * "Entender meu score", inteiro.
 *
 * Um diálogo e não uma tela: a pergunta "por que 62?" nasce olhando o 62, e
 * mandar a pessoa pra outra rota faria ela perder o dia de vista pra ler sobre
 * ele. O mesmo componente serve desktop e celular — o `Dialog` já sobe como
 * folha embaixo em tela estreita e centraliza em tela larga.
 *
 * Sem `detail` (o gratuito), o diálogo mostra a pontuação de hoje e a frase
 * que a explica, e para aí: evolução, o que subiu e caiu e os quatro fatores
 * são a parte de ANALISAR, que é o que o PRO libera.
 */
export function MomentumDialog({
  open,
  momentum,
  history,
  today,
  recommendation,
  detail,
  onClose,
}: {
  readonly open: boolean
  readonly momentum: MomentumScore
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly recommendation: string
  /** Evolução, o que mudou e os quatro fatores. Falso no gratuito. */
  readonly detail: boolean
  readonly onClose: () => void
}) {
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
      description={
        detail
          ? 'De onde vieram os pontos, e o que mexeu neles desde a semana passada.'
          : 'A tua pontuação de hoje, calculada com os teus registros reais.'
      }
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
              {detail ? <Delta delta={momentum.delta} hasHistory={momentum.hasEnoughData} /> : null}
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

        {detail ? (
          <>
            {/* Curva reta no zero não é informação: some até existir o que mostrar. */}
            {history.length > 1 && history.some((point) => point.value > 0) ? (
              <section aria-labelledby="momentum-historico">
                <h3 id="momentum-historico" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Evolução
                </h3>
                <MomentumHistoryChart history={history} today={today} className="mt-2" />
              </section>
            ) : null}

            <MomentumDrivers drivers={momentum.drivers} hasEnoughData={momentum.hasEnoughData} />

            <section aria-labelledby="momentum-fatores">
              <h3 id="momentum-fatores" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Os quatro fatores
              </h3>
              <MomentumBreakdown momentum={momentum} className="mt-3" />
            </section>
          </>
        ) : (
          <UpgradeHint message="No PRO o score abre em evolução, o que subiu e caiu desde a semana passada e os quatro fatores que o formam." />
        )}

        <p className="flex items-start gap-2 rounded-card border border-brand/25 bg-brand-dim/30 px-4 py-3 text-sm text-pretty text-ink">
          <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-brand-ink" />
          <span>{recommendation}</span>
        </p>
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
