import { Link } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { dayKeyToDate } from '@/domain/entities/day'
import { MOMENTUM_LEVEL_LABELS, type DayDot, type MomentumFactor } from '@/domain/entities/momentum'
import { deltaLabel } from '@/domain/entities/week'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useProgress, type PeriodTotals, type Rate } from '@/presentation/planner/use-progress'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * Progresso.
 *
 * O número existe pra virar decisão. Por isso o Momentum aparece aberto em
 * fatores logo abaixo do total: um score fechado é um oráculo, e ninguém muda
 * de comportamento por causa de um oráculo.
 */
export function ProgressPage() {
  const planner = usePlanner()
  const progress = useProgress()

  const hasData = planner.activities.length > 0 || planner.habitLogs.length > 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Progresso"
        description="Onde você está evoluindo, onde está perdendo constância e qual é o próximo ajuste."
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}

      {planner.loading && !hasData ? (
        <LoadingBlock label="Calculando o progresso" />
      ) : !hasData ? (
        <EmptyState
          title="Ainda não há o que medir"
          description="O progresso começa a contar história no primeiro registro. Marca um hábito ou conclui uma ação e volta aqui."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel tone="brand" className="xl:col-span-2">
            <PanelHeader title="Momentum" icon="raio" />

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="tabular text-5xl font-semibold tracking-tight text-ink">
                  {progress.momentum.value}
                  <span className="text-2xl text-ink-faint">/100</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag tone="brand">{MOMENTUM_LEVEL_LABELS[progress.momentum.level]}</Tag>
                  <Tag tone={progress.momentum.delta >= 0 ? 'positive' : 'neutral'}>
                    {progress.momentum.delta > 0 ? '+' : ''}
                    {progress.momentum.delta} vs. semana anterior
                  </Tag>
                </div>
              </div>

              <p className="max-w-md text-pretty text-sm text-ink-muted">
                {progress.momentum.explanation}
              </p>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
                De onde vieram os pontos
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {progress.factors.map((factor) => (
                  <FactorBar
                    key={factor.key}
                    factor={factor}
                    weakest={progress.weakest?.key === factor.key}
                  />
                ))}
              </ul>

              {progress.weakest ? (
                <p className="mt-4 text-sm text-ink-muted">
                  <span className="text-ink-faint">Onde há mais espaço: </span>
                  {progress.weakest.label.toLowerCase()}, com{' '}
                  {progress.weakest.maxPoints - progress.weakest.points} pontos na mesa.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Últimos 7 dias"
              icon="progresso"
              hint={progress.week.conclusion}
            />
            <WeekChart series={progress.series} />
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
              <Stat
                label="Dias ativos"
                value={`${progress.last7.activeDays}/7`}
                hint={deltaLabel(
                  progress.week.current.activeDays,
                  progress.week.previous.activeDays,
                  'dias',
                )}
              />
              <Stat
                label="Hábitos"
                value={rateText(progress.last7.habits)}
                hint={compareText(progress.last7.habits)}
              />
              <Stat
                label="Ações"
                value={rateText(progress.last7.tasks)}
                hint={compareText(progress.last7.tasks)}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Este mês" icon="calendario" />
            <div className="mt-4 flex flex-col gap-4">
              <PeriodBlock totals={progress.month} />
              <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                <Stat label="Objetivos ativos" value={String(progress.activeObjectives)} />
                <Stat label="Objetivos concluídos" value={String(progress.completedObjectives)} />
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Onde você avançou" icon="trofeu" />
            {progress.gains.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Ainda não há avanço mensurável nessa janela. Não é o mesmo que estar parado — é
                que uma semana é pouco pra mostrar tendência.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {progress.gains.map((gain) => (
                  <li key={gain} className="flex gap-2.5 text-sm text-ink-muted">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" />
                    <span className="text-pretty">{gain}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="O que precisa de atenção" icon="sino" />
            {progress.risks.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                Nada travado por aqui. Segue como está.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {progress.risks.map((risk) => (
                  <li key={risk} className="flex gap-2.5 text-sm text-ink-muted">
                    <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-flame" />
                    <span className="text-pretty">{risk}</span>
                  </li>
                ))}
              </ul>
            )}

            {progress.stalled.length > 0 ? (
              <Link
                to="/app/objetivos"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-ink transition-colors hover:text-brand-hi"
              >
                Rever objetivos parados
                <Icon name="seta" className="size-4" />
              </Link>
            ) : null}
          </Panel>

          {/*
            Objetivo por objetivo, com etapa, previsão e gargalo.

            Cada bloco responde as quatro perguntas da tela pro objetivo
            específico: onde estou, o que está travando, quando isso fecha e
            qual é o próximo passo. Uma barra sozinha responderia zero delas.
          */}
          <Panel className="xl:col-span-2">
            <PanelHeader
              title="Objetivos"
              icon="objetivo"
              hint="Onde cada um está, o que está travando e quando fecha no ritmo atual."
            />
            {progress.objectives.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">Nenhum objetivo criado ainda.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-5">
                {progress.objectives.map((view) => {
                  const axis = activityType(view.progress.objective.axis)
                  const objective = view.progress.objective

                  return (
                    <li
                      key={objective.id}
                      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-hi/40 p-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          to={`/app/objetivos/${objective.id}`}
                          className="truncate text-sm font-medium text-ink transition-colors hover:text-brand-ink"
                        >
                          {objective.title}
                        </Link>
                        <span className="tabular shrink-0 text-sm text-ink-muted">
                          {Math.round(view.ratio * 100)}%
                        </span>
                      </div>

                      <ProgressBar
                        value={view.ratio}
                        label={`Progresso de ${objective.title}`}
                        color={axis.colorToken}
                      />

                      {/* As etapas em miniatura: é a leitura que mostra ONDE o
                          progresso está preso, e não só que ele está. */}
                      {view.plan.hasPlan ? (
                        <ul className="mt-1 flex flex-col gap-1.5">
                          {view.plan.stages.map((stage) => (
                            <li key={stage.stage.id} className="flex items-center gap-2.5">
                              <span className="w-28 shrink-0 truncate text-xs text-ink-muted">
                                {stage.stage.title}
                              </span>
                              <ProgressBar
                                className="flex-1"
                                value={stage.ratio}
                                label={`Etapa ${stage.stage.title} de ${objective.title}`}
                                color={
                                  view.plan.bottleneck?.stage.id === stage.stage.id
                                    ? 'var(--color-flame)'
                                    : axis.colorToken
                                }
                              />
                              <span className="tabular w-16 shrink-0 text-right text-xs text-ink-faint">
                                {stage.stage.weight}% · {Math.round(stage.ratio * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-ink-faint">
                          Sem etapas: a barra mede volume registrado, não execução.
                        </p>
                      )}

                      <p className="text-xs text-ink-faint">{view.forecast.message}</p>

                      <div className="flex flex-wrap items-center gap-2">
                        {view.plan.bottleneck ? (
                          <Tag tone="warn">Gargalo: {view.plan.bottleneck.stage.title}</Tag>
                        ) : null}
                        {view.plan.overdueCount > 0 ? (
                          <Tag tone="warn">
                            {view.plan.overdueCount}{' '}
                            {view.plan.overdueCount === 1 ? 'ação atrasada' : 'ações atrasadas'}
                          </Tag>
                        ) : null}
                        {view.plan.habits.length > 0 ? (
                          <Tag>
                            {view.plan.habits.length}{' '}
                            {view.plan.habits.length === 1 ? 'hábito de apoio' : 'hábitos de apoio'}
                          </Tag>
                        ) : null}
                      </div>

                      {view.plan.nextTask ? (
                        <p className="text-xs text-ink-muted">
                          <span className="text-ink-faint">Próxima ação: </span>
                          {view.plan.nextTask.title}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

function FactorBar({
  factor,
  weakest,
}: {
  readonly factor: MomentumFactor
  readonly weakest: boolean
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-xs', weakest ? 'text-flame' : 'text-ink-faint')}>
          {factor.label}
        </span>
        <span className="tabular text-xs text-ink-muted">
          {factor.points}/{factor.maxPoints}
        </span>
      </div>
      <ProgressBar
        className="mt-1.5"
        value={factor.value}
        label={`${factor.label}: ${factor.points} de ${factor.maxPoints} pontos`}
        color={weakest ? 'var(--color-flame)' : 'var(--color-brand)'}
      />
    </li>
  )
}

/**
 * A semana em barras. Sem eixo, sem grade e sem legenda: sete barras e os dias
 * embaixo já respondem "onde eu caí", e qualquer coisa além disso é decoração
 * que rouba espaço da leitura.
 */
function WeekChart({ series }: { readonly series: readonly DayDot[] }) {
  return (
    <ol className="mt-4 flex items-end gap-1.5" aria-label="Intensidade dos últimos 7 dias">
      {series.map((dot) => {
        const label = dayKeyToDate(dot.day).toLocaleDateString('pt-BR', { weekday: 'narrow' })
        const height = Math.max(4, Math.round(dot.intensity * 100))

        return (
          <li key={dot.day} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="flex h-24 w-full items-end">
              <span
                aria-hidden="true"
                className={cn(
                  'w-full rounded-t-md transition-[height] duration-500',
                  dot.intensity > 0 ? 'bg-brand' : 'bg-surface-top',
                )}
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="text-xs text-ink-faint">{label}</span>
            <span className="sr-only">
              {dot.day}: {dot.minutes} minutos, {dot.habitsDone} hábitos, {dot.tasksDone} ações
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function PeriodBlock({ totals }: { readonly totals: PeriodTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Dias ativos" value={`${totals.activeDays}/${totals.days}`} />
      <Stat label="Minutos" value={String(totals.minutes)} />
      <Stat label="Hábitos" value={rateText(totals.habits)} />
      <Stat label="Ações" value={rateText(totals.tasks)} />
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  readonly label: string
  readonly value: string
  readonly hint?: string | undefined
}) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

function rateText(rate: Rate): string {
  if (rate.total === 0) return '—'
  return `${Math.round(rate.ratio * 100)}%`
}

function compareText(rate: Rate): string | undefined {
  if (rate.total === 0) return undefined
  const delta = Math.round((rate.ratio - rate.previousRatio) * 100)
  if (delta === 0) return 'igual ao período anterior'
  return `${delta > 0 ? '+' : ''}${delta} pontos vs. anterior`
}
