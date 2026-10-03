import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { XP_RULES } from '@/domain/entities/evolution'
import type { RecoveryState, RecoveryStep } from '@/domain/entities/recovery'
import type { Comeback } from '@/domain/entities/rhythm'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card, Eyebrow, IconWell } from '@/presentation/components/ds/Card'
import { Icon } from '@/presentation/components/ui/Icon'
import { formatMinutes } from '@/presentation/today/day-items'

/**
 * Os passos de volta: no máximo três, pequenos, tirados do próprio plano.
 * Tocar num deles é escolher por onde recomeçar.
 */
export function RecoverySteps({
  state,
  onChoose,
  onAi,
  onCreate,
}: {
  readonly state: RecoveryState
  readonly onChoose: (step: RecoveryStep) => void
  readonly onAi?: () => void
  readonly onCreate: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {state.steps.length === 0 ? (
        <p className="well rounded-2xl px-4 py-3 text-sm text-pretty text-ink-muted">
          Nada no plano pra servir de primeiro passo. Crie uma microação de 10 minutos e comece por ela.
        </p>
      ) : (
        state.steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onChoose(step)}
            className="card-float press flex min-h-14 items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-dim text-brand-hi">
              <Icon name={step.kind === 'habito' ? 'habitos' : 'raio'} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {step.minimal && step.minimalTitle ? step.minimalTitle : step.title}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {formatMinutes(step.minutes)}
                {step.objectiveTitle ? ` · ${step.objectiveTitle}` : ''}
              </span>
            </span>
            <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
          </button>
        ))
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-brand-hi"
        >
          <Icon name="mais" className="size-4" strokeWidth={2.25} />
          Criar uma microação
        </button>
        {onAi ? (
          <button
            type="button"
            onClick={onAi}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-brand-hi"
          >
            <Icon name="ia" className="size-4" />
            Plano de retorno com IA
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** O Modo Retomada no Hoje, quando o app percebe a queda. */
export function RecoveryNowCard({
  state,
  onChoose,
  onDismiss,
  onAi,
  onCreate,
}: {
  readonly state: RecoveryState
  readonly onChoose: (step: RecoveryStep) => void
  readonly onDismiss: () => void
  readonly onAi?: () => void
  readonly onCreate: () => void
}) {
  const [showSignals, setShowSignals] = useState(false)

  return (
    <Card tone="float" aria-labelledby="modo-retomada" className="relative">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-faint hover:text-ink"
      >
        <Icon name="fechar" className="size-4" />
        <span className="sr-only">Dispensar por hoje</span>
      </button>

      <div className="flex items-center gap-2 pr-8">
        <Eyebrow icon="retomar">Modo Retomada</Eyebrow>
        <StatusTag tone="brand">Zero Atrito</StatusTag>
      </div>
      <h2 id="modo-retomada" className="mt-2 text-lg leading-snug font-semibold tracking-tight text-ink">
        {state.headline}
      </h2>
      <p className="mt-1 text-sm text-pretty text-ink-muted">{state.message} Escolha um passo:</p>

      {state.signals.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowSignals((value) => !value)}
          aria-expanded={showSignals}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-faint"
        >
          {showSignals ? 'Esconder o porquê' : 'Por que isso apareceu?'}
          <Icon name={showSignals ? 'acima' : 'abaixo'} className="size-3.5" />
        </button>
      ) : null}
      {showSignals ? (
        <ul className="mt-2 flex flex-col gap-1">
          {state.signals.map((signal) => (
            <li key={signal.key} className="text-xs text-ink-faint">
              <strong className="font-semibold text-ink-muted">{signal.label}:</strong> {signal.detail}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <RecoverySteps state={state} onChoose={onChoose} onCreate={onCreate} {...(onAi ? { onAi } : {})} />
      </div>
    </Card>
  )
}

/**
 * "Você voltou." O momento de quem retomou depois de dias fora: nada de cobrar
 * o que ficou, só reconhecer a volta. Aparece uma vez por dia de retomada.
 */
export function ComebackCard({
  comeback,
  xpEarned,
  onDismiss,
}: {
  readonly comeback: Comeback
  /** O XP de retomada já caiu hoje. Volta só por rotina não rende XP, e o card não promete. */
  readonly xpEarned: boolean
  readonly onDismiss: () => void
}) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      <motion.section
        aria-labelledby="voce-voltou"
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="card-float relative overflow-hidden p-4 sm:p-5"
      >
        {reduce ? null : (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-brand/30 blur-3xl"
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-ink-faint hover:text-ink"
        >
          <Icon name="fechar" className="size-4" />
          <span className="sr-only">Fechar</span>
        </button>

        <div className="relative flex items-center gap-3.5 pr-8">
          <IconWell name="retomar" className="size-12" />
          <div className="min-w-0">
            <h2 id="voce-voltou" className="text-xl font-bold tracking-tight text-ink">
              Você voltou.
            </h2>
            <p className="text-sm text-pretty text-ink-muted">
              Depois de {comeback.daysAway} dias fora. É isso que conta: continuar voltando.
            </p>
          </div>
        </div>

        <div className="relative mt-3 flex items-center gap-2">
          {xpEarned ? <StatusTag tone="solid">+{XP_RULES.comeback.points} XP de retomada</StatusTag> : null}
          <span className="text-xs text-ink-faint">Conta no teu Recovery Rate</span>
        </div>
      </motion.section>
    </AnimatePresence>
  )
}

