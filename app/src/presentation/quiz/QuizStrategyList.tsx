import type { Intervention, InterventionDetail } from '@/domain/entities/quiz-strategy'
import { Card, SectionHeader } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * "Sua estratégia": as três intervenções que o motor escolheu, cada uma com
 * um exemplo concreto tirado do próprio plano. O porquê fica atrás de um
 * link discreto, pra não disputar espaço com o que fazer.
 */
export function QuizStrategyList({
  interventions,
  onExplain,
}: {
  readonly interventions: readonly Intervention[]
  readonly onExplain: () => void
}) {
  return (
    <section aria-labelledby="quiz-estrategia" className="flex flex-col gap-3">
      <SectionHeader id="quiz-estrategia" title="Sua estratégia" caps aside="Como o Momentumm vai agir" />

      <ol className="flex flex-col gap-3">
        {interventions.map((item, index) => (
          <li key={item.key}>
            <Card className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <span aria-hidden="true" className="text-sm font-semibold text-brand-hi tabular">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm text-pretty text-ink-muted">{item.promise}</p>
                </div>
              </div>
              <InterventionVisual detail={item.detail} />
            </Card>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onExplain}
        className="flex min-h-11 items-center justify-center gap-1.5 self-center rounded-full px-3 text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:text-ink"
      >
        <Icon name="lampada" className="size-4" />
        Por que o Momentumm escolheu isso?
      </button>
    </section>
  )
}

function InterventionVisual({ detail }: { readonly detail: InterventionDetail }) {
  switch (detail.kind) {
    case 'shrink':
      return (
        <div className="well flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-sm">
          <p className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs text-ink-faint">No plano</span>
              <span className="text-ink-muted">{detail.from}</span>
            </span>
            {detail.fromMinutes ? (
              <span className="shrink-0 text-xs text-ink-faint tabular">{detail.fromMinutes} min</span>
            ) : null}
          </p>
          <Icon name="abaixo" className="size-4 text-brand-hi" />
          <p>
            <span className="block text-xs text-ink-faint">No dia ruim</span>
            <span className="font-medium text-ink">{detail.to}</span>
          </p>
        </div>
      )
    case 'if_then':
      return (
        <div className="well flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-sm">
          <RuleLine tag="Se" text={`${detail.rule.when},`} />
          <RuleLine tag="Então" text={detail.rule.then} strong />
        </div>
      )
    case 'streak':
      return (
        <div className="well flex flex-col gap-2.5 rounded-2xl px-3.5 py-3">
          <ul className="flex gap-2" aria-label="Exemplo de semana: três dias feitos, um perdido, um feito">
            {detail.days.map((day, index) => (
              <li
                key={index}
                aria-hidden="true"
                className={cn(
                  'grid size-8 place-items-center rounded-full',
                  day === 'feito' ? 'bg-brand text-white' : 'border border-dashed border-line-hi text-ink-faint',
                )}
              >
                {day === 'feito' ? <Icon name="check" className="size-4" strokeWidth={2.25} /> : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-pretty text-ink-muted">{detail.caption}</p>
        </div>
      )
    case 'steps':
      return (
        <ol className="well flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-sm">
          {detail.steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  index === 0 ? 'bg-brand text-white' : 'bg-surface-top text-ink-faint',
                )}
              >
                {index + 1}
              </span>
              <span className={index === 0 ? 'font-medium text-ink' : 'text-ink-muted'}>{step}</span>
            </li>
          ))}
        </ol>
      )
    case 'note':
      return <p className="well rounded-2xl px-3.5 py-3 text-sm text-pretty text-ink-muted">{detail.text}</p>
  }
}

function RuleLine({ tag, text, strong = false }: { readonly tag: string; readonly text: string; readonly strong?: boolean }) {
  return (
    <p className="flex items-start gap-2.5">
      <span className="chip mt-px w-12 shrink-0 rounded-md py-0.5 text-center text-[0.68rem] font-semibold tracking-wide text-brand-hi uppercase">
        {tag}
      </span>
      <span className={cn('text-pretty', strong ? 'font-medium text-ink' : 'text-ink-muted')}>{text}</span>
    </p>
  )
}
