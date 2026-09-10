import {
  ADAPTIVE_VERDICT_LABELS,
  type AdaptiveDayPlan,
  type AdaptiveItem,
  type AdaptiveVerdict,
} from '@/domain/entities/adaptive-day'
import { formatDayLabel, type DayKey } from '@/domain/entities/day'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { cn } from '@/shared/lib/cn'

/**
 * A revisão do Dia Adaptável.
 *
 * A tela mostra o plano proposto, item por item, com o MOTIVO de cada escolha
 * — e só grava depois do "Confirmar". Um recurso que reorganiza o dia sozinho
 * e avisa depois é um recurso que a pessoa desliga na segunda vez: o dia é
 * dela, e a decisão de encolher ou empurrar alguma coisa também.
 *
 * Mesma revisão nos dois tamanhos de tela, em camadas diferentes: diálogo no
 * desktop, bottom sheet no celular, que é a camada modal do polegar.
 */

interface AdaptiveDayReviewProps {
  readonly plan: AdaptiveDayPlan | null
  readonly intro?: string | undefined
  readonly applying: boolean
  readonly error: string | null
  readonly onConfirm: () => void
  readonly onClose: () => void
}

const GROUPS: readonly { readonly verdict: AdaptiveVerdict; readonly icon: IconName }[] = [
  { verdict: 'manter', icon: 'check' },
  { verdict: 'reduzir', icon: 'minimo' },
  { verdict: 'reagendar', icon: 'calendario' },
]

export function AdaptiveDayReview({
  plan,
  intro,
  applying,
  error,
  onConfirm,
  onClose,
}: AdaptiveDayReviewProps) {
  const isDesktop = useIsDesktop()

  const body = plan ? (
    <ReviewBody
      plan={plan}
      intro={intro}
      applying={applying}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  ) : null

  if (isDesktop) {
    return (
      <Dialog
        open={plan !== null}
        title={plan?.title ?? ''}
        {...(plan ? { description: plan.summary } : {})}
        size="lg"
        onClose={onClose}
      >
        {body}
      </Dialog>
    )
  }

  return (
    <BottomSheet
      open={plan !== null}
      title={plan?.title ?? ''}
      description={plan?.summary}
      onClose={onClose}
    >
      {body}
    </BottomSheet>
  )
}

function ReviewBody({
  plan,
  intro,
  applying,
  error,
  onConfirm,
  onClose,
}: AdaptiveDayReviewProps & { readonly plan: AdaptiveDayPlan }) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: plan.items.filter((item) => item.verdict === group.verdict),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {intro ? (
        <p className="rounded-xl border border-brand/25 bg-brand-dim/30 px-3.5 py-3 text-sm text-ink">
          {intro}
        </p>
      ) : null}

      {/* A conta do dia em uma linha: o que você tem, o que estava montado, o
          que sobra depois de adaptar. */}
      <dl className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface-hi/50 p-3 text-center">
        <Figure label="Você tem" value={`${plan.availableMin} min`} />
        <Figure label="Estava montado" value={`${plan.plannedMin} min`} />
        <Figure label="Fica em" value={`${plan.adaptedMin} min`} tone="brand" />
      </dl>

      {plan.protectedObjectives.length > 0 ? (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Icon name="objetivo" className="mt-0.5 size-4 shrink-0 text-brand-ink" />
          <span>
            Continuam andando hoje:{' '}
            <strong className="font-medium text-ink">
              {plan.protectedObjectives.join(', ')}
            </strong>
            .
          </span>
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.verdict} aria-label={ADAPTIVE_VERDICT_LABELS[group.verdict]}>
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            <Icon name={group.icon} className="size-4 text-ink-faint" />
            {ADAPTIVE_VERDICT_LABELS[group.verdict]}
            <span className="text-ink-faint">({group.items.length})</span>
          </h3>

          <ul className="mt-2 flex flex-col gap-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} today={plan.today} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.items.some((item) => item.kind === 'habito' && item.verdict === 'reduzir') ? (
        <p className="text-xs text-ink-faint">
          Hábito o app não marca por você: a versão mínima fica valendo pra quando você marcar.
        </p>
      ) : null}

      <div aria-live="polite" className="min-h-5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} loading={applying} disabled={plan.writes === 0 && plan.fits}>
          {plan.writes === 0 ? 'Entendi' : `Confirmar ${plan.writes === 1 ? 'a mudança' : `as ${plan.writes} mudanças`}`}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={applying}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  tone = 'plain',
}: {
  readonly label: string
  readonly value: string
  readonly tone?: 'plain' | 'brand'
}) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-sm font-semibold',
          tone === 'brand' ? 'text-brand-ink' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ItemRow({ item, today }: { readonly item: AdaptiveItem; readonly today: DayKey }) {
  return (
    <div className="rounded-xl border border-line bg-surface-hi/40 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-balance text-ink">
          {item.verdict === 'reduzir' && item.minimalTitle ? (
            <>
              <span className="text-ink-faint line-through">{item.title}</span>{' '}
              <span aria-hidden="true" className="text-ink-faint">
                →
              </span>{' '}
              {item.minimalTitle}
            </>
          ) : (
            item.title
          )}
        </p>

        <span className="shrink-0 text-xs text-ink-faint">
          {item.verdict === 'reagendar'
            ? item.moveTo
              ? formatDayLabel(item.moveTo, today)
              : ''
            : item.adaptedMin > 0
              ? `${item.adaptedMin} min`
              : ''}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-ink-muted">{item.reason}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.kind === 'habito' ? <Tag>Hábito</Tag> : null}
        {item.objectiveTitle ? <Tag tone="brand">{item.objectiveTitle}</Tag> : null}
        {item.stageTitle ? <Tag>Etapa: {item.stageTitle}</Tag> : null}
        {item.locked ? <Tag tone="positive">Protegido</Tag> : null}
        {item.overBudget ? <Tag tone="warn">Passa do tempo de hoje</Tag> : null}
      </div>
    </div>
  )
}
