import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { formatDayLabel } from '@/domain/entities/day'
import { DAY_PART_LABELS, frequencyLabel, habitTargetLabel } from '@/domain/entities/habit'
import { deadlineLabelOf, OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { TASK_STATUS_LABELS } from '@/domain/entities/task'
import { ObjectiveStateTag, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { ObjectiveEditDialog } from '@/presentation/components/objective/ObjectiveEditDialog'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useObjective } from '@/presentation/planner/use-objectives'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

/**
 * Detalhe do objetivo.
 *
 * A tela existe pra responder "ainda está de pé?" e, quando não está, dar as
 * saídas honestas: pausar, mudar o prazo, concluir ou arquivar. Objetivo que só
 * dá pra apagar vira culpa, e culpa é o que faz a pessoa fechar o app.
 */
export function ObjectiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const planner = usePlanner()
  const composer = useComposer()
  const navigate = useNavigate()
  const view = useObjective(id)

  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<'arquivar' | 'concluir' | null>(null)

  if (planner.loading && !view) return <LoadingBlock label="Carregando o objetivo" />
  if (!view) return <Navigate to="/app/objetivos" replace />

  const { objective } = view.progress
  const axis = activityType(objective.axis)
  const paused = view.progress.state === 'pausado'
  const done = view.progress.state === 'concluido'

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/app/objetivos"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-ink-faint transition-colors hover:text-ink-muted"
      >
        <Icon name="setaEsq" className="size-4" />
        Todos os objetivos
      </Link>

      <PageHeader
        title={objective.title}
        description={objective.description ?? view.progress.summary}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Icon name="editar" className="size-4" />
              Editar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void planner.setObjectivePaused(objective.id, !paused)}
            >
              <Icon name={paused ? 'play' : 'pausa'} className="size-4" />
              {paused ? 'Retomar' : 'Pausar'}
            </Button>
          </div>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <ObjectiveStateTag state={view.progress.state} />
        <PriorityTag priority={objective.priority} />
        <Tag color={axis.colorToken}>{axis.label}</Tag>
        <Tag>{deadlineLabelOf(view.progress)}</Tag>
        {done || paused ? null : <Tag>{OBJECTIVE_STATUS_LABELS[view.progress.status]}</Tag>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Progresso" icon="progresso" />

            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="tabular text-4xl font-semibold tracking-tight text-ink">
                {Math.round(view.progress.ratio * 100)}
                <span className="text-2xl text-ink-faint">%</span>
              </p>
              <p className="text-right text-sm text-ink-muted">
                {formatUnit(axis, view.progress.done)}
                <span className="text-ink-faint"> de {objective.target}</span>
              </p>
            </div>

            <ProgressBar
              className="mt-3"
              value={view.progress.ratio}
              label={`Progresso de ${objective.title}`}
              color={axis.colorToken}
            />

            {/* O tempo consumido vem junto: 40% feito em 80% do prazo é uma
                informação completamente diferente de 40% em 20%. */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
              <Figure label="Prazo usado" value={`${Math.round(view.progress.elapsed * 100)}%`} />
              <Figure
                label="Ritmo necessário"
                value={
                  view.progress.dailyPace === 0
                    ? '—'
                    : `${Math.ceil(view.progress.dailyPace)}/dia`
                }
              />
              <Figure label="Restam" value={String(view.progress.remaining)} />
            </div>

            {objective.motive ? (
              <p className="mt-4 rounded-lg border border-line bg-surface-hi px-3 py-2 text-sm text-ink-muted">
                <span className="text-ink-faint">Por que importa: </span>
                {objective.motive}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader
              title="Ações"
              icon="plano"
              hint="Os passos concretos desse objetivo."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => composer.open('acao', { presetObjectiveId: objective.id })}
                >
                  <Icon name="mais" className="size-4" />
                  Nova ação
                </Button>
              }
            />

            {view.tasks.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nenhuma ação ainda. Objetivo sem ação é intenção: cria uma pequena pra hoje.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {view.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${
                        task.status === 'feita'
                          ? 'bg-positive'
                          : task.status === 'cancelada'
                            ? 'bg-line-hi'
                            : 'bg-brand'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          task.status === 'feita' || task.status === 'cancelada'
                            ? 'text-ink-faint line-through'
                            : 'text-ink'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDayLabel(task.day, planner.today)} · {TASK_STATUS_LABELS[task.status]}
                      </p>
                    </div>
                    <PriorityTag priority={task.priority} />
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/app/plano"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-ink transition-colors hover:text-brand-hi"
            >
              Abrir no plano
              <Icon name="seta" className="size-4" />
            </Link>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader
              title="Hábitos"
              icon="habitos"
              hint="A repetição que sustenta esse objetivo."
            />

            {view.habits.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nenhum hábito ligado. É o hábito que carrega o volume — a ação sozinha não fecha
                um objetivo de três meses.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {view.habits.map(({ habit, consistency }) => (
                  <li key={habit.id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-hi"
                      style={{ color: axis.colorToken }}
                    >
                      <HabitGlyph icon={habit.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{habit.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-faint">
                        {frequencyLabel(habit)} · {habitTargetLabel(habit)} ·{' '}
                        {DAY_PART_LABELS[habit.dayPart]}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-xs text-ink-muted">
                      {Math.round(consistency.rate * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Histórico recente" icon="jornada" />

            {view.recent.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nada registrado nesse objetivo ainda.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-line text-sm">
                {view.recent.map((activity) => (
                  <li key={activity.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink-muted">
                      {formatDayLabel(activity.day, planner.today)}
                    </span>
                    <span className="tabular text-ink">
                      {formatUnit(axis, activity.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Encerrar" icon="config" />
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  done
                    ? void planner.completeObjective(objective.id, false)
                    : setConfirming('concluir')
                }
              >
                <Icon name={done ? 'desfazer' : 'trofeu'} className="size-4" />
                {done ? 'Reabrir objetivo' : 'Marcar como concluído'}
              </Button>
              <Button variant="danger" onClick={() => setConfirming('arquivar')}>
                <Icon name="arquivar" className="size-4" />
                Arquivar
              </Button>
              <p className="text-xs text-ink-faint">
                Arquivar tira o objetivo da lista e libera a área pra um objetivo novo. O histórico
                de atividades continua onde está.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {view.tasks.length === 0 && view.habits.length === 0 ? (
        <EmptyState
          title="Esse objetivo ainda não virou plano"
          description="Sem hábito nem ação ele é só uma intenção com data. Cria a primeira ação ou deixa o Momentumm AI montar o caminho."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => composer.open('acao', { presetObjectiveId: objective.id })}>
                <Icon name="mais" className="size-4" />
                Criar ação
              </Button>
              <Button variant="secondary" onClick={() => navigate('/app/ia')}>
                <Icon name="ia" className="size-4" />
                Pedir um plano
              </Button>
            </div>
          }
        />
      ) : null}

      <ObjectiveEditDialog
        open={editing}
        objective={objective}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        open={confirming === 'concluir'}
        title="Concluir esse objetivo?"
        description="As ações que ainda estão em aberto vão ser canceladas — elas continuam no histórico, mas param de aparecer no plano e no dia."
        confirmLabel="Concluir"
        onConfirm={() => void planner.completeObjective(objective.id, true)}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === 'arquivar'}
        title="Arquivar esse objetivo?"
        description="Ele sai da lista e some do dia. Isso não apaga as atividades já registradas, e a área fica livre pra um objetivo novo."
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          void planner.archiveObjective(objective.id)
          navigate('/app/objetivos')
        }}
        onClose={() => setConfirming(null)}
      />
    </div>
  )
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
