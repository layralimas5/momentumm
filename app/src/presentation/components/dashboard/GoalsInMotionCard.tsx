import { activityType } from '@/domain/entities/activity-type'
import { deadlineLabel, GOAL_PACE_LABELS, GOAL_PERIOD_LABELS } from '@/domain/entities/goal'
import type { GoalInMotion } from '@/presentation/planner/use-dashboard'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'

/** Três metas é o teto do card. Mais que isso e nenhuma delas recebe atenção. */
const MAX_VISIBLE = 3

interface GoalsInMotionCardProps {
  readonly goals: readonly GoalInMotion[]
  readonly onContinue: (goal: GoalInMotion) => void
  readonly onCreateTask: (goal: GoalInMotion) => void
  readonly onManage: () => void
  readonly onCreateGoal: () => void
}

/**
 * Metas em movimento.
 *
 * O progresso vem do que foi feito, não do tempo que passou — e o ritmo compara
 * as duas coisas. É a diferença entre "faltam 3 dias" e "faltam 3 dias e você
 * está atrasada".
 */
export function GoalsInMotionCard({
  goals,
  onContinue,
  onCreateTask,
  onManage,
  onCreateGoal,
}: GoalsInMotionCardProps) {
  const visible = goals.slice(0, MAX_VISIBLE)

  return (
    <Panel aria-labelledby="metas-titulo">
      <PanelHeader
        id="metas-titulo"
        title="Metas em movimento"
        icon="metas"
        action={
          goals.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onManage}>
              Gerenciar
              <Icon name="seta" className="size-3.5" />
            </Button>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhuma meta ativa"
            description="Meta transforma vontade em número. Começa com uma pequena, do tipo que dá pra bater num dia ruim."
            action={
              <Button size="sm" onClick={onCreateGoal}>
                <Icon name="mais" className="size-4" />
                Criar meta
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map((item) => (
            <GoalRow
              key={item.progress.goal.id}
              item={item}
              onContinue={onContinue}
              onCreateTask={onCreateTask}
            />
          ))}
        </ul>
      )}

      {goals.length > MAX_VISIBLE ? (
        <p className="mt-3 text-xs text-ink-faint">
          Mais {goals.length - MAX_VISIBLE}{' '}
          {goals.length - MAX_VISIBLE === 1 ? 'meta ativa' : 'metas ativas'} em Metas.
        </p>
      ) : null}
    </Panel>
  )
}

function GoalRow({
  item,
  onContinue,
  onCreateTask,
}: {
  item: GoalInMotion
  onContinue: (goal: GoalInMotion) => void
  onCreateTask: (goal: GoalInMotion) => void
}) {
  const { progress, pace, nextTask } = item
  const type = activityType(progress.goal.type)
  const percent = Math.round(progress.ratio * 100)

  return (
    <li className="rounded-xl border border-line bg-surface-hi/50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {progress.target} {type.unitLabel.many} de {type.label}
          </p>
          {/* O eixo já aparece no título: repetir aqui só ocuparia linha. */}
          <p className="mt-0.5 text-xs text-ink-faint">
            {capitalize(GOAL_PERIOD_LABELS[progress.goal.period])} · {deadlineLabel(progress)}
          </p>
        </div>
        <Tag tone={paceTone(pace)}>{GOAL_PACE_LABELS[pace]}</Tag>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          className="flex-1"
          value={progress.ratio}
          label={`Progresso da meta de ${type.label}`}
          color={progress.achieved ? 'var(--color-positive)' : type.colorToken}
        />
        <span className="tabular shrink-0 text-xs text-ink-muted">{percent}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-ink-muted">
          <span className="text-ink-faint">Próxima ação: </span>
          {nextTask ? nextTask.title : 'nenhuma definida'}
        </p>
        {nextTask ? (
          <Button variant="secondary" size="sm" onClick={() => onContinue(item)}>
            Continuar
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => onCreateTask(item)}>
            <Icon name="mais" className="size-3.5" />
            Definir ação
          </Button>
        )}
      </div>
    </li>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function paceTone(pace: GoalInMotion['pace']): 'positive' | 'neutral' | 'warn' {
  if (pace === 'adiantada') return 'positive'
  if (pace === 'atrasada') return 'warn'
  return 'neutral'
}
