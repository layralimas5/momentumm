import {
  momentumFactors,
  MOMENTUM_HORIZON_DAYS,
  MOMENTUM_WINDOW_DAYS,
  type MomentumScore,
} from '@/domain/entities/momentum'
import { cn } from '@/shared/lib/cn'

/**
 * O score aberto nos quatro fatores.
 *
 * Mora fora das telas porque o mesmo detalhamento aparece no modal "Entender
 * meu score", nos insights e no progresso. Três cópias seriam três explicações
 * que divergem na primeira vez que um peso mudar — e a explicação divergindo do
 * número é pior que não ter explicação nenhuma.
 *
 * Cada linha mostra o peso do fator porque a pergunta que a pessoa faz não é
 * "quanto tirei", é "por que isso mexeu tão pouco".
 */
export function MomentumBreakdown({
  momentum,
  className,
}: {
  readonly momentum: MomentumScore
  readonly className?: string
}) {
  const factors = momentumFactors(momentum)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <dl className="flex flex-col gap-4">
        {factors.map((factor) => (
          <div key={factor.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="text-sm font-medium text-ink">{factor.label}</dt>
              <dd className="tabular shrink-0 text-sm text-ink-muted">
                {factor.score}
                <span className="text-ink-faint">/100</span>
                <span className="ml-2 text-xs text-ink-faint">
                  {factor.points} de {factor.maxPoints} pts
                </span>
              </dd>
            </div>

            <div
              role="img"
              aria-label={`${factor.label}: ${factor.score} de 100, peso ${factor.weightPercent}%`}
              className="h-1.5 overflow-hidden rounded-full bg-surface-top"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${factor.score}%` }}
              />
            </div>

            <p className="text-xs text-pretty text-ink-faint">
              <span className="text-ink-muted">{factor.weightPercent}% do score.</span>{' '}
              {factor.hint}
              {/* Fator sem base não é fator zerado: dizer isso evita a leitura de
                  que a pessoa foi mal em algo que ela nem começou. */}
              {factor.measured ? null : ' Ainda sem dados: por enquanto ele acompanha a consistência.'}
            </p>
          </div>
        ))}
      </dl>

      <p className="text-xs text-pretty text-ink-faint">
        A conta olha os últimos {MOMENTUM_HORIZON_DAYS} dias, e cada um dos últimos{' '}
        {MOMENTUM_WINDOW_DAYS} vale o triplo dos anteriores. O que conta é impacto, não
        quantidade: prioridade e ação ligada a objetivo valem mais que tarefa comum ou hábito
        solto, e cada um tem teto por dia pra ninguém subir o número na repetição.
      </p>
    </div>
  )
}
