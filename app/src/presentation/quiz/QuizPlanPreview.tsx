import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import { planDaysOf, WEEKDAY_SHORT, type QuizPlanPreview as Preview } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'

/**
 * A prévia do plano, na ordem em que ele foi construído: objetivo e prazo,
 * três marcos, rotina semanal, hábito de sustentação e a ação de hoje. É o
 * mesmo plano que `/app/ativar` vai gravar, então o que está aqui é o que a
 * pessoa recebe. Nada de "e mais" escondido atrás do cadastro.
 */

interface QuizPlanPreviewProps {
  readonly preview: Preview
  readonly today: DayKey
}

export function QuizPlanPreviewView({ preview, today }: QuizPlanPreviewProps) {
  const reduced = useReducedMotion()
  const { plan, habit } = preview
  const days = planDaysOf(plan, today)

  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="flex flex-col gap-4 py-2">
      <motion.header {...enter(0)}>
        <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Seu plano</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
          {plan.objectiveTitle} em {days} dias.
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="brand">{plan.areaLabel}</Tag>
          <Tag>
            <Icon name="calendario" className="size-3.5" />
            até {formatDayLong(plan.deadline, today)}
          </Tag>
        </div>
        {preview.adjustmentNote ? (
          <p className="mt-3 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-sm text-ink-muted">
            {preview.adjustmentNote}
          </p>
        ) : null}
      </motion.header>

      <motion.div {...enter(0.08)}>
        <Block icon="plano" title="Três marcos">
          <ol className="flex flex-col gap-2.5">
            {plan.milestones.map((stage, index) => (
              <li key={stage.title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand-dim/40 text-xs font-semibold text-brand-ink"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{stage.title}</p>
                  <p className="text-xs text-ink-faint">até {formatDayLong(stage.dueOn, today)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Block>
      </motion.div>

      <motion.div {...enter(0.14)}>
        <Block icon="calendario" title="Rotina semanal">
          <p className="text-sm text-ink">{preview.routine}</p>
          <ul className="mt-3 flex gap-1.5" aria-label="Dias da semana">
            {WEEKDAY_SHORT.map((day) => {
              const active = plan.budget.weekdays.includes(day.value)
              return (
                <li
                  key={day.value}
                  aria-label={active ? `${day.label}, sim` : `${day.label}, não`}
                  className={
                    active
                      ? 'grid h-9 flex-1 place-items-center rounded-lg border border-brand bg-brand-dim/60 text-xs font-medium text-ink'
                      : 'grid h-9 flex-1 place-items-center rounded-lg border border-line text-xs text-ink-faint'
                  }
                >
                  {day.label}
                </li>
              )
            })}
          </ul>
        </Block>
      </motion.div>

      <motion.div {...enter(0.2)}>
        <Block icon="habitos" title="Hábito de sustentação">
          <p className="text-sm font-medium text-ink">{habit.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {habit.target} min por vez. {habit.description}
          </p>
        </Block>
      </motion.div>

      {plan.firstStep ? (
        <motion.div {...enter(0.26)}>
          <Block icon="raio" title="Primeiro passo de hoje" highlight>
            <p className="text-base font-semibold text-balance text-ink">{plan.firstStep.title}</p>
            {plan.firstStep.minimalVersion ? (
              <p className="mt-1.5 text-sm text-ink-muted">
                Dia cheio? Vale a versão mínima: {plan.firstStep.minimalVersion.toLowerCase()}
              </p>
            ) : null}
            {plan.firstStep.estimatedMin ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                <Icon name="relogio" className="size-3.5" />
                cerca de {plan.firstStep.estimatedMin} min
              </p>
            ) : null}
          </Block>
        </motion.div>
      ) : null}
    </div>
  )
}

function Block({
  icon,
  title,
  highlight = false,
  children,
}: {
  readonly icon: IconName
  readonly title: string
  readonly highlight?: boolean
  readonly children: ReactNode
}) {
  return (
    <section
      className={
        highlight
          ? 'rounded-2xl border border-brand/50 bg-brand-dim/30 p-4 surface-brand-glow'
          : 'rounded-2xl border border-line bg-surface/60 p-4'
      }
    >
      <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-faint uppercase">
        <Icon name={icon} className="size-4 text-brand-ink" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
