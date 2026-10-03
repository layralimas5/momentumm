import { useState } from 'react'
import { addDays, dayKeyOf, startOfMonth } from '@/domain/entities/day'
import { OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { planRatioAt } from '@/domain/entities/plan-progress'
import { AiEntryLink } from '@/presentation/ai/AiBits'
import { Card, Eyebrow, SectionHeader } from '@/presentation/components/ds/Card'
import { GoalCard, MilestoneTimeline, type GoalCardData } from '@/presentation/components/ds/GoalCard'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { ObjectivesEmpty } from '@/presentation/components/objective/ObjectivesEmpty'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useObjectives, type ObjectiveView } from '@/presentation/planner/use-objectives'
import { PeriodPlanCard } from '@/presentation/objectives/PeriodPlanCard'
import { usePlanner } from '@/presentation/planner/use-planner'

const PRIORITY_RANK = { alta: 0, media: 1, baixa: 2 } as const

/**
 * Objetivos como jornadas, não projetos: o principal em destaque com os marcos
 * e o que está ligado a ele; os outros em cards curtos.
 */
export function ObjectivesPage() {
  const planner = usePlanner()
  const views = useObjectives()
  const composer = useComposer()
  const limit = planner.usage.objectives

  if (planner.loading && views.length === 0) return <DashboardSkeleton mobile />

  const running = views
    .filter((view) => view.progress.state === 'em-andamento' || view.progress.state === 'nao-iniciado')
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.progress.objective.priority] - PRIORITY_RANK[b.progress.objective.priority] ||
        a.progress.daysLeft - b.progress.daysLeft,
    )
  const paused = views.filter((view) => view.progress.state === 'pausado')
  const done = views.filter((view) => view.progress.state === 'concluido')
  const [main, ...others] = running

  const monthGainOf = (view: ObjectiveView): number | null => {
    if (!view.plan.hasPlan) return null
    const before = planRatioAt(view.plan.stages, addDays(startOfMonth(planner.today), -1), dayKeyOf)
    return Math.round((view.ratio - before) * 100)
  }

  const toCard = (view: ObjectiveView): GoalCardData => {
    const { progress, plan } = view
    const finished = progress.state === 'concluido'
    return {
      id: progress.objective.id,
      title: progress.objective.title,
      ratio: view.ratio,
      monthGain: finished ? null : monthGainOf(view),
      daysLeft: finished || progress.state === 'pausado' ? null : progress.daysLeft,
      nextMilestone: finished ? null : (plan.currentStage?.stage.title ?? null),
      alert:
        finished || progress.state === 'pausado'
          ? null
          : view.stalled
            ? 'Parado há 1 semana'
            : progress.status === 'atrasado' || progress.status === 'vencido'
              ? OBJECTIVE_STATUS_LABELS[progress.status]
              : null,
      dimmed: finished || progress.state === 'pausado',
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-2">
      {planner.error ? <ErrorNote message={planner.error} onRetry={() => void planner.reload()} /> : null}

      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[1.75rem] leading-tight font-bold tracking-tight text-ink">Objetivos</h2>
          <p className="mt-0.5 text-sm text-ink-faint tabular">
            {running.length} {running.length === 1 ? 'ativo' : 'ativos'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => composer.open('objetivo')}
          disabled={limit.reached}
          className="press flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-[var(--shadow-cta)] disabled:opacity-50"
        >
          <Icon name="mais" className="size-4" strokeWidth={2.5} />
          Novo
        </button>
      </header>

      {limit.reached && limit.message ? <UpgradeHint message={limit.message} /> : null}

      {views.length === 0 ? (
        <ObjectivesEmpty onCreate={() => composer.open('objetivo')} />
      ) : null}

      {main ? <MainObjective view={main} card={toCard(main)} /> : null}

      {others.length > 0 ? (
        <section aria-labelledby="outros-objetivos" className="flex flex-col gap-3">
          <SectionHeader id="outros-objetivos" title="Em andamento" caps />
          <ul className="flex flex-col gap-3">
            {others.map((view) => (
              <li key={view.progress.objective.id}>
                <GoalWithPlan view={view} card={toCard(view)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {planner.limits.ai && !limit.reached ? (
        <AiEntryLink enabled label="Criar plano com IA" to="/app/ia?funcao=plano" />
      ) : null}

      {paused.length > 0 ? (
        <section aria-labelledby="pausados" className="flex flex-col gap-3">
          <SectionHeader id="pausados" title="Pausados" caps aside="Não cobram o dia" />
          <ul className="flex flex-col gap-3">
            {paused.map((view) => (
              <li key={view.progress.objective.id}>
                <GoalCard goal={toCard(view)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section aria-labelledby="concluidos" className="flex flex-col gap-3">
          <SectionHeader id="concluidos" title={`Concluídos (${done.length})`} caps />
          <ul className="flex flex-col gap-3">
            {done.map((view) => (
              <li key={view.progress.objective.id}>
                <GoalCard goal={toCard(view)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/** O objetivo principal: o card, os marcos e a corrente que liga o dia a ele. */
function MainObjective({ view, card }: { readonly view: ObjectiveView; readonly card: GoalCardData }) {
  const links = [
    ...view.habits.slice(0, 2).map((entry) => ({ key: `h-${entry.habit.id}`, icon: 'habitos' as const, label: entry.habit.name })),
    ...(view.nextTask ? [{ key: `t-${view.nextTask.id}`, icon: 'raio' as const, label: view.nextTask.title }] : []),
  ]

  return (
    <section aria-label="Objetivo principal" className="flex flex-col gap-3">
      <Eyebrow dot className="px-1">
        Objetivo principal
      </Eyebrow>
      <GoalCard goal={card} featured />

      {view.plan.stages.length > 0 ? (
        <Card aria-labelledby="marcos">
          <h3 id="marcos" className="eyebrow mb-4 text-[0.72rem] text-ink-muted">
            Marcos
          </h3>
          <MilestoneTimeline stages={view.plan.stages} />
        </Card>
      ) : null}

      <PeriodPlanCard view={view} />

      {links.length > 0 ? (
        <Card aria-labelledby="conectado">
          <h3 id="conectado" className="eyebrow text-[0.72rem] text-ink-muted">
            O que move este objetivo
          </h3>
          <ol className="mt-4 flex flex-col items-start">
            <li className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="bussola" className="size-4 text-brand-hi" />
              {card.title}
            </li>
            {links.map((link) => (
              <li key={link.key} className="flex flex-col items-start">
                <Icon name="descer" className="my-1 ml-0.5 size-3.5 text-ink-faint" />
                <span className="well flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-ink-muted">
                  <Icon name={link.icon} className="size-4 text-brand-hi" />
                  {link.label}
                </span>
              </li>
            ))}
            {card.monthGain !== null && card.monthGain > 0 ? (
              <li className="flex flex-col items-start">
                <Icon name="descer" className="my-1 ml-0.5 size-3.5 text-ink-faint" />
                <span className="text-sm font-semibold text-brand-hi tabular">+{card.monthGain}% de progresso no mês</span>
              </li>
            ) : null}
          </ol>
        </Card>
      ) : null}
    </section>
  )
}

/** Objetivo secundário: o card e, sob demanda, o plano por período dele. */
function GoalWithPlan({ view, card }: { readonly view: ObjectiveView; readonly card: GoalCardData }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <GoalCard goal={card} />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-1 self-start px-2 text-sm font-medium text-brand-hi"
      >
        {open ? 'Fechar plano' : 'Ver plano por período'}
        <Icon name={open ? 'acima' : 'abaixo'} className="size-4" />
      </button>
      {open ? <PeriodPlanCard view={view} /> : null}
    </div>
  )
}
