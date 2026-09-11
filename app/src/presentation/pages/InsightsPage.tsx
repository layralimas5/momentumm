import { useMemo } from 'react'
import {
  generateInsights,
  type Insight,
  type InsightInput,
  type ObjectiveInsightInput,
} from '@/domain/entities/insight'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { MomentumBreakdown } from '@/presentation/components/dashboard/MomentumBreakdown'
import { WeeklyProgressCard } from '@/presentation/components/dashboard/WeeklyProgressCard'
import { momentumEvent } from '@/domain/share/journey-event-builders'
import { useAuth } from '@/presentation/auth/use-auth'
import { ShareButton } from '@/presentation/share/ShareButton'
import { useDashboard } from '@/presentation/planner/use-dashboard'
import { useInsightActions } from '@/presentation/planner/use-insight-actions'
import { ProGate } from '@/presentation/plan/ProGate'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { PageHeader } from './PageHeader'

/**
 * Insights.
 *
 * No dashboard aparece um por vez pra não virar ruído; aqui a pessoa vê todos
 * os padrões que os dados dela sustentam hoje. Nenhum é genérico: se a regra
 * não encontrou padrão, ela não escreve nada.
 *
 * Duas coisas que faltavam e são o motivo desta tela existir:
 *
 * 1. Ela recebe os OBJETIVOS com plano e previsão. Sem isso as oito regras que
 *    leem etapa, peso e prazo nunca disparavam aqui — justamente as que
 *    percebem que o plano parou de funcionar, que é a pergunta da tela.
 * 2. Cada leitura carrega a ação que resolve. Descrever o problema e deixar a
 *    execução pra pessoa é devolver o trabalho que o app deveria fazer.
 */
export function InsightsPage() {
  const { user } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()
  const actions = useInsightActions(view)

  const objectives = useMemo<ObjectiveInsightInput[]>(
    () => view.objectives.map((item) => ({ plan: item.plan, forecast: item.forecast })),
    [view.objectives],
  )

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
      objectives,
    }
    return generateInsights(input)
  }, [planner, view.momentum, view.capacity, objectives])

  const total = insights.length

  // As leituras cruzam padrões do histórico inteiro: é análise, e análise é o
  // PRO. A tela continua no mapa pra pessoa saber o que ela responde.
  if (!planner.limits.aiAnalysis) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="O que mudou no seu ritmo"
          description="Padrões, gargalos e o ajuste que cada um pede, lidos dos teus próprios registros."
        />
        <ProGate
          title="Leituras do ritmo"
          description="Etapa travando, constância caindo, dia maior que a tua capacidade: cada padrão aparece aqui com o botão que o resolve."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="O que mudou no seu ritmo"
        description="Cada leitura aqui nasce de uma contagem nos teus dados e vem com o ajuste que ela pede. Sem padrão detectado, o app não escreve nada."
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
              title="Nada saiu do lugar ainda"
              description="Por enquanto o teu plano está funcionando como foi montado. Quando algum padrão mudar — uma etapa travando, a constância caindo, o dia ficando maior que a tua capacidade — ele aparece aqui com o ajuste."
            />
          ) : (
            insights.map((insight) => (
              <InsightPanel key={insight.id} insight={insight} onApply={actions.apply} />
            ))
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <WeeklyProgressCard week={view.week} limits={planner.limits} />

          <Panel aria-labelledby="composicao-titulo">
            <PanelHeader
              id="composicao-titulo"
              title="Como seu momentum é formado"
              icon="insights"
              hint="Quatro fatores sobre os últimos 28 dias, com a última semana pesando o triplo."
            />

            <MomentumBreakdown momentum={view.momentum} className="mt-4" />
          </Panel>
        </div>
      </div>
    </div>
  )
}

/**
 * Uma leitura, com o ajuste que ela pede.
 *
 * O botão executa a MESMA operação que o dashboard executa — mesmo hook, mesma
 * escrita. Sem isso o app teria duas telas falando do mesmo padrão e só uma
 * capaz de resolver.
 *
 * Aqui nada é dispensado depois de aplicar: a leitura some quando o dado muda
 * e a regra deixa de casar, que é o único motivo honesto pra ela sumir.
 */
function InsightPanel({
  insight,
  onApply,
}: {
  readonly insight: Insight
  readonly onApply: (insight: Insight) => Promise<void>
}) {
  const apply = useAsyncAction(onApply)

  return (
    <Panel aria-label={insight.title}>
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

      {insight.action === 'nenhuma' ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" loading={apply.running} onClick={() => void apply.run(insight)}>
            {insight.actionLabel}
          </Button>
        </div>
      )}

      <div aria-live="polite" className="min-h-5">
        {apply.error ? <p className="mt-1 text-sm text-danger">{apply.error}</p> : null}
      </div>
    </Panel>
  )
}
