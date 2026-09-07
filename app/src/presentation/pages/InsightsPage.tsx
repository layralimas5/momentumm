import { useMemo } from 'react'
import { generateInsights, type InsightInput } from '@/domain/entities/insight'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { WeeklyProgressCard } from '@/presentation/components/dashboard/WeeklyProgressCard'
import { momentumEvent } from '@/domain/share/journey-event-builders'
import { useAuth } from '@/presentation/auth/use-auth'
import { ShareButton } from '@/presentation/share/ShareButton'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PageHeader } from './PageHeader'

/**
 * Insights.
 *
 * No dashboard aparece um por vez pra não virar ruído; aqui a pessoa vê todos
 * os padrões que os dados dela sustentam hoje. Nenhum é genérico: se a regra
 * não encontrou padrão, ela não escreve nada.
 */
export function InsightsPage() {
  const { user } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()

  const insights = useMemo(() => {
    const input: InsightInput = {
      activities: planner.activities,
      habits: planner.habits,
      habitLogs: planner.habitLogs,
      tasks: planner.tasks,
      checkIns: planner.checkIns,
      streak: planner.streak,
      momentum: view.momentum,
      capacity: view.capacity,
      today: planner.today,
    }
    const all = generateInsights(input)
    return planner.limits.insightsPerDay === Number.POSITIVE_INFINITY
      ? all
      : all.slice(0, planner.limits.insightsPerDay)
  }, [planner, view.momentum, view.capacity])

  const total = insights.length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Insights"
        description="O que os seus próprios registros mostram sobre o jeito que você avança e o jeito que você trava."
        action={
          user && view.hasHistory ? (
            <ShareButton
              label="Compartilhar Momentum"
              build={() =>
                momentumEvent({
                  userId: user.id,
                  today: planner.today,
                  momentum: view.momentum,
                  streakDays: planner.streak.current,
                })
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {total === 0 ? (
            <EmptyState
              title="Ainda não há padrão suficiente"
              description="Os insights nascem de contagem real, não de frase pronta. Alguns dias de registro e eles começam a aparecer."
            />
          ) : (
            insights.map((insight) => (
              <Panel key={insight.id} aria-label={insight.title}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-balance text-ink">{insight.title}</h3>
                  <Tag tone="brand">Análise do Momentumm</Tag>
                </div>

                <p className="mt-2.5 text-sm text-ink-muted">
                  <span className="text-ink-faint">Por quê: </span>
                  {insight.reason}
                </p>

                <p className="mt-3 flex gap-2.5 rounded-xl border border-line bg-surface-hi/50 px-3.5 py-3 text-sm text-ink">
                  <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
                  <span>{insight.recommendation}</span>
                </p>
              </Panel>
            ))
          )}

          {planner.limits.insightsPerDay === Number.POSITIVE_INFINITY ? null : (
            <UpgradeHint message="O plano gratuito mostra um insight por vez. No PRO todos ficam abertos, com histórico completo." />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <WeeklyProgressCard week={view.week} limits={planner.limits} />

          <Panel aria-labelledby="composicao-titulo">
            <PanelHeader
              id="composicao-titulo"
              title="Como seu momentum é formado"
              icon="insights"
              hint="Constância pesa mais que volume: sete dias de dez minutos valem mais que um dia de duas horas."
            />

            <dl className="mt-4 flex flex-col gap-3">
              <Part label="Constância" value={view.momentum.parts.consistency} />
              <Part label="Hábitos" value={view.momentum.parts.habits} />
              <Part label="Prioridades" value={view.momentum.parts.priorities} />
              <Part label="Volume" value={view.momentum.parts.volume} />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Part({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100)
  return (
    <div className="flex items-center gap-3">
      <dt className="w-28 shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="flex flex-1 items-center gap-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-top">
          <span
            className="block h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="tabular w-10 shrink-0 text-right text-sm text-ink-faint">{percent}%</span>
      </dd>
    </div>
  )
}
