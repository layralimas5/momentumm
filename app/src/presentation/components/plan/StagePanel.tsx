import { useState, type ReactNode } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { formatDayLabel } from '@/domain/entities/day'
import type { PlanProgress, StageProgress } from '@/domain/entities/plan-progress'
import {
  distributeWeights,
  rebalanceWeights,
  stagesOfObjective,
  totalWeightOf,
  weightsAreComplete,
  type PlanStage,
} from '@/domain/entities/plan-stage'
import type { Task } from '@/domain/entities/task'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { StageStatusTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { SortableList } from '@/presentation/components/ui/SortableList'
import { IconButton, Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { moveItem } from '@/shared/lib/move-item'
import { StageDialog } from './StageDialog'
import { TaskRow } from './TaskRow'
import { useTaskMove } from './use-task-move'

/**
 * O plano do objetivo: as etapas, na ordem, com as ações dentro.
 *
 * É a tela que mostra a hierarquia existindo. Cada etapa carrega o peso que
 * tem no objetivo e o quanto dela saiu, e as ações aparecem DENTRO da etapa em
 * vez de numa lista chapada — porque é isso que responde "o que estou
 * construindo" em vez de "o que tenho pra fazer".
 *
 * No celular a etapa vem recolhida, exceto a atual. Cinco etapas abertas com
 * quatro ações cada viram uma rolagem de tela e meia antes de a pessoa chegar
 * no que importa hoje.
 */
export function StagePanel({ plan }: { readonly plan: PlanProgress }) {
  const planner = usePlanner()
  const composer = useComposer()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PlanStage | null>(null)
  const [removing, setRemoving] = useState<StageProgress | null>(null)

  const objective = plan.objective
  const axis = activityType(objective.axis)
  const stages = plan.stages
  const balanced = weightsAreComplete(stages.map((item) => item.stage))

  // A primeira etapa abre um plano novo, e é isso que o gratuito limita. Um
  // objetivo que já tem caminho continua ganhando etapas em qualquer plano.
  const planBlocked = stages.length === 0 && planner.usage.plans.reached

  const move = (from: number, to: number) => {
    const ordered = moveItem(
      stages.map((item) => item.stage),
      from,
      to,
    )
    void planner.reweightStages(
      objective.id,
      // A ordem muda, o peso de cada etapa não: arrastar o MVP pra frente não
      // pode mudar o quanto ele vale do objetivo.
      ordered.map((stage, position) => ({ ...stage, order: position })),
    )
  }

  const balance = () => {
    const ordered = stagesOfObjective(
      stages.map((item) => item.stage),
      objective.id,
    )
    void planner.reweightStages(objective.id, rebalanceWeights(ordered))
  }

  return (
    <Panel>
      <PanelHeader
        title="Plano"
        icon="plano"
        hint="As etapas até o objetivo. O peso de cada uma é o quanto ela vale do total."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreating(true)}
            disabled={planBlocked}
          >
            <Icon name="mais" className="size-4" />
            Nova etapa
          </Button>
        }
      />

      {stages.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line-hi px-4 py-6 text-center">
          <p className="text-sm text-ink">Esse objetivo ainda não tem caminho.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Sem etapas, o progresso só consegue medir volume registrado. Quebra o objetivo em
            três a cinco pedaços e cada ação passa a empurrar um deles.
          </p>
          {planBlocked ? (
            <UpgradeHint
              className="mx-auto mt-4 w-fit text-left"
              message={planner.usage.plans.message ?? ''}
            />
          ) : (
            <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
              <Icon name="mais" className="size-4" />
              Criar a primeira etapa
            </Button>
          )}
        </div>
      ) : (
        <>
          {/*
            O aviso de peso aparece só quando ele está quebrado. Um alerta
            permanente ensina a pessoa a ignorar todos os avisos da tela.
          */}
          {balanced ? null : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-flame/30 bg-flame-dim/40 px-3.5 py-3">
              <p className="text-sm text-ink">
                Os pesos das etapas somam {totalWeightOf(stages.map((item) => item.stage))}%. Enquanto
                não fecharem 100%, a porcentagem do objetivo fica distorcida.
              </p>
              <Button size="sm" variant="secondary" onClick={balance}>
                Distribuir igual ({distributeWeights(stages.length)[0]}% cada)
              </Button>
            </div>
          )}

          <SortableList
            items={stages}
            itemKey={(item) => item.stage.id}
            itemLabel={(item) => `a etapa ${item.stage.title}`}
            onMove={move}
            label={`Etapas de ${objective.title}`}
            className="mt-4 flex flex-col gap-3"
            renderItem={(item, handle, index) => (
              <StageBlock
                progress={item}
                index={index}
                handle={handle}
                color={axis.colorToken}
                isCurrent={plan.currentStage?.stage.id === item.stage.id}
                isBottleneck={plan.bottleneck?.stage.id === item.stage.id}
                onEdit={() => setEditing(item.stage)}
                onRemove={() => setRemoving(item)}
                onAddTask={() =>
                  composer.open('acao', {
                    presetObjectiveId: objective.id,
                    presetStageId: item.stage.id,
                  })
                }
              />
            )}
          />
        </>
      )}

      {plan.unstaged.length > 0 ? (
        <div className="mt-5 rounded-xl border border-line bg-surface-hi/40 p-4">
          <p className="text-sm font-medium text-ink">Ações sem etapa</p>
          <p className="mt-1 text-sm text-ink-muted">
            Elas pertencem a esse objetivo mas não estão em nenhum pedaço do caminho, então não
            contam pro progresso. Editar e escolher a etapa resolve.
          </p>
          <StageTaskList tasks={plan.unstaged} label="Ações sem etapa" className="mt-2" />
        </div>
      ) : null}

      <StageDialog
        open={creating}
        objectiveId={objective.id}
        onClose={() => setCreating(false)}
      />

      {editing ? (
        <StageDialog
          open
          objectiveId={objective.id}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={`Apagar a etapa ${removing?.stage.title ?? ''}?`}
        description={
          removing && removing.totalTasks > 0
            ? `As ${removing.totalTasks} ações dela NÃO são apagadas: elas voltam pro objetivo sem etapa e você decide o destino. Os pesos das outras etapas são redistribuídos.`
            : 'A etapa sai do plano e os pesos das outras são redistribuídos.'
        }
        confirmLabel="Apagar etapa"
        destructive
        onConfirm={() => {
          if (removing) void planner.removeStage(removing.stage.id)
        }}
        onClose={() => setRemoving(null)}
      />
    </Panel>
  )
}

