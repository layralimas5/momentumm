import { useRef, useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { deadlineLabel, GOAL_PACE_LABELS, GOAL_PERIOD_LABELS } from '@/domain/entities/goal'
import type { GoalInMotion } from '@/presentation/planner/use-dashboard'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { MobileSection } from './MobileSection'

interface MobileGoalsProps {
  readonly goals: readonly GoalInMotion[]
  readonly onContinue: (goal: GoalInMotion) => void
  readonly onCreateTask: (goal: GoalInMotion) => void
  readonly onManage: () => void
  readonly onCreateGoal: () => void
}

/**
 * Metas em carrossel horizontal, uma por vez.
 *
 * Nada anda sozinho: quem passa é o dedo. Carrossel automático rouba a leitura
 * no meio da frase, e numa tela onde a pessoa está decidindo o que fazer isso
 * é o oposto do que o card precisa entregar.
 */
export function MobileGoals({
  goals,
  onContinue,
  onCreateTask,
  onManage,
  onCreateGoal,
}: MobileGoalsProps) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)

  if (goals.length === 0) {
    return (
      <MobileSection title="Metas em movimento" icon="metas">
        <div className="surface-card p-4">
          <p className="text-sm text-ink-muted">
            Nenhuma meta ativa. Começa com uma pequena, do tipo que dá pra bater num dia ruim.
          </p>
          <Button size="md" variant="secondary" className="mt-3 h-12 w-full" onClick={onCreateGoal}>
            <Icon name="mais" className="size-4" />
            Criar meta
          </Button>
        </div>
      </MobileSection>
    )
  }

  return (
    <MobileSection
      title="Metas em movimento"
      icon="metas"
      action={{ label: 'Gerenciar', onClick: onManage }}
    >
      <ul
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget
          const width = track.clientWidth
          setActive(Math.round(track.scrollLeft / Math.max(1, width - 32)))
        }}
        /*
          A faixa sangra até as bordas pra o dedo poder arrastar de qualquer
          ponto, mas o conteúdo respeita a mesma margem do resto da tela
          (`px-4` + `scroll-px-4`), e o cartão seguinte aparece recuado em vez
          de fatiado pela borda do aparelho.
        */
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-1 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {goals.map((item) => {
          const { progress, pace, nextTask } = item
          const type = activityType(progress.goal.type)

          return (
            <li
              key={progress.goal.id}
              className="w-[82%] max-w-sm shrink-0 snap-start"
              aria-label={`Meta de ${type.label}`}
            >
              <div className="surface-card h-full p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-ink">
                    {progress.target} {type.unitLabel.many} de {type.label}
                  </p>
                  <Tag
                    tone={pace === 'adiantada' ? 'positive' : pace === 'atrasada' ? 'warn' : 'neutral'}
                  >
                    {GOAL_PACE_LABELS[pace]}
                  </Tag>
                </div>

                <p className="mt-1 text-sm text-ink-faint">
                  {capitalize(GOAL_PERIOD_LABELS[progress.goal.period])} · {deadlineLabel(progress)}
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar
                    className="flex-1"
                    value={progress.ratio}
                    label={`Progresso da meta de ${type.label}`}
                    color={progress.achieved ? 'var(--color-positive)' : type.colorToken}
                  />
                  <span className="tabular shrink-0 text-sm text-ink-muted">
                    {Math.round(progress.ratio * 100)}%
                  </span>
                </div>

                <p className="mt-3 truncate text-sm text-ink-muted">
                  <span className="text-ink-faint">Próxima: </span>
                  {nextTask ? nextTask.title : 'nenhuma definida'}
                </p>

                {nextTask ? (
                  <Button
                    size="md"
                    variant="secondary"
                    className="mt-3 h-12 w-full"
                    onClick={() => onContinue(item)}
                  >
                    <Icon name="play" className="size-4" />
                    Continuar
                  </Button>
                ) : (
                  <Button
                    size="md"
                    variant="secondary"
                    className="mt-3 h-12 w-full"
                    onClick={() => onCreateTask(item)}
                  >
                    <Icon name="mais" className="size-4" />
                    Definir a ação
                  </Button>
                )}
              </div>
            </li>
          )
        })}
        {/* Fecha a rolagem com a mesma margem da esquerda, senão o último
            cartão encosta na borda do aparelho. */}
        <li aria-hidden="true" className="w-px shrink-0" />
      </ul>

      {goals.length > 1 ? (
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {goals.map((item, index) => (
            <span
              key={item.progress.goal.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                index === active ? 'w-5 bg-brand' : 'w-1.5 bg-line-hi',
              )}
            />
          ))}
        </div>
      ) : null}
    </MobileSection>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
