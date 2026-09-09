import { useState, type ReactNode } from 'react'
import { addDays, formatDayLabel } from '@/domain/entities/day'
import { isBlocked, isPending, TASK_STATUS_LABELS, type Task } from '@/domain/entities/task'
import { PriorityTag } from '@/presentation/components/shared/Meta'
import { ObjectiveLink } from '@/presentation/components/shared/Meta'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { IconButton } from '@/presentation/components/ui/Surface'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * Uma linha de ação, em qualquer lugar que mostre o plano.
 *
 * Ela mora aqui e não dentro de uma tela porque o plano, a etapa dentro do
 * objetivo e a caixa de entrada mostram a MESMA ação. Três cópias dessa linha
 * seria três jeitos diferentes de concluir, adiar e cancelar — e é assim que
 * uma delas acaba esquecendo de carimbar a data de conclusão.
 *
 * A ordem se muda arrastando pela alça, que quem desenha a lista entrega em
 * `handle` (ver `SortableList`). A linha não sabe reordenar sozinha: ordem é
 * propriedade do conjunto, e a lista é quem conhece os irmãos.
 */
export function TaskRow({
  task,
  handle = null,
  showObjective,
  showDay = false,
  showWeight = false,
}: {
  readonly task: Task
  /** A alça de arrastar. Null quando a lista não é reordenável. */
  readonly handle?: ReactNode
  readonly showObjective: boolean
  readonly showDay?: boolean
  /** Mostra peso e obrigatoriedade. Só faz sentido dentro de uma etapa. */
  readonly showWeight?: boolean
}) {
  const planner = usePlanner()
  const composer = useComposer()
  const [confirming, setConfirming] = useState(false)

  const objective = planner.objectives.find((item) => item.id === task.objectiveId)
  const blocked = isBlocked(task, planner.tasks)
  const parent = planner.tasks.find((item) => item.id === task.dependsOnId)
  const done = task.status === 'feita'
  const cancelled = task.status === 'cancelada'
  const late = isPending(task) && task.day < planner.today

  return (
    /*
      No celular a linha empilha: título em cima, ações embaixo. Lado a lado,
      quatro botões e a etiqueta de prioridade comem a largura toda e o título
      quebra em uma palavra por linha — a lista deixa de ser legível justamente
      no aparelho em que ela é mais usada.
    */
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* A alça antes da caixa de concluir: é a primeira coisa da linha, e
            fica na mesma coluna em todas elas. */}
        {handle ? <div className="-my-2 -ml-2 shrink-0">{handle}</div> : null}
        <button
          type="button"
          aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
          disabled={blocked || cancelled}
          onClick={() => void planner.setTaskDone(task.id, !done)}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
            done
              ? 'border-positive bg-positive/20 text-positive'
              : 'border-line-hi text-transparent hover:border-brand',
            (blocked || cancelled) && 'cursor-not-allowed opacity-40',
          )}
        >
          <Icon name="check" className="size-3.5" strokeWidth={2.5} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-sm', done || cancelled ? 'text-ink-faint line-through' : 'text-ink')}>
            {task.title}
          </p>

          {task.description ? (
            <p className="mt-0.5 text-xs text-ink-faint">{task.description}</p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            {showDay ? (
              <span className={late ? 'text-flame' : undefined}>
                {formatDayLabel(task.day, planner.today)}
              </span>
            ) : null}
            {task.timeOfDay ? <span>{task.timeOfDay}</span> : null}
            <span>{task.estimatedMin} min</span>
            {/* Peso 1 é o padrão e não precisa de rótulo: dizer "peso 1" em toda
                linha viraria ruído e esconderia justamente a que pesa 3. */}
            {showWeight && task.weight > 1 ? <span>peso {task.weight}</span> : null}
            {showWeight && !task.isRequired ? <span>opcional</span> : null}
            {cancelled ? <span>{TASK_STATUS_LABELS[task.status]}</span> : null}
            {task.status === 'em-andamento' ? (
              <span className="text-brand-ink">Em andamento</span>
            ) : null}
            {showObjective ? <ObjectiveLink objective={objective} /> : null}
          </div>

          {blocked && parent ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-surface-hi px-2 py-1 text-xs text-ink-faint">
              <Icon name="cadeado" className="size-3.5" />
              Depende de “{parent.title}”
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 self-end sm:self-start">
        <PriorityTag priority={task.priority} />

        {isPending(task) ? (
          <>
            {/*
              A ponte entre o plano e o dia. Sem ela a ação atrasada só podia
              ser adiada mais um dia ou editada num diálogo — e o passo que o
              plano acabou de mostrar como próximo não tinha caminho até `Hoje`,
              que é a única tela onde ele vira execução.
            */}
            {task.day === planner.today ? null : (
              <IconButton
                icon="calendario"
                label={`Trazer ${task.title} pra hoje`}
                onClick={() => void planner.updateTask(task.id, { day: planner.today })}
              />
            )}
            <IconButton
              icon="adiar"
              label={`Adiar ${task.title} em um dia`}
              onClick={() =>
                void planner.updateTask(task.id, {
                  day: addDays(task.day < planner.today ? planner.today : task.day, 1),
                })
              }
            />
            {/* Cancelar em vez de excluir: a decisão de largar uma ação é
                informação, e é ela que a review usa pra perguntar o porquê. */}
            <IconButton
              icon="fechar"
              label={`Cancelar ${task.title}`}
              onClick={() =>
                void planner.updateTask(task.id, { status: 'cancelada', isMainPriority: false })
              }
            />
          </>
        ) : null}

        <IconButton
          icon="editar"
          label={`Editar ${task.title}`}
          onClick={() => composer.open('acao', { editing: task })}
        />
        <IconButton
          icon="lixeira"
          label={`Excluir ${task.title}`}
          onClick={() => setConfirming(true)}
        />
      </div>

      <ConfirmDialog
        open={confirming}
        title="Excluir essa ação?"
        description={
          isPending(task)
            ? 'Se você só quer tirar do caminho sem perder o registro, cancelar é melhor: a ação some do plano mas continua no histórico da review.'
            : 'A ação sai do plano e do histórico. Isso não dá pra desfazer, e o progresso da etapa é recalculado sem ela.'
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void planner.removeTask(task.id)}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}
