import { XP_RULES } from '@/domain/entities/evolution'
import type { Task } from '@/domain/entities/task'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { PrimaryButton, SoftButton } from '@/presentation/components/ds/Controls'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFocus } from '@/presentation/focus/use-focus'
import { formatMinutes } from './day-items'

interface PriorityGoal {
  readonly title: string
  /** 0 a 1. */
  readonly ratio: number
}

/**
 * "Sua prioridade agora": o único card que pede ação na primeira dobra.
 *
 * O painel visual é o contexto da tarefa (a etapa do plano e o XP que ela
 * rende), desenhado e não fotografado: uma foto de banco de imagem diria
 * "landing page" pra qualquer tarefa e ensinaria a ignorar o painel.
 */
export function PriorityNowCard({
  task,
  goal,
  stageTitle,
  onStartFocus,
  onChoose,
}: {
  readonly task: Task | null
  readonly goal: PriorityGoal | null
  readonly stageTitle: string | null
  readonly onStartFocus: (task: Task) => void
  readonly onChoose: () => void
}) {
  const focus = useFocus()

  if (!task) {
    return (
      <Card tone="float" aria-labelledby="prioridade-agora">
        <Eyebrow icon="raio">Sua prioridade agora</Eyebrow>
        <h2 id="prioridade-agora" className="mt-3 text-lg font-semibold tracking-tight text-ink">
          Escolha a única coisa que faz o dia valer
        </h2>
        <SoftButton onClick={onChoose} className="mt-5">
          <Icon name="mais" className="size-4" strokeWidth={2.25} />
          Definir prioridade
        </SoftButton>
      </Card>
    )
  }

  const running = focus.session?.taskId === task.id
  const plannedMin = running ? (focus.session?.plannedMin ?? task.estimatedMin) : task.estimatedMin
  const remainingMin = running
    ? Math.max(0, Math.ceil(plannedMin - focus.elapsed / 60000))
    : plannedMin

  return (
    <Card tone="float" aria-labelledby="prioridade-agora">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow icon="raio">Sua prioridade agora</Eyebrow>
        {remainingMin > 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-ink-muted tabular">
            <Icon name="cronometro" className="size-4" />
            {formatMinutes(remainingMin)}
            {running ? ' restante' : ''}
          </span>
        ) : null}
      </div>

      <h2 id="prioridade-agora" className="mt-3 text-[1.15rem] leading-tight font-semibold tracking-tight text-ink">
        {task.title}
      </h2>

      {goal ? (
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
          <span className="truncate">Meta: {goal.title}</span>
          <span className="font-semibold text-brand-hi tabular">{Math.round(goal.ratio * 100)}%</span>
        </p>
      ) : null}

      <div className="relative mt-3 h-20 overflow-hidden rounded-2xl" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_10%,var(--color-brand)_0%,transparent_45%),radial-gradient(90%_120%_at_0%_100%,var(--color-brand-deep)_0%,transparent_55%),linear-gradient(135deg,var(--color-brand-dim),var(--color-surface-top))] opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_23px,rgb(255_255_255/0.14)_24px),linear-gradient(90deg,transparent_23px,rgb(255_255_255/0.14)_24px)] bg-[size:24px_24px]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/45 to-transparent px-3.5 pt-8 pb-3">
          <span className="truncate text-sm font-medium text-white">
            {stageTitle ?? task.minimalVersion ?? 'Bloco de foco profundo'}
          </span>
          <span className="shrink-0 rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold text-brand-deep tabular">
            +{XP_RULES.priority_done.points} XP
          </span>
        </div>
      </div>

      <PrimaryButton
        className="mt-5"
        onClick={() => (running ? focus.setImmersive(true) : onStartFocus(task))}
      >
        <Icon name="play" className="size-5" strokeWidth={2} />
        {running ? 'Voltar ao Foco' : 'Iniciar Foco'}
      </PrimaryButton>
    </Card>
  )
}
