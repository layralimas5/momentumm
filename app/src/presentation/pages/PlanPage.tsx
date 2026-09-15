import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { inboxTasks, planHorizons, type Task } from '@/domain/entities/task'
import { StagePanel } from '@/presentation/components/plan/StagePanel'
import { TaskRow } from '@/presentation/components/plan/TaskRow'
import { useTaskMove } from '@/presentation/components/plan/use-task-move'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { SortableList } from '@/presentation/components/ui/SortableList'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
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

  // Caixa de entrada: capturada sem objetivo, então não empurra progresso
  // nenhum. Ela existe pra a captura rápida não morrer — o que ela não pode é
  // ficar invisível, senão vira um monte de ação órfã que ninguém revisita.
  const inbox = useMemo(() => inboxTasks(planner.tasks), [planner.tasks])

  const horizons = useMemo(
    () => planHorizons(planner.tasks, planner.today),
    [planner.tasks, planner.today],
  )

  const withPlan = views.filter((view) => view.plan.hasPlan || view.tasks.length > 0)
  const overdue = horizons.find((horizon) => horizon.key === 'atrasada')?.tasks.length ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano"
        description="O caminho até cada objetivo, com o que está travando visível. Não é uma lista de tarefas: cada ação daqui empurra uma etapa, e o app diz qual delas está segurando o resto."
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

        {inbox.length > 0 ? (
          <Tag>
            {inbox.length} na caixa de entrada
          </Tag>
        ) : null}
      </div>

      {planner.loading && planner.tasks.length === 0 ? (
        <LoadingBlock label="Carregando o plano" />
      ) : planner.tasks.length === 0 ? (
        <EmptyState
          title="Nenhuma ação no plano"
          description="O plano nasce de um objetivo. Cria um objetivo e o Momentumm já sugere os primeiros passos, ou escreve a primeira ação por conta própria."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => composer.open('objetivo')}>
                <Icon name="objetivo" className="size-4" />
                Criar objetivo
              </Button>
              <Button variant="secondary" onClick={() => composer.open('acao')}>
                <Icon name="mais" className="size-4" />
                Anotar uma ação
              </Button>
            </div>
          }
        />
      ) : mode === 'objetivo' ? (
        <div className="flex flex-col gap-5">
          {withPlan.map((view) => {
            const { objective } = view.progress
            const axis = activityType(objective.axis)

            return (
              <div key={objective.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/objetivos/${objective.id}`)}
                      className="text-left text-base font-semibold text-ink transition-colors hover:text-brand-ink"
                    >
                      {objective.title}
                    </button>
                    <p className="mt-0.5 text-sm text-ink-faint">
                      {view.ratioSource === 'plano'
                        ? `${Math.round(view.ratio * 100)}% do plano · etapa atual: ${
                            view.plan.currentStage?.stage.title ?? 'nenhuma'
                          }`
                        : `${view.doneTasks} de ${view.tasks.length} ações concluídas · sem etapas ainda`}
                    </p>
                  </div>
                  <Tag color={axis.colorToken}>{axis.label}</Tag>
                </div>

                <ProgressBar
                  value={view.ratio}
                  label={`Progresso de ${objective.title}`}
                  color={axis.colorToken}
                />

                <StagePanel plan={view.plan} />
              </div>
            )
          })}

          {inbox.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Caixa de entrada"
                icon="plano"
                hint="Anotadas sem objetivo. Não contam pra nenhum progresso até ganharem um destino."
              />
              <TaskList tasks={inbox} label="Caixa de entrada" />
              <p className="mt-3 text-xs text-ink-faint">
                Editar a ação e escolher objetivo e etapa é o que faz ela passar a empurrar
                alguma coisa.
              </p>
            </Panel>
          ) : null}

          {withPlan.length === 0 && inbox.length === 0 ? (
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
              <TaskList tasks={horizon.tasks} label={horizon.label} />
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
 * As ações de um bloco do plano, reordenáveis pela alça.
 *
 * Mora aqui porque a caixa de entrada e a visão por prazo mostram a mesma
 * lista com o mesmo comportamento — e o dia em que uma delas ganhar arraste e
 * a outra não é o dia em que a ordem passa a depender de onde a pessoa clicou.
 */
function TaskList({ tasks, label }: { readonly tasks: readonly Task[]; readonly label: string }) {
  const move = useTaskMove(tasks)

  return (
    <SortableList
      items={tasks}
      itemKey={(task) => task.id}
      itemLabel={(task) => task.title}
      onMove={move}
      label={label}
      className="mt-4 flex flex-col divide-y divide-line"
      renderItem={(task, handle) => (
        <TaskRow task={task} handle={handle} showObjective showDay />
      )}
    />
  )
}