function StageBlock({
  progress,
  index,
  handle,
  color,
  isCurrent,
  isBottleneck,
  onEdit,
  onRemove,
  onAddTask,
}: {
  readonly progress: StageProgress
  readonly index: number
  /** A alça de arrastar, entregue pela lista. Null quando há uma etapa só. */
  readonly handle: ReactNode
  readonly color: string
  readonly isCurrent: boolean
  readonly isBottleneck: boolean
  readonly onEdit: () => void
  readonly onRemove: () => void
  readonly onAddTask: () => void
}) {
  const planner = usePlanner()
  // Aberta por padrão só a etapa atual: o resto é contexto, não trabalho de hoje.
  const [open, setOpen] = useState(isCurrent)

  const { stage } = progress
  const done = stage.status === 'concluida'

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface-hi/30',
        isBottleneck ? 'border-flame/40' : isCurrent ? 'border-brand/40' : 'border-line',
      )}
    >
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start">
        {/*
          A alça anda junto do título, e não como uma linha própria: no celular
          a etapa empilha, e uma alça sozinha em cima só gastava altura antes
          de a pessoa chegar no nome da etapa.
        */}
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          {handle ? <div className="-my-1.5 -ml-1.5 shrink-0">{handle}</div> : null}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
          <span
            aria-hidden="true"
            className={cn(
              'tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold',
              done
                ? 'border-positive/40 bg-positive/15 text-positive'
                : 'border-line-hi text-ink-faint',
            )}
          >
            {done ? <Icon name="check" className="size-4" strokeWidth={2.5} /> : index + 1}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn('text-sm font-medium', done ? 'text-ink-muted' : 'text-ink')}>
                {stage.title}
              </span>
              <StageStatusTag status={progress.status} />
              <Tag>{stage.weight}% do objetivo</Tag>
              {isBottleneck ? <Tag tone="warn">Segurando o objetivo</Tag> : null}
            </span>

            {stage.description ? (
              <span className="mt-1 block text-xs text-ink-faint">{stage.description}</span>
            ) : null}

            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              <span className="tabular text-ink-muted">{Math.round(progress.ratio * 100)}%</span>
              {/* Etapa vazia não anuncia "0 de 0": um contador zerado não
                  informa nada e ainda dá a impressão de erro. */}
              {progress.totalTasks > 0 ? (
                <span>
                  {progress.doneTasks} de {progress.totalTasks}{' '}
                  {progress.totalTasks === 1 ? 'ação' : 'ações'}
                </span>
              ) : done ? (
                <span>Concluída sem ações no app</span>
              ) : (
                <span>Sem ações ainda</span>
              )}
              {progress.overdueTasks.length > 0 ? (
                <span className="text-flame">
                  {progress.overdueTasks.length} atrasada
                  {progress.overdueTasks.length === 1 ? '' : 's'}
                </span>
              ) : null}
              {stage.dueOn ? <span>até {formatDayLabel(stage.dueOn, planner.today)}</span> : null}
              <Icon
                name={open ? 'recolher' : 'expandir'}
                className={cn('size-3.5 transition-transform', open && 'rotate-90')}
              />
            </span>

            <ProgressBar
              className="mt-2"
              value={progress.ratio}
              label={`Progresso da etapa ${stage.title}`}
              color={color}
            />
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
          <IconButton icon="mais" label={`Nova ação em ${stage.title}`} onClick={onAddTask} />
          <IconButton icon="editar" label={`Editar a etapa ${stage.title}`} onClick={onEdit} />
          <IconButton icon="lixeira" label={`Apagar a etapa ${stage.title}`} onClick={onRemove} />
        </div>
      </div>

      {open ? (
        <div className="border-t border-line px-3.5 pb-3.5">
          {progress.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Nenhuma ação nessa etapa. Enquanto ela estiver vazia, o progresso dela é zero.
            </p>
          ) : (
            <StageTaskList tasks={progress.tasks} label={`Ações de ${stage.title}`} showWeight />
          )}

          {/*
            A sugestão de concluir aparece quando as obrigatórias saíram — e é
            sugestão mesmo: quem fecha a etapa é a pessoa, porque ela pode ter
            critério que o app não conhece.
          */}
          {progress.canSuggestCompletion ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-positive/25 bg-positive/5 px-3 py-2.5">
              <p className="text-sm text-ink">
                Todas as ações obrigatórias dessa etapa saíram.
                {progress.hasOptionalLeft ? ' As opcionais continuam em aberto.' : ''}
              </p>
              <Button size="sm" onClick={() => void planner.completeStage(stage.id, true)}>
                <Icon name="check" className="size-4" />
                Concluir etapa
              </Button>
            </div>
          ) : null}

          {done ? (
            <Button
              className="mt-3"
              size="sm"
              variant="ghost"
              onClick={() => void planner.completeStage(stage.id, false)}
            >
              <Icon name="desfazer" className="size-4" />
              Reabrir etapa
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * As ações de uma etapa, ou as que ficaram sem etapa, reordenáveis pela alça.
 *
 * A ordem daqui é a ordem de execução dentro do pedaço do caminho: é ela que o
 * plano lê pra dizer qual é a próxima ação da etapa.
 */
function StageTaskList({
  tasks,
  label,
  showWeight = false,
  className,
}: {
  readonly tasks: readonly Task[]
  readonly label: string
  readonly showWeight?: boolean
  readonly className?: string
}) {
  const move = useTaskMove(tasks)

  return (
    <SortableList
      items={tasks}
      itemKey={(task) => task.id}
      itemLabel={(task) => task.title}
      onMove={move}
      label={label}
      className={cn('flex flex-col divide-y divide-line', className)}
      renderItem={(task, handle) => (
        <TaskRow
          task={task}
          handle={handle}
          showObjective={false}
          showDay
          showWeight={showWeight}
        />
      )}
    />
  )
}
