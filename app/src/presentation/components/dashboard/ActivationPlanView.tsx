import { activityType } from '@/domain/entities/activity-type'
import {
  ACTIVATION_CTA,
  ACTIVATION_READY_MESSAGE,
  formatDuration,
  type ActivationPlan,
  type ActivationRemedy,
} from '@/domain/entities/activation'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

/**
 * O último passo: as respostas viradas em plano.
 *
 * A tela mostra a cadeia inteira na ordem em que ela foi construída —
 * objetivo, marcos, plano, ações, primeiro passo — porque é isso que
 * transforma "o app gerou algo" em "eu entendi o caminho". Cada bloco carrega
 * o número que o produziu.
 *
 * Quando a ambição não cabe na disponibilidade, o plano NÃO é apresentado como
 * pronto: o aviso ocupa o lugar do CTA e as saídas viram botões, cada uma
 * dizendo o número que ela produz. É a regra mais importante daqui — plano
 * impossível não é entregue nem como rascunho.
 */

interface ActivationPlanViewProps {
  readonly plan: ActivationPlan
  readonly today: DayKey
  readonly saving: boolean
  readonly error: string | null
  readonly onApplyRemedy: (remedy: ActivationRemedy) => void
  /** "Revisar manualmente" volta pras perguntas. */
  readonly onReview: () => void
  readonly onSave: () => void
}

