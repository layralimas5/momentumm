import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayKeyToDate } from '@/domain/entities/day'
import {
  percent,
  reviewWeek,
  weekRangeLabel,
  type ReviewInput,
  type ReviewPoint,
  type WeekReview,
} from '@/domain/entities/review'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Stat, StatGrid } from '@/presentation/components/ui/Stat'
import { Panel, PanelHeader, ProgressBar } from '@/presentation/components/ui/Surface'
import { ObjectiveRow } from '@/presentation/components/dashboard/ObjectivesCard'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/** Quantas semanas pra trás o histórico oferece. */
const MAX_WEEKS_BACK = 3

/**
 * Review da semana.
 *
 * O dashboard responde "o que eu faço agora". Esta tela responde "o que a
 * semana me ensinou", e por isso é outra tela: relatório dentro do dia
 * transforma execução em contabilidade.
 *
 * A ordem é a da pergunta real: como foi, quanto do planejado saiu, onde o
 * ritmo caiu, onde subiu, e o que mudar na próxima. A recomendação fecha a
 * página porque é a única coisa que a pessoa leva daqui.
 */
export function ReviewPage() {
  const planner = usePlanner()
  const composer = useComposer()
  const navigate = useNavigate()
  const [weeksAgo, setWeeksAgo] = useState(0)

  const review = useMemo<WeekReview>(() => {
    const input: ReviewInput = {
      activities: planner.activities,
      habits: planner.habits,
      habitLogs: planner.habitLogs,
      tasks: planner.tasks,
      checkIns: planner.checkIns,
      objectives: planner.objectiveProgress,
      today: planner.today,
      weeksAgo,
    }
    return reviewWeek(input)
  }, [planner, weeksAgo])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Review da semana"
        description="O que os sete dias mostraram e o que isso muda na semana que vem."
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/app')}>
            <Icon name="hoje" className="size-4" />
            Voltar pro dia
          </Button>
        }
      />

      <nav aria-label="Semanas anteriores" className="flex flex-wrap items-center gap-2">
        {Array.from({ length: MAX_WEEKS_BACK + 1 }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={weeksAgo === index}
            onClick={() => setWeeksAgo(index)}
            disabled={index > 0 && !planner.limits.advancedAnalytics}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
              weeksAgo === index
                ? 'border-brand bg-brand-dim/60 text-ink'
                : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line',
            )}
          >
            {index === 0 ? 'Esta semana' : index === 1 ? 'Semana passada' : `${index} semanas atrás`}
          </button>
        ))}
      </nav>

      {planner.limits.advancedAnalytics ? null : (
        <UpgradeHint message="O histórico de semanas anteriores fica no PRO. A review da semana atual é sempre aberta." />
      )}

      <Panel tone="brand" aria-labelledby="review-titulo">
        <PanelHeader
          id="review-titulo"
          title={`Semana de ${weekRangeLabel(review.start, review.end)}`}
          icon="insights"
        />
        <p className="mt-3 text-pretty text-ink">{review.headline}</p>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-muted">Execução do que estava planejado</span>
            <span className="tabular text-2xl font-semibold text-ink">
              {percent(review.execution.rate)}
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={review.execution.rate}
            label="Percentual de execução da semana"
            color={review.execution.rate >= 0.7 ? 'var(--color-positive)' : 'var(--color-brand)'}
          />
          <p className="mt-2 text-xs text-ink-faint">
            {review.execution.done} de {review.execution.planned} compromissos:{' '}
            {review.execution.habitsDone}/{review.execution.habitsPlanned} hábitos e{' '}
            {review.execution.tasksDone}/{review.execution.tasksPlanned} ações.
          </p>
        </div>
      </Panel>

      <StatGrid>
        <Stat
          label="Dias com movimento"
          value={`${review.activeDays}`}
          hint={`${review.previousActiveDays} na semana anterior`}
        />
        <Stat
          label="Hábitos cumpridos"
          value={`${review.execution.habitsDone}`}
          hint={`${review.previousExecution.habitsDone} na semana anterior`}
        />
        <Stat
          label="Ações concluídas"
          value={`${review.execution.tasksDone}`}
          hint={`${review.previousExecution.tasksDone} na semana anterior`}
        />
        <Stat
          label="Minutos"
          value={`${review.focusMinutes}`}
          hint={`${review.previousFocusMinutes} na semana anterior`}
        />
      </StatGrid>

      <Panel aria-labelledby="ritmo-titulo">
        <PanelHeader
          id="ritmo-titulo"
          title="O ritmo dia a dia"
          icon="hoje"
          hint="Barra cheia é dia em que o planejado saiu inteiro."
        />
        <ol className="mt-5 flex items-end justify-between gap-1.5" aria-label="Dias da semana">
          {review.series.map((day) => {
            const height = Math.max(6, Math.round(day.intensity * 72))
            const weekday = WEEKDAY_INITIALS[dayKeyToDate(day.day).getDay()]

            return (
              <li key={day.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="flex h-20 w-full items-end">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'w-full rounded-md transition-[height] duration-500 ease-out',
                      day.intensity > 0.6
                        ? 'bg-brand'
                        : day.intensity > 0
                          ? 'bg-brand/45'
                          : 'bg-surface-top',
                    )}
                    style={{ height: `${height}px` }}
                  />
                </span>
                <span className="text-xs text-ink-faint">{weekday}</span>
                <span className="sr-only">
                  {day.day}: {day.minutes} minutos, {day.habitsDone} hábitos e {day.tasksDone} ações
                </span>
              </li>
            )
          })}
        </ol>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <PointList
          title="Onde o ritmo caiu"
          icon="adiar"
          tone="warn"
          points={review.lost}
          empty="Nenhuma queda relevante nessa semana. Não é elogio: é o que os números mostram."
        />
        <PointList
          title="Onde você evoluiu"
          icon="trofeu"
          tone="positive"
          points={review.gained}
          empty="Ainda não houve variação pra cima. Mais uma semana de registro e a comparação começa a valer."
        />
      </div>

      <Panel tone="raised" aria-labelledby="recomendacao-titulo">
        <PanelHeader
          id="recomendacao-titulo"
          title="Pra próxima semana"
          icon="raio"
          hint="Uma mudança por vez. Duas ao mesmo tempo escondem qual delas funcionou."
        />
        <p className="mt-4 text-lg font-semibold text-balance text-ink">
          {review.recommendation.title}
        </p>
        <p className="mt-2 text-pretty text-ink-muted">{review.recommendation.detail}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => composer.open('acao')}>
            <Icon name="mais" className="size-4" />
            Planejar a próxima ação
          </Button>
          {review.recommendation.action === 'ajustar-prazo' ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/metas')}>
              <Icon name="calendario" className="size-4" />
              Rever prazos
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel aria-labelledby="objetivos-review-titulo">
        <PanelHeader
          id="objetivos-review-titulo"
          title="Os objetivos depois dessa semana"
          icon="trofeu"
        />
        {planner.objectiveProgress.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nenhum objetivo com prazo"
              description="A review compara o que você fez com o que você queria chegar. Sem objetivo, sobra só o número solto."
              action={
                <Button size="sm" onClick={() => composer.open('objetivo')}>
                  <Icon name="mais" className="size-4" />
                  Definir objetivo
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {planner.objectiveProgress.map((progress) => (
              <ObjectiveRow key={progress.objective.id} progress={progress} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function PointList({
  title,
  icon,
  tone,
  points,
  empty,
}: {
  readonly title: string
  readonly icon: 'adiar' | 'trofeu'
  readonly tone: 'warn' | 'positive'
  readonly points: readonly ReviewPoint[]
  readonly empty: string
}) {
  return (
    <Panel aria-label={title}>
      <PanelHeader title={title} icon={icon} />

      {points.length === 0 ? (
        <p className="mt-4 text-sm text-pretty text-ink-faint">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {points.map((point) => (
            <li
              key={point.id}
              className={cn(
                'rounded-xl border-l-2 bg-surface-hi/50 py-3 pr-3.5 pl-3',
                tone === 'warn' ? 'border-l-flame' : 'border-l-positive',
              )}
            >
              <p className="text-sm font-medium text-ink">{point.title}</p>
              <p className="mt-1 text-sm text-pretty text-ink-muted">{point.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
