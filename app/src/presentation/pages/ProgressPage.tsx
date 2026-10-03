import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AiProgressPanel } from '@/presentation/ai/AiProgressPanel'
import { useAi } from '@/presentation/ai/use-ai'
import { Eyebrow } from '@/presentation/components/ds/Card'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useProgress } from '@/presentation/planner/use-progress'
import {
  ConsistencyCard,
  NoticedSection,
  RecordCard,
  RecoveryRateCard,
  TelemetryScoreCard,
  WeekCard,
  type PatternInsight,
} from '@/presentation/progress/ProgressCards'
import { useTelemetry } from '@/presentation/progress/use-telemetry'

/**
 * Progresso: o cockpit. Ao terminar de rolar a pessoa sabe como está, se está
 * evoluindo, a constância, o padrão, as quedas, a volta e o próximo recorde,
 * sem ler um relatório. Cada card é um número ou um desenho; texto só onde o
 * número sozinho não diz o que fazer.
 */
export function ProgressPage() {
  const planner = usePlanner()
  const progress = useProgress()
  const telemetry = useTelemetry()
  const evolution = useEvolution()
  const ai = useAi()

  const insights = useMemo<PatternInsight[]>(() => {
    const list: PatternInsight[] = []
    const { peak, bestDay } = telemetry

    if (peak) {
      list.push({
        id: 'pico',
        icon: peak.startHour < 12 ? 'sol' : peak.startHour < 18 ? 'relogio' : 'lua',
        title: peak.startHour < 12 ? 'Pico Matinal' : peak.startHour < 18 ? 'Pico da Tarde' : 'Pico Noturno',
        body: (
          <>
            Você conclui <strong className="font-semibold text-ink">{liftLabel(peak.lift)} mais tarefas e hábitos</strong>{' '}
            entre as {hour(peak.startHour)} e as {hour(peak.endHour)}.
          </>
        ),
        cta: 'Aproveite para foco profundo',
      })
    }

    if (bestDay) {
      list.push({
        id: 'melhor-dia',
        icon: 'raio',
        title: 'Melhor Dia',
        body: (
          <>
            <strong className="font-semibold text-ink">{bestDay.name}</strong> é o seu dia de maior momentum: rende{' '}
            {liftLabel(bestDay.lift)} acima dos outros.
          </>
        ),
        cta: 'Ritmo exemplar',
      })
    }

    if (progress.nextAdjustment) {
      list.push({
        id: progress.nextAdjustment.id,
        icon: 'ia',
        title: progress.nextAdjustment.title,
        body: progress.nextAdjustment.recommendation,
        cta: progress.nextAdjustment.actionLabel,
      })
    }

    return list
  }, [telemetry, progress.nextAdjustment])

  if (planner.loading) return <DashboardSkeleton mobile />

  const level = evolution.summary.progress
  const metrics = planner.limits.metrics

  return (
    <div className="flex flex-col gap-6 pb-2">
      {planner.error ? <ErrorNote message={planner.error} onRetry={() => void planner.reload()} /> : null}

      <header className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <Eyebrow dot>Cockpit telemetria</Eyebrow>
          <h2 className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight text-ink">Evolução Pessoal</h2>
        </div>
        <StatusTag className="mb-1">{planner.online ? (planner.syncing ? 'Sincronizando' : 'Sincronizado') : 'Offline'}</StatusTag>
      </header>

      <TelemetryScoreCard
        momentum={progress.momentum}
        levelLabel={`Nível ${level.level} ${level.name}`}
        factors={progress.factors}
        detailed={planner.limits.momentumDetail}
      />

      <WeekCard week={telemetry.week} streak={planner.streak} />

      {metrics ? <ConsistencyCard map={telemetry.map} /> : null}

      <RecoveryRateCard recovery={telemetry.recovery} />

      <NoticedSection insights={insights} locked={!metrics} />

      <RecordCard streak={planner.streak} />

      {ai.enabled ? <AiProgressPanel ai={ai} /> : null}

      <nav aria-label="Mais leituras" className="grid grid-cols-2 gap-3">
        <MoreLink to="/app/review" icon="calendarioGrade" label="Review semanal" />
        <MoreLink to="/app/evolucao" icon="estrela" label="XP e conquistas" />
      </nav>
    </div>
  )
}

function MoreLink({ to, icon, label }: { readonly to: string; readonly icon: 'calendarioGrade' | 'estrela'; readonly label: string }) {
  return (
    <Link to={to} className="card press flex min-h-14 items-center gap-2.5 rounded-[1.4rem] px-4 text-sm font-medium text-ink">
      <Icon name={icon} className="size-5 text-brand-hi" />
      {label}
    </Link>
  )
}

/** Até o dobro, em porcentagem ("38%"); acima disso, em vezes ("6,2x"), que é como se lê. */
function liftLabel(lift: number): string {
  if (lift < 1) return `${Math.round(lift * 100)}%`
  return `${(lift + 1).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`
}

function hour(value: number): string {
  return `${String(value).padStart(2, '0')}h`
}
