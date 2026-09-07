import { Link } from 'react-router-dom'
import type { Task } from '@/domain/entities/task'
import type { NextUp } from '@/presentation/planner/use-dashboard'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, Tag } from '@/presentation/components/ui/Surface'

/**
 * A próxima ação do plano, quando ela NÃO é a prioridade do dia.
 *
 * O card existe pra uma situação específica e comum: a pessoa escolheu a
 * prioridade de hoje por um motivo (energia, horário, vontade) e, enquanto
 * isso, o objetivo está preso em outra etapa. Nesse caso o dashboard precisa
 * dizer as duas coisas — o que ela decidiu fazer e o que o plano está pedindo —
 * sem trocar uma pela outra.
 *
 * Quando as duas coincidem o card **não aparece**: repetir a mesma ação em dois
 * lugares da mesma tela transforma ênfase em ruído, e a segunda cópia ensina a
 * pessoa a ignorar a primeira.
 */
export function NextUpCard({
  nextUp,
  mainPriority,
  onStartFocus,
}: {
  readonly nextUp: NextUp | null
  readonly mainPriority: Task | null
  readonly onStartFocus: (task: Task) => void
}) {
  if (!nextUp || nextUp.task.id === mainPriority?.id) return null

  const { task, view, stageTitle, reason } = nextUp
  const objective = view.progress.objective
  const blocking = view.plan.bottleneck?.stage.id === task.stageId

  return (
    <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-faint uppercase">
          <Icon name="plano" className="size-4" />
          Próxima no plano
        </p>

        <p className="mt-2 text-base font-medium text-balance text-ink">{task.title}</p>

        <p className="mt-1 text-sm text-ink-muted">{reason}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {stageTitle ? <Tag>Etapa: {stageTitle}</Tag> : null}
          {blocking ? <Tag tone="warn">Está segurando o objetivo</Tag> : null}
          <Tag>
            <Icon name="relogio" className="size-3.5" />
            {task.estimatedMin} min
          </Tag>
        </div>

        <Link
          to={`/app/objetivos/${objective.id}`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-ink transition-colors hover:text-brand-hi"
        >
          {objective.title}
          <Icon name="seta" className="size-4" />
        </Link>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={() => onStartFocus(task)}>
          <Icon name="play" className="size-4" />
          Começar essa
        </Button>
      </div>
    </Panel>
  )
}
