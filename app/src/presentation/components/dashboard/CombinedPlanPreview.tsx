import { activityType } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { CombinedPlan } from '@/domain/entities/plan-builder'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { PlanPreview } from './PlanPreview'

interface CombinedPlanPreviewProps {
  readonly combined: CombinedPlan
  readonly today: DayKey
  /** Recebe a área e o prazo sustentável em dias. */
  readonly onUseSuggestedDeadline: (axis: string, days: number) => void
  /** Recebe a área e o alvo que caberia no prazo atual. */
  readonly onUseFittingTarget: (axis: string, target: number) => void
}

/**
 * Os planos de todos os objetivos, com o veredito do dia em cima.
 *
 * O veredito vem primeiro de propósito: de nada adianta cada plano estar
 * bonito sozinho se os três somados pedem o dobro do tempo que a pessoa tem.
 * A soma é a única leitura que responde "isso cabe na minha vida?".
 *
 * Só o primeiro plano mostra a prioridade principal, porque só ele vai ficar
 * com ela: prioridade é uma por dia, e a tela precisa prometer exatamente o
 * que o app vai gravar.
 */
export function CombinedPlanPreview({
  combined,
  today,
  onUseSuggestedDeadline,
  onUseFittingTarget,
}: CombinedPlanPreviewProps) {
  const multiple = combined.plans.length > 1

  return (
    <div className="flex flex-col gap-5">
      <div
        role="status"
        className={cn(
          'flex items-start gap-2.5 rounded-card border px-4 py-3',
          combined.fits
            ? 'border-positive/30 bg-positive/8'
            : 'border-flame/30 bg-flame-dim/40',
        )}
      >
        <Icon
          name={combined.fits ? 'check' : 'relogio'}
          className={cn('mt-0.5 size-4 shrink-0', combined.fits ? 'text-positive' : 'text-flame')}
          strokeWidth={2.25}
        />
        <div className="min-w-0">
          <p className="text-sm text-pretty text-ink">{combined.verdict}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {/* "Cerca de" porque cada sessão arredonda pra cima: o número exato
                daria a impressão de precisão que a conta não tem. */}
            O conjunto pede cerca de {combined.requiredMinutesPerDay} minutos num dia de sessão, e
            você reservou {combined.minutesPerDay}.
          </p>
        </div>
      </div>

      {combined.plans.map((plan, index) => (
        <div key={plan.objective.axis}>
          {multiple ? (
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: activityType(plan.objective.axis).colorToken }}
              />
              <span className="truncate">{plan.objective.title}</span>
            </h4>
          ) : null}

          <PlanPreview
            plan={plan}
            today={today}
            ownsMainPriority={index === 0}
            onUseSuggestedDeadline={(days) => onUseSuggestedDeadline(plan.objective.axis, days)}
            onUseFittingTarget={(target) => onUseFittingTarget(plan.objective.axis, target)}
          />
        </div>
      ))}
    </div>
  )
}
