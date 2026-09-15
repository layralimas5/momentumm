import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { formatDayLabel } from '@/domain/entities/day'
import { DAY_PART_LABELS, frequencyLabel, habitTargetLabel } from '@/domain/entities/habit'
import { deadlineLabelOf, OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { ObjectiveStateTag, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { ObjectiveEditDialog } from '@/presentation/components/objective/ObjectiveEditDialog'
import { ForecastPanel } from '@/presentation/components/plan/ForecastPanel'
import { StagePanel } from '@/presentation/components/plan/StagePanel'
import { goalCompletedEvent, goalProgressEvent } from '@/domain/share/journey-event-builders'
import { useAuth } from '@/presentation/auth/use-auth'
import { ShareButton } from '@/presentation/share/ShareButton'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useDashboard } from '@/presentation/planner/use-dashboard'
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
  const { user } = useAuth()
  const planner = usePlanner()
  // O momentum entra no card do objetivo. Ler o dashboard aqui é o caminho de
  // sempre: a conta é a mesma do `Hoje`, e refazê-la nesta tela criaria dois
  // números com o mesmo nome.
  const dashboard = useDashboard()
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

  /*
    Os números que esta tela já mostra, indo junto pro card.

    Volume, etapas e prazo são o que responde "o que foi feito" — a
    porcentagem sozinha diz que o objetivo andou, e não o quanto. Eles saem da
    MESMA leitura que a página usa, então card e tela nunca discordam.
  */
  const objectiveNumbers = {
    doneValue: view.progress.done,
    targetValue: objective.target,
    unitLabel: axis.unitLabel.many,
    daysLeft: view.progress.daysLeft,
    stagesDone: view.plan.stages.filter((item) => item.stage.status === 'concluida').length,
    stagesTotal: view.plan.stages.length,
  }

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
            {user ? (
              <ShareButton
                label={done ? 'Compartilhar conquista' : 'Compartilhar progresso'}
                icon={done ? 'trofeu' : 'jornada'}
                variant={done ? 'primary' : 'secondary'}
                build={() =>
                  done
                    ? goalCompletedEvent({
                        ...objectiveNumbers,
                        userId: user.id,
                        today: planner.today,
                        objectiveId: objective.id,
                        title: objective.title,
                        axis: objective.axis,
                        momentum: dashboard.momentum,
                      })
                    : goalProgressEvent({
                        ...objectiveNumbers,
                        userId: user.id,
                        today: planner.today,
                        objectiveId: objective.id,
                        title: objective.title,
                        axis: objective.axis,
                        ratio: view.ratio,
                        // O ganho semanal só entra quando a previsão tem
                        // história pra sustentar: mostrar "+0%" ou um número
                        // chutado num card seria pior que não mostrar nada.
                        gainPercentage:
                          view.forecast.dailyRate > 0 && view.forecast.confidence !== 'baixa'
                            ? view.forecast.dailyRate * 7 * 100
                            : null,
                        momentum: dashboard.momentum,
                      })
                }
              />
            ) : null}
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

            {/*
              O número grande é a EXECUÇÃO do plano, não o volume registrado.
              São perguntas diferentes: "quanto do caminho eu andei" e "quanto
              eu produzi", e a segunda vem logo abaixo, com nome. Sem plano, o
              volume assume — uma barra em zero pra quem leu 400 páginas seria
              simplesmente falsa.
            */}
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="tabular text-4xl font-semibold tracking-tight text-ink">
                  {Math.round(view.ratio * 100)}
                  <span className="text-2xl text-ink-faint">%</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {view.ratioSource === 'plano'
                    ? 'do plano concluído'
                    : 'do alvo registrado (sem plano ainda)'}
                </p>
              </div>
              <p className="text-right text-sm text-ink-muted">
                {formatUnit(axis, view.progress.done)}
                <span className="text-ink-faint"> de {objective.target}</span>
                <span className="mt-0.5 block text-xs text-ink-faint">volume registrado</span>
              </p>
            </div>

            <ProgressBar
              className="mt-3"
              value={view.ratio}
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
                    ? 'sem ritmo'
                    : `${Math.ceil(view.progress.dailyPace)}/dia`
                }
              />
              <Figure
                label="Etapa atual"
                value={view.plan.currentStage?.stage.title ?? 'sem etapa'}
              />
            </div>

            {objective.motive ? (
              <p className="mt-4 rounded-lg border border-line bg-surface-hi px-3 py-2 text-sm text-ink-muted">
                <span className="text-ink-faint">Por que importa: </span>
                {objective.motive}
              </p>
            ) : null}
          </Panel>

          <StagePanel plan={view.plan} />
        </div>

        <div className="flex flex-col gap-5">
          <ForecastPanel view={view} />

          <Panel>
            <PanelHeader
              title="Hábitos"
              icon="habitos"
              hint="A repetição que sustenta esse objetivo."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    composer.open('habito', { presetObjectiveId: objective.id })
                  }
                >
                  <Icon name="mais" className="size-4" />
                  Novo hábito
                </Button>
              }
            />

            {view.habits.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nenhum hábito ligado. É o hábito que carrega o volume. A ação sozinha não fecha
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
                      {/* A etapa aparece quando existe: é o que diz que o hábito
                          sustenta uma fase e não o objetivo inteiro. */}
                      {habit.stageId ? (
                        <p className="mt-0.5 truncate text-xs text-ink-faint">
                          Etapa:{' '}
                          {view.plan.stages.find((item) => item.stage.id === habit.stageId)?.stage
                            .title ?? 'sem etapa'}
                        </p>
                      ) : null}
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
                Arquivar tira o objetivo da lista, apaga as etapas dele e libera a área pra um
                objetivo novo. As ações e os hábitos continuam, sem etapa, e o histórico de
                atividades fica onde está.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {!view.plan.hasPlan && view.tasks.length === 0 && view.habits.length === 0 ? (
        <EmptyState
          title="Esse objetivo ainda não virou plano"
          description="Sem etapa, hábito nem ação ele é só uma intenção com data. Quebra ele em três a cinco etapas, ou deixa o Momentumm AI montar o caminho."
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
        description="As ações que ainda estão em aberto vão ser canceladas. Elas continuam no histórico, mas param de aparecer no plano e no dia."
        confirmLabel="Concluir"
        onConfirm={() => void planner.completeObjective(objective.id, true)}
        onClose={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === 'arquivar'}
        title="Arquivar esse objetivo?"
        description="Ele sai da lista e some do dia, e as etapas do plano são apagadas junto, porque elas não existem fora do objetivo. As ações e os hábitos ficam, sem etapa. Nenhuma atividade registrada é apagada, e a área fica livre pra um objetivo novo."
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
