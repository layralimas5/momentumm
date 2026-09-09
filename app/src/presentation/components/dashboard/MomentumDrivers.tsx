import type { MomentumDriver } from '@/domain/entities/momentum'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * O que empurrou o número pra cima e o que puxou pra baixo.
 *
 * É o elo que falta entre a variação e a decisão: "−6" não diz o que fazer,
 * "execução das prioridades: −6" diz. Os valores são pontos DO SCORE, já
 * multiplicados pelo peso do fator — mostrar a variação bruta faria um fator de
 * 15% parecer tão decisivo quanto um de 35%.
 */
export function MomentumDrivers({
  drivers,
  hasEnoughData,
}: {
  readonly drivers: readonly MomentumDriver[]
  readonly hasEnoughData: boolean
}) {
  if (!hasEnoughData) return null

  const up = drivers.filter((driver) => driver.delta > 0)
  const down = drivers.filter((driver) => driver.delta < 0)

  if (up.length === 0 && down.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Nenhum fator mudou desde a semana passada: o teu ritmo está estável.
      </p>
    )
  }

  return (
    <section aria-labelledby="momentum-motivos" className="flex flex-col gap-2">
      <h3 id="momentum-motivos" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
        O que mudou desde a semana passada
      </h3>

      <ul className="flex flex-col gap-1.5">
        {[...up, ...down].map((driver) => (
          <li key={driver.key} className="flex items-center gap-2 text-sm">
            <Icon
              name={driver.delta > 0 ? 'subir' : 'descer'}
              className={cn('size-4 shrink-0', driver.delta > 0 ? 'text-positive' : 'text-flame')}
            />
            <span className="min-w-0 flex-1 text-ink-muted">{driver.label}</span>
            <span
              className={cn(
                'tabular shrink-0 font-medium',
                driver.delta > 0 ? 'text-positive' : 'text-flame',
              )}
            >
              {driver.delta > 0 ? '+' : ''}
              {driver.delta} pts
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