export function ActivationPlanView({
  plan,
  today,
  saving,
  error,
  onApplyRemedy,
  onReview,
  onSave,
}: ActivationPlanViewProps) {
  const type = activityType(plan.axis)

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-xs text-ink-muted">
        <Icon name="ia" className="mt-0.5 size-4 shrink-0 text-brand-ink" />
        <span className="text-pretty">
          <strong className="font-medium text-ink">Momentumm AI.</strong> O plano abaixo é calculado
          por regras determinísticas em cima das tuas quatro respostas: mesmo pedido, mesmo plano.
          Nada aqui foi escrito por um modelo.
        </span>
      </p>

      {/* 1. Objetivo */}
      <ChainBlock icon="objetivo" title="Objetivo">
        <p className="text-base font-semibold text-balance text-ink">{plan.objectiveTitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag tone="brand">{plan.areaLabel}</Tag>
          <Tag>
            <Icon name="calendario" className="size-3.5" />
            {formatDayLong(plan.deadline, today)}
          </Tag>
          <Tag>
            {plan.target} {type.unitLabel.many}
          </Tag>
        </div>
        <p className="mt-2 text-xs text-ink-faint">{targetNote(plan)}</p>
        {plan.extraAxes.length > 0 ? (
          <p className="mt-1 text-xs text-ink-faint">
            {plan.extraAxes.map((area) => area.label).join(', ')}
            {plan.extraAxes.length === 1 ? ' já fica criada' : ' já ficam criadas'} como eixo. Você
            adiciona os objetivos delas quando quiser.
          </p>
        ) : null}
        {plan.assumedDeadline ? (
          <p className="mt-1 text-xs text-ink-faint">
            Você disse que ainda não sabe a data: usei três meses pra o plano existir. Dá pra mudar
            depois sem perder nada.
          </p>
        ) : null}
      </ChainBlock>

      {/* 2. Marcos */}
      <ChainBlock icon="plano" title={`Marcos (${plan.milestones.length})`}>
        <ol className="flex flex-col gap-2">
          {plan.milestones.map((stage, index) => (
            <li key={stage.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand-dim/40 text-xs font-semibold text-brand-ink"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {stage.title}
                  <span className="ml-2 text-xs font-normal text-ink-faint">
                    {stage.weight}% · até {formatDayLong(stage.dueOn, today)}
                  </span>
                </p>
                {stage.description ? (
                  <p className="mt-0.5 text-sm text-ink-muted">{stage.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </ChainBlock>

      {/* 3. Plano (o ritmo) */}
      <ChainBlock icon="relogio" title="Plano">
        <p className="text-sm text-ink-muted">{plan.plan.rationale}</p>
        <p className="mt-2 text-sm text-ink">
          <strong className="font-medium">{plan.plan.perSession}</strong> {type.unitLabel.many} por sessão.
          Hábitos são à parte: você cria os teus (treinar, ler, meditar) na tela de Hábitos.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          {plan.budget.daysPerWeek} {plan.budget.daysPerWeek === 1 ? 'dia' : 'dias'} por semana ·{' '}
          {formatDuration(plan.budget.minutesPerWeek)} reservados por semana
        </p>
      </ChainBlock>

      {/* 4. Ações */}
      <ChainBlock icon="hoje" title={`Ações (${plan.actions.length})`}>
        <ul className="flex flex-col gap-2">
          {plan.actions.map((task) => (
            <li
              key={task.title}
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-hi/40 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">{task.title}</p>
                {task.minimalVersion ? (
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Dia ruim: {task.minimalVersion}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-ink-faint">
                {task.day === today ? 'Hoje' : formatDayLong(task.day, today)}
              </span>
            </li>
          ))}
        </ul>
      </ChainBlock>

      {/* 5. O aviso, ou o primeiro passo. Nunca os dois. */}
      {plan.ambition.fits ? (
        <ReadyBlock plan={plan} saving={saving} onSave={onSave} />
      ) : (
        <AmbitionBlock plan={plan} onApplyRemedy={onApplyRemedy} onReview={onReview} />
      )}

      <div aria-live="polite" className="min-h-5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  )
}

function ReadyBlock({
  plan,
  saving,
  onSave,
}: {
  readonly plan: ActivationPlan
  readonly saving: boolean
  readonly onSave: () => void
}) {
  return (
    <div className="rounded-card border border-positive/30 bg-positive/8 p-4">
      <p className="flex items-start gap-2 text-sm text-ink">
        <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
        <span className="text-pretty">{ACTIVATION_READY_MESSAGE}</span>
      </p>

      {plan.firstStep ? (
        <div className="mt-3 rounded-xl border border-line bg-canvas/50 px-3.5 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Seu próximo passo
          </p>
          <p className="mt-1 text-base font-semibold text-balance text-ink">
            {plan.firstStep.title}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {plan.firstStep.estimatedMin} min, hoje.
            {plan.firstStep.minimalVersion
              ? ` Se o dia apertar: ${plan.firstStep.minimalVersion}.`
              : ''}
          </p>
        </div>
      ) : null}

      <Button size="lg" className="mt-4 min-h-12 w-full sm:w-auto" loading={saving} onClick={onSave}>
        <Icon name="play" className="size-4" />
        {ACTIVATION_CTA}
      </Button>
    </div>
  )
}

function AmbitionBlock({
  plan,
  onApplyRemedy,
  onReview,
}: {
  readonly plan: ActivationPlan
  readonly onApplyRemedy: (remedy: ActivationRemedy) => void
  readonly onReview: () => void
}) {
  return (
    <div role="status" className="rounded-card border border-flame/30 bg-flame-dim/30 p-4">
      <p className="flex items-start gap-2 text-base font-semibold text-balance text-ink">
        <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-flame" />
        {plan.ambition.message}
      </p>

      <p className="mt-2 text-sm text-ink-muted">{plan.ambition.basis}</p>

      <p className="mt-3 text-sm text-ink">
        Não vou gerar um plano que já nasce impossível. Escolhe por onde reorganizar:
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {plan.remedies.map((remedy) => (
          <li key={remedy.key}>
            <button
              type="button"
              onClick={() => (remedy.adjustment ? onApplyRemedy(remedy) : onReview())}
              className={cn(
                'w-full rounded-xl border border-line bg-surface-hi/60 px-3.5 py-3 text-left',
                'transition-colors hover:border-line-hi hover:bg-surface active:bg-surface-top',
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">{remedy.label}</span>
                <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{remedy.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChainBlock({
  icon,
  title,
  children,
}: {
  readonly icon: 'objetivo' | 'plano' | 'relogio' | 'hoje'
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        <Icon name={icon} className="size-4 text-ink-faint" />
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** De onde saiu o alvo. A pessoa precisa poder discordar do número. */
function targetNote(plan: ActivationPlan): string {
  const type = activityType(plan.axis)

  switch (plan.targetSource) {
    case 'declarado':
      return `Esse alvo veio do número que você escreveu no objetivo.`
    case 'ajustado':
      return `Alvo ajustado por você pra caber no tempo: ${plan.target} ${type.unitLabel.many}.`
    case 'ritmo':
      return `Você não deu um número, então usei o ritmo que essa área sustenta. Dá pra mudar o alvo depois.`
  }
}
