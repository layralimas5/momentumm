import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MomentumFactor, MomentumScore } from '@/domain/entities/momentum'
import type { ConsistencyMap, CurrentWeek, RecoveryRate } from '@/domain/entities/rhythm'
import type { Streak } from '@/domain/entities/streak'
import { Card, Eyebrow, IconWell, SectionHeader } from '@/presentation/components/ds/Card'
import { AreaChart, Heatmap, HeatLegend } from '@/presentation/components/ds/Charts'
import { FilterPills, SoftButton } from '@/presentation/components/ds/Controls'
import { ProgressBar } from '@/presentation/components/ds/Progress'
import { ProLock } from '@/presentation/components/ds/ProLock'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { DeltaChip, ScoreNumber } from '@/presentation/today/MomentumScoreCard'
import { cn } from '@/shared/lib/cn'
import { PERIODS, useMomentumCurve, type Period } from './use-telemetry'

export function TelemetryScoreCard({
  momentum,
  levelLabel,
  factors,
  detailed,
}: {
  readonly momentum: MomentumScore
  readonly levelLabel: string
  readonly factors: readonly MomentumFactor[]
  /** O gratuito vê o número de hoje; curva e fatores são do PRO. */
  readonly detailed: boolean
}) {
  const [period, setPeriod] = useState<Period>('30d')
  const [analysis, setAnalysis] = useState(false)
  const curve = useMomentumCurve(period)

  return (
    <Card aria-labelledby="telemetria-score">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="telemetria-score" className="eyebrow text-[0.72rem] text-ink-muted">
            Momentum Score
          </h2>
          <ScoreNumber value={momentum.value} className="mt-2" />
        </div>
        <div className="flex flex-col items-end gap-1.5 pt-0.5">
          {momentum.hasEnoughData ? <DeltaChip delta={momentum.delta} /> : null}
          <span className="text-xs text-ink-faint">{levelLabel}</span>
        </div>
      </div>

      {detailed ? (
        <>
          <FilterPills
            variant="segment"
            label="Período do gráfico"
            options={PERIODS.map((entry) => ({ value: entry.value, label: entry.label }))}
            value={period}
            onChange={setPeriod}
            className="mt-5"
          />
          <AreaChart
            values={curve.values}
            ticks={curve.ticks}
            label={`Evolução do Momentum Score no período: de ${curve.values[0] ?? 0} a ${curve.values[curve.values.length - 1] ?? 0}`}
            className="mt-4"
          />
          <button
            type="button"
            onClick={() => setAnalysis((value) => !value)}
            aria-expanded={analysis}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-hi"
          >
            {analysis ? 'Fechar análise' : 'Ver análise'}
            <Icon name={analysis ? 'acima' : 'abaixo'} className="size-4" />
          </button>
          {analysis ? (
            <ul className="mt-3 flex flex-col gap-3">
              {factors.map((factor) => (
                <li key={factor.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-ink-muted">{factor.label}</span>
                    <span className="font-semibold text-ink tabular">
                      {factor.points}
                      <span className="font-normal text-ink-faint">/{factor.maxPoints}</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={factor.maxPoints === 0 ? 0 : factor.points / factor.maxPoints}
                    label={`${factor.label}: ${factor.points} de ${factor.maxPoints}`}
                    size="sm"
                    className="mt-1.5"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <ProLock message="A curva do score em 7 dias, 30 dias, 3 meses e 1 ano." className="mt-5" />
      )}
    </Card>
  )
}

export function WeekCard({ week, streak }: { readonly week: CurrentWeek; readonly streak: Streak }) {
  const ratio = week.elapsed === 0 ? 0 : week.consistent / 7

  return (
    <Card aria-labelledby="esta-semana">
      <div className="flex items-center justify-between gap-3">
        <h2 id="esta-semana" className="flex items-center gap-2 text-base font-semibold text-ink">
          <Icon name="calendarioGrade" className="size-5 text-brand-hi" />
          Esta Semana
        </h2>
        <span className="flex items-center gap-1 text-sm font-semibold text-brand-hi tabular">
          <Icon name="fogo" className="size-4" strokeWidth={2} />
          Sequência: {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
        </span>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {week.days.map((day) => (
          <li
            key={day.day}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl py-2.5',
              day.future ? 'well opacity-70' : 'chip',
              day.isToday && 'ring-2 ring-brand/35',
            )}
          >
            <span className={cn('text-[0.62rem] font-semibold', day.isToday ? 'text-brand-hi' : 'text-ink-faint')}>
              {day.label}
            </span>
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full',
                day.done ? 'bg-brand text-white' : 'well',
              )}
            >
              {day.done ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : null}
              <span className="sr-only">{day.done ? 'consistente' : day.future ? 'ainda não chegou' : 'sem movimento'}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm tabular">
        <span className="text-ink-muted">
          {week.consistent} de 7 dias consistentes
        </span>
        <span className="font-semibold text-ink">{Math.round(ratio * 100)}% de meta semanal</span>
      </div>
    </Card>
  )
}

export function ConsistencyCard({ map }: { readonly map: ConsistencyMap }) {
  const navigate = useNavigate()
  const pct = Math.round(map.presence * 100)

  return (
    <Card aria-labelledby="consistencia">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="consistencia" className="text-base font-semibold text-ink">
            Consistência Histórica
          </h2>
          <p className="mt-0.5 text-sm font-medium text-brand-hi tabular">
            {pct}% de presença nos últimos {map.totalDays} dias
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/jornada')}
          className="chip press grid size-10 shrink-0 place-items-center rounded-full text-brand-hi"
        >
          <Icon name="grade" className="size-4" />
          <span className="sr-only">Ver tudo, dia a dia</span>
        </button>
      </div>
      <div className="mt-4">
        <Heatmap
          weeks={map.weeks}
          label={`${map.activeDays} dias com movimento nos últimos ${map.totalDays}`}
        />
      </div>
      <div className="mt-3">
        <HeatLegend />
      </div>
    </Card>
  )
}

export function RecoveryRateCard({ recovery }: { readonly recovery: RecoveryRate }) {
  const pct = recovery.rate === null ? null : Math.round(recovery.rate * 100)
  const title =
    recovery.rate === null
      ? 'Nenhuma quebra no mês'
      : recovery.rate === 1
        ? 'Recovery Rate Impecável'
        : recovery.rate >= 0.5
          ? 'Você costuma voltar'
          : 'A volta é o próximo passo'

  const message =
    recovery.rate === null
      ? 'Nos últimos 30 dias você não ficou dois dias seguidos parado.'
      : recovery.comebacks === recovery.interruptions
        ? `Você saiu da rotina ${times(recovery.interruptions)} este mês e voltou ${recovery.comebacks === 1 ? 'nessa vez' : `todas as ${recovery.comebacks} vezes`}.`
        : `Você saiu da rotina ${times(recovery.interruptions)} este mês e voltou ${times(recovery.comebacks)}.`

  return (
    <Card aria-labelledby="recovery-rate">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Métrica de resiliência</Eyebrow>
          <h2 id="recovery-rate" className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
        </div>
        <span className="well shrink-0 rounded-2xl px-3.5 py-2 text-2xl font-bold text-brand-hi tabular">
          {pct === null ? '—' : `${pct}%`}
        </span>
      </div>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-pretty text-ink-muted">{message}</p>
      <div className="card-float mt-4 flex items-center gap-3 rounded-2xl px-4 py-3.5">
        <Icon name="lotus" className="size-5 shrink-0 text-brand-hi" />
        <p className="text-[0.95rem] text-ink italic">“Você não precisa de perfeição. Você sempre volta.”</p>
      </div>
    </Card>
  )
}

function times(count: number): string {
  return count === 1 ? '1 vez' : `${count} vezes`
}

export interface PatternInsight {
  readonly id: string
  readonly icon: IconName
  readonly title: string
  readonly body: ReactNode
  readonly cta: string
}

export function NoticedSection({ insights, locked }: { readonly insights: readonly PatternInsight[]; readonly locked: boolean }) {
  return (
    <section aria-labelledby="percebeu" className="flex flex-col gap-3">
      <SectionHeader
        id="percebeu"
        title="Momentumm Percebeu"
        icon="lampada"
        aside={
          locked || insights.length === 0
            ? null
            : `${insights.length} ${insights.length === 1 ? 'novo insight' : 'novos insights'}`
        }
      />
      {locked ? (
        <ProLock message="Os padrões do teu ritmo: horário de pico, melhor dia e o que mais puxa a tua execução." />
      ) : insights.length === 0 ? (
        <p className="well rounded-[1.4rem] px-4 py-5 text-sm text-pretty text-ink-muted">
          Ainda sem padrão claro. Com mais duas semanas de registros o Momentumm começa a perceber o teu ritmo.
        </p>
      ) : (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:-mx-6 sm:px-6">
          {insights.map((insight) => (
            <li key={insight.id} className="card w-[78%] max-w-xs shrink-0 snap-start p-5">
              <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                <Icon name={insight.icon} className="size-5 text-brand-hi" />
                {insight.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-pretty text-ink-muted">{insight.body}</p>
              <p className="mt-4 text-xs font-semibold text-brand-hi">{insight.cta}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function RecordCard({ streak }: { readonly streak: Streak }) {
  const navigate = useNavigate()
  const record = Math.max(streak.record, streak.current)
  const atRecord = streak.current > 0 && streak.current >= record
  const left = Math.max(0, record - streak.current)
  const ratio = record === 0 ? 0 : Math.min(1, streak.current / record)

  return (
    <Card aria-labelledby="proximo-nivel">
      <div className="flex items-start gap-3">
        <IconWell name="trofeu" />
        <div className="min-w-0">
          <h2 id="proximo-nivel" className="eyebrow text-[0.75rem] text-ink">
            Próximo nível histórico
          </h2>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-pretty text-ink-muted">
            {record === 0 ? (
              'Comece hoje: o primeiro dia já é o seu recorde.'
            ) : atRecord ? (
              <>Você está no seu recorde de sequência. Cada dia a partir de agora é inédito.</>
            ) : (
              <>
                Você está a <strong className="font-semibold text-brand-hi">{left} {left === 1 ? 'dia' : 'dias'}</strong> de
                superar seu recorde histórico de sequência ({record} dias).
              </>
            )}
          </p>
        </div>
      </div>

      {record > 0 ? (
        <>
          <div className="mt-4 flex items-center justify-between text-sm tabular">
            <span className="text-ink-muted">
              Dia {streak.current} de {record}
            </span>
            <span className="font-semibold text-brand-hi">{Math.round(ratio * 100)}%</span>
          </div>
          <ProgressBar value={ratio} label={`Sequência: ${streak.current} de ${record} dias`} className="mt-2" />
        </>
      ) : null}

      <SoftButton onClick={() => navigate('/app/configuracoes#lembretes')} className="mt-5 text-[0.8rem] uppercase tracking-[0.06em]">
        <Icon name="sino" className="size-4" />
        Definir lembrete de proteção
      </SoftButton>
    </Card>
  )
}
