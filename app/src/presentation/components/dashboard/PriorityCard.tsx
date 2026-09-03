import { activityType } from '@/domain/entities/activity-type'
import type { CapacityProfile } from '@/domain/entities/checkin'
import type { Goal } from '@/domain/entities/goal'
import { TASK_EFFORT_LABELS, type Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, Tag } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

interface PriorityCardProps {
  readonly task: Task | null
  readonly goal: Goal | null
  readonly capacity: CapacityProfile
  /** Dia fechado: o card para de pedir ação em vez de insistir. */
  readonly dayComplete: boolean
  readonly onStartFocus: (task: Task) => void
  readonly onComplete: (task: Task) => Promise<void>
  readonly onShrink: (task: Task) => Promise<void>
  readonly onReorganize: () => void
  readonly onCreate: () => void
}

/**
 * O movimento que muda o dia.
 *
 * É o card de maior hierarquia da tela inteira, e é o único que responde
 * "qual é minha próxima ação?" sem exigir leitura. Uma prioridade só: duas
 * prioridades principais é o mesmo que nenhuma.
 */
export function PriorityCard({
  task,
  goal,
  capacity,
  dayComplete,
  onStartFocus,
  onComplete,
  onShrink,
  onReorganize,
  onCreate,
}: PriorityCardProps) {
  const complete = useAsyncAction(async (item: Task) => {
    await onComplete(item)
  })
  const shrink = useAsyncAction(async (item: Task) => {
    await onShrink(item)
  })

  if (!task) {
    /*
      Com o dia fechado o card muda de tom: empurrar "define outra ação" logo
      depois de tudo concluído transforma constância em cobrança, que é
      justamente o que o produto evita.
    */
    return (
      <Panel tone="brand" aria-labelledby="prioridade-titulo" className="p-6 lg:p-7">
        <Eyebrow done={dayComplete} />
        <h2
          id="prioridade-titulo"
          className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink"
        >
          {dayComplete ? 'Você já fez o movimento de hoje' : 'O movimento que muda seu dia'}
        </h2>
        <p className="mt-2 max-w-lg text-pretty text-ink-muted">
          {dayComplete
            ? 'O plano de hoje saiu inteiro. Se quiser adiantar alguma coisa, planeje amanhã — hoje já está resolvido.'
            : 'Nenhuma ação escolhida ainda. Uma só já resolve — o resto do dia fica mais fácil quando existe uma decisão tomada.'}
        </p>
        <Button
          className="mt-5"
          size="lg"
          variant={dayComplete ? 'secondary' : 'primary'}
          onClick={onCreate}
        >
          <Icon name="mais" className="size-4" />
          {dayComplete ? 'Planejar a próxima ação' : 'Definir a ação de hoje'}
        </Button>
      </Panel>
    )
  }

  const axis = task.axis ? activityType(task.axis) : null
  const highlightMinimal = capacity.preferMinimal && task.minimalVersion !== null

  return (
    <Panel
      tone="brand"
      glow
      aria-labelledby="prioridade-titulo"
      className="p-6 lg:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Eyebrow />
          <h2
            id="prioridade-titulo"
            className="mt-2 text-sm font-semibold tracking-wide text-ink-muted uppercase"
          >
            O movimento que muda seu dia
          </h2>

          {/* Teto de largura: título de uma linha só, atravessando a tela, cansa de ler. */}
          <p className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl">
            {task.title}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {axis ? <Tag color={axis.colorToken}>{axis.label}</Tag> : null}
            {/* Meta do mesmo eixo repetiria a etiqueta ao lado. */}
            {goal && goal.type !== task.axis ? (
              <Tag tone="brand">Meta: {activityType(goal.type).label}</Tag>
            ) : goal ? (
              <Tag tone="brand">Ligada a uma meta</Tag>
            ) : null}
            <Tag>
              <Icon name="relogio" className="size-3.5" />
              {task.estimatedMin} min
            </Tag>
            <Tag tone={task.effort === 'pesado' ? 'warn' : 'neutral'}>
              {TASK_EFFORT_LABELS[task.effort]}
            </Tag>
          </div>
        </div>

        <EffortDial effort={task.effort} />
      </div>

      {highlightMinimal ? (
        <p className="mt-5 flex gap-2.5 rounded-xl border border-brand/30 bg-canvas/40 px-3.5 py-3 text-sm text-ink-muted">
          <Icon name="minimo" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
          <span>
            Hoje sua energia está baixa. A versão mínima disso é{' '}
            <strong className="font-medium text-ink">“{task.minimalVersion}”</strong> — ela mantém a
            sequência sem cobrar o dia inteiro.
          </span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <Button
          size="lg"
          onClick={() => onStartFocus(task)}
          className={cn(highlightMinimal && 'order-2')}
        >
          <Icon name="play" className="size-4" />
          Começar agora
        </Button>

        {task.minimalVersion ? (
          <Button
            size="lg"
            variant={highlightMinimal ? 'primary' : 'secondary'}
            onClick={() => void shrink.run(task)}
            loading={shrink.running}
            className={cn(highlightMinimal && 'order-1')}
          >
            <Icon name="minimo" className="size-4" />
            Fazer versão mínima
          </Button>
        ) : null}

        <Button
          size="lg"
          variant="secondary"
          onClick={() => void complete.run(task)}
          loading={complete.running}
          className="order-3"
        >
          <Icon name="check" className="size-4" />
          Concluir
        </Button>

        <Button size="lg" variant="ghost" onClick={onReorganize} className="order-4">
          Reorganizar
        </Button>
      </div>

      <div aria-live="polite" className="min-h-6">
        {complete.error || shrink.error ? (
          <p className="mt-2 text-sm text-danger">{complete.error ?? shrink.error}</p>
        ) : null}
      </div>
    </Panel>
  )
}

function Eyebrow({ done = false }: { done?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
        done
          ? 'border-positive/40 bg-positive/10 text-positive'
          : 'border-brand/40 bg-brand-dim/50 text-brand-ink',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', done ? 'bg-positive' : 'glow-pulse bg-brand-hi')}
      />
      {done ? 'Dia fechado' : 'Prioridade principal'}
    </span>
  )
}

/** Três traços que dizem o peso da ação sem exigir leitura. */
function EffortDial({ effort }: { effort: Task['effort'] }) {
  const filled = effort === 'leve' ? 1 : effort === 'medio' ? 2 : 3

  return (
    <span aria-hidden="true" className="flex items-end gap-1 pt-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'w-1.5 rounded-full',
            index < filled ? 'bg-brand-hi' : 'bg-line-hi',
          )}
          style={{ height: `${14 + index * 8}px` }}
        />
      ))}
    </span>
  )
}
