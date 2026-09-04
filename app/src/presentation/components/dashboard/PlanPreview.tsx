import type { ReactNode } from 'react'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { daysBetween, type DayKey } from '@/domain/entities/day'
import type { Feasibility, PlanDraft } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

const FEASIBILITY_TONE: Readonly<Record<Feasibility, 'positive' | 'warn'>> = {
  confortavel: 'positive',
  exigente: 'warn',
  irreal: 'warn',
}

const FEASIBILITY_LABEL: Readonly<Record<Feasibility, string>> = {
  confortavel: 'Cabe na rotina',
  exigente: 'Exigente',
  irreal: 'Não cabe',
}

interface PlanPreviewProps {
  readonly plan: PlanDraft
  readonly today: DayKey
  /** Recebe o prazo sustentável em dias, pra quem oferece o botão de ajuste. */
  readonly onUseSuggestedDeadline?: (days: number) => void
}

/**
 * O plano na tela.
 *
 * Mostra a conta antes do resultado: quem entende de onde saiu o número do
 * hábito cumpre o hábito; quem recebe número pronto, abandona. É o mesmo bloco
 * no onboarding e na criação de um objetivo novo — o plano precisa ter sempre
 * a mesma cara, senão ele parece dois produtos diferentes.
 */
export function PlanPreview({ plan, today, onUseSuggestedDeadline }: PlanPreviewProps) {
  const type = activityType(plan.objective.axis)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={FEASIBILITY_TONE[plan.feasibility]}>{FEASIBILITY_LABEL[plan.feasibility]}</Tag>
        <Tag color={type.colorToken}>{type.label}</Tag>
        <Tag>{plan.sessionsPerWeek === 7 ? 'Todo dia' : `${plan.sessionsPerWeek}x por semana`}</Tag>
      </div>

      <p className="text-sm text-pretty text-ink-muted">{plan.rationale}</p>

      {plan.warning ? (
        <div
          role="note"
          className="flex flex-col gap-3 rounded-card border border-flame/30 bg-flame-dim/40 px-4 py-3"
        >
          <p className="text-sm text-pretty text-ink">{plan.warning}</p>
          {plan.suggestedDeadline && onUseSuggestedDeadline ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const suggested = plan.suggestedDeadline
                  if (suggested) onUseSuggestedDeadline(daysBetween(today, suggested) + 1)
                }}
              >
                <Icon name="calendario" className="size-4" />
                Usar o prazo que cabe
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <PlanBlock title="O hábito que sustenta" icon="habitos">
        {plan.habits.map((habit) => (
          <li key={habit.name} className="flex items-center gap-3 py-2">
            <HabitGlyph icon={habit.icon} className="size-5 shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1 text-sm text-ink">{habit.name}</span>
            <span className="shrink-0 text-xs text-ink-faint">
              {formatUnit(activityType(habit.axis), habit.target)}
            </span>
          </li>
        ))}
      </PlanBlock>

      <PlanBlock title="As primeiras ações" icon="jornada">
        {plan.tasks.map((task) => (
          <li key={task.title} className="flex items-start gap-3 py-2">
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                task.isMainPriority ? 'bg-brand' : 'bg-line-hi',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{task.title}</span>
              <span className="block text-xs text-ink-faint">
                {task.day === today ? 'Hoje' : 'Mais pra frente'}
                {task.isMainPriority ? ' · prioridade principal' : ''}
              </span>
            </span>
          </li>
        ))}
      </PlanBlock>

      <p className="text-xs text-pretty text-ink-faint">
        O ritmo semanal ({formatUnit(type, plan.goal.target)} por semana) entra como meta e passa a
        contar no teu progresso a partir de hoje.
      </p>
    </div>
  )
}

function PlanBlock({
  title,
  icon,
  children,
}: {
  readonly title: string
  readonly icon: 'habitos' | 'jornada'
  readonly children: ReactNode
}) {
  return (
    <div className="rounded-card border border-line bg-surface/60 px-4 py-3">
      <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        <Icon name={icon} className="size-4 text-ink-faint" />
        {title}
      </h4>
      <ul className="mt-1 divide-y divide-line/60">{children}</ul>
    </div>
  )
}
