import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { addDays, formatDayLabel } from '@/domain/entities/day'
import {
  byPlanOrder,
  isBlocked,
  isPending,
  planHorizons,
  resequence,
  TASK_STATUS_LABELS,
  type Task,
} from '@/domain/entities/task'
import { ObjectiveLink, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { IconButton, Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useObjectives } from '@/presentation/planner/use-objectives'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

type PlanMode = 'objetivo' | 'prazo'

/**
 * Plano.
 *
 * A tela existe pra mostrar OBJETIVO VIRANDO PASSO. Por isso a visão padrão é
 * por objetivo e não uma lista de tarefas: uma lista chapada de trinta ações
 * não diz o que está sendo construído, e a pessoa executa sem chegar em lugar
 * nenhum — que é exatamente a dor que o produto ataca.
 *
 * A visão por prazo existe ao lado porque a pergunta "o que está atrasado" é
 * real, e ela não se responde olhando objetivo por objetivo.
 */
export function PlanPage() {
  const planner = usePlanner()
  const views = useObjectives()
  const composer = useComposer()
  const navigate = useNavigate()
  const [mode, setMode] = useState<PlanMode>('objetivo')

  const loose = useMemo(
    () => planner.tasks.filter((task) => task.objectiveId === null && isPending(task)).sort(byPlanOrder),
    [planner.tasks],
  )

  const horizons = useMemo(() => planHorizons(planner.tasks, planner.today), [planner.tasks, planner.today])
  const withPlan = views.filter((view) => view.tasks.length > 0)
  const overdue = horizons.find((horizon) => horizon.key === 'atrasada')?.tasks.length ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano"
        description="Os teus objetivos virando passos com data. Não é uma lista de tarefas: cada ação daqui empurra alguma coisa."
        action={
          <Button onClick={() => composer.open('acao')}>
            <Icon name="mais" className="size-4" />
            Nova ação
          </Button>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Como ver o plano" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {(['objetivo', 'prazo'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                mode === item ? 'bg-surface-top text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item === 'objetivo' ? 'Por objetivo' : 'Por prazo'}
            </button>
          ))}
        </div>

        {overdue > 0 ? (
          <Tag tone="warn">
            {overdue} {overdue === 1 ? 'ação atrasada' : 'ações atrasadas'}
          </Tag>
        ) : null}
      </div>

      {planner.loading && planner.tasks.length === 0 ? (
        <LoadingBlock label="Carregando o plano" />
      ) : planner.tasks.length === 0 ? (
        <EmptyState
          title="Nenhuma ação no plano"
          description="O plano nasce de um objetivo. Cria um objetivo e o Momentumm já sugere os primeiros passos — ou escreve a primeira ação você mesma."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => composer.open('objetivo')}>
                <Icon name="objetivo" className="size-4" />
                Criar objetivo
              </Button>
              <Button variant="secondary" onClick={() => composer.open('acao')}>
                <Icon name="mais" className="size-4" />
                Ação avulsa
              </Button>
            </div>
          }
        />
      ) : mode === 'objetivo' ? (
        <div className="flex flex-col gap-5">
          {withPlan.map((view) => {
            const { objective } = view.progress
            const axis = activityType(objective.axis)
            const ratio = view.tasks.length === 0 ? 0 : view.doneTasks / view.tasks.length

            return (
              <Panel key={objective.id}>
                <PanelHeader
                  title={objective.title}
                  hint={`${view.doneTasks} de ${view.tasks.length} ações concluídas`}
                  action={
                    <div className="flex gap-1">
                      <IconButton
                        icon="mais"
                        label={`Nova ação em ${objective.title}`}
                        onClick={() =>
                          composer.open('acao', { presetObjectiveId: objective.id })
                        }
                      />
                      <IconButton
                        icon="seta"
                        label={`Abrir ${objective.title}`}
                        onClick={() => navigate(`/app/objetivos/${objective.id}`)}
                      />
                    </div>
                  }
                />

                <ProgressBar
                  className="mt-3"
                  value={ratio}
                  label={`Ações concluídas em ${objective.title}`}
                  color={axis.colorToken}
                />

                <ol className="mt-4 flex flex-col divide-y divide-line">
                  {view.tasks.map((task, index) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      index={index}
                      siblings={view.tasks}
                      showObjective={false}
                    />
                  ))}
                </ol>
              </Panel>
            )
          })}

          {loose.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Ações soltas"
                icon="plano"
                hint="Sem objetivo por trás. Vale conferir se ainda fazem sentido."
              />
              <ol className="mt-4 flex flex-col divide-y divide-line">
                {loose.map((task, index) => (
                  <TaskRow key={task.id} task={task} index={index} siblings={loose} showObjective />
                ))}
              </ol>
            </Panel>
          ) : null}

          {withPlan.length === 0 && loose.length === 0 ? (
            <EmptyState
              title="Nenhum objetivo virou plano ainda"
              description="Você tem objetivos, mas nenhum tem ação. Abre um deles e cria o primeiro passo."
              action={
                <Button variant="secondary" onClick={() => navigate('/app/objetivos')}>
                  Ver objetivos
                </Button>
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {horizons.map((horizon) => (
            <Panel key={horizon.key}>
              <PanelHeader
                title={horizon.label}
                hint={horizon.hint}
                icon={horizon.key === 'atrasada' ? 'adiar' : 'calendario'}
              />
              <ol className="mt-4 flex flex-col divide-y divide-line">
                {horizon.tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    siblings={horizon.tasks}
                    showObjective
                    showDay
                  />
                ))}
              </ol>
            </Panel>
          ))}

          {horizons.length === 0 ? (
            <EmptyState
              title="Nada em aberto"
              description="Todas as ações do plano estão concluídas ou canceladas. É um bom momento pra abrir o próximo objetivo."
              action={
                <Button onClick={() => composer.open('objetivo')}>
                  <Icon name="objetivo" className="size-4" />
                  Novo objetivo
                </Button>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

/**
 * Uma linha do plano.
 *
 * Reordenar é por botão de subir e descer, não por arrastar. Arrastar não
 * funciona por teclado nem por leitor de tela, e o plano precisa ser
 * reordenável por qualquer pessoa — a seta cobre os dois casos e ainda funciona
 * no celular sem conflitar com a rolagem.
 */
function TaskRow({
  task,
  index,
  siblings,
  showObjective,
  showDay = false,
}: {
  readonly task: Task
  readonly index: number
  readonly siblings: readonly Task[]
  readonly showObjective: boolean
  readonly showDay?: boolean
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

  const move = (direction: -1 | 1) => {
    const next = [...siblings]
    const target = index + direction
    const current = next[index]
    const swap = next[target]
    if (!current || !swap) return
    next[index] = swap
    next[target] = current
    void planner.reorderTasks(resequence(next))
  }

  return (
    /*
      No celular a linha empilha: título em cima, ações embaixo. Lado a lado,
      quatro botões e a etiqueta de prioridade comem a largura toda e o título
      quebra em uma palavra por linha — a lista deixa de ser legível justamente
      no aparelho em que ela é mais usada.
    */
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
      <button
        type="button"
        aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
        disabled={blocked || cancelled}
        onClick={() =>
          void planner.updateTask(task.id, {
            status: done ? 'pendente' : 'feita',
            completedAt: done ? null : new Date(),
          })
        }
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
        <p
          className={cn(
            'text-sm',
            done || cancelled ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
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

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <PriorityTag priority={task.priority} />

        {isPending(task) ? (
          <>
            <IconButton
              icon="subir"
              label={`Subir ${task.title}`}
              disabled={index === 0}
              onClick={() => move(-1)}
            />
            <IconButton
              icon="descer"
              label={`Descer ${task.title}`}
              disabled={index === siblings.length - 1}
              onClick={() => move(1)}
            />
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
            : 'A ação sai do plano e do histórico. Isso não dá pra desfazer.'
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void planner.removeTask(task.id)}
        onClose={() => setConfirming(false)}
      />
    </li>
  )
}
