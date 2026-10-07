import { motion, useReducedMotion } from 'framer-motion'
import type { Task } from '@/domain/entities/task'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'
import { PrimaryButton, SoftButton } from '@/presentation/components/ds/Controls'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import type { NextUp } from '@/presentation/planner/use-dashboard'

/**
 * A primeira tela depois do quiz: "Fazer meu primeiro passo" cai aqui, e o
 * Hoje mostra só isto enquanto a ação está aberta. A primeira experiência
 * com o app é agir, não explorar menu. Depois de concluir, o card vira a
 * comemoração discreta com a próxima ação, e o dia completo aparece.
 */

interface FirstWinCardProps {
  readonly task: Task | null
  readonly justCompleted: boolean
  readonly nextUp: NextUp | null
  readonly onComplete: (task: Task) => Promise<void>
  readonly onStartFocus: (task: Task) => void
  readonly onDismiss: () => void
}

export function FirstWinCard({
  task,
  justCompleted,
  nextUp,
  onComplete,
  onStartFocus,
  onDismiss,
}: FirstWinCardProps) {
  const reduced = useReducedMotion()
  const complete = useAsyncAction(async (item: Task) => {
    await onComplete(item)
  })

  if (justCompleted) {
    return (
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card tone="float" className="surface-brand-glow flex flex-col gap-3">
          <Eyebrow icon="trofeu">Primeiro passo feito</Eyebrow>
          <p className="text-lg font-semibold text-balance text-ink">Você começou de verdade. O plano já está andando.</p>
          {nextUp ? (
            <div className="well rounded-2xl px-3.5 py-3">
              <p className="text-xs text-ink-faint">Próximo passo</p>
              <p className="mt-0.5 text-sm font-medium text-ink">{nextUp.task.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{nextUp.reason}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Por hoje é isso. Amanhã o Hoje mostra o próximo passo.</p>
          )}
          <SoftButton onClick={onDismiss}>Ver meu dia</SoftButton>
        </Card>
      </motion.div>
    )
  }

  if (!task) return null

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card tone="float" className="surface-brand-glow flex flex-col gap-4" aria-labelledby="primeiro-passo">
        <Eyebrow icon="raio">Seu primeiro passo</Eyebrow>
        <div>
          <h2 id="primeiro-passo" className="text-xl leading-snug font-semibold tracking-tight text-balance text-ink">
            {task.title}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            {task.estimatedMin ? (
              <span className="inline-flex items-center gap-1.5 tabular">
                <Icon name="cronometro" className="size-4" />
                {task.estimatedMin} min
              </span>
            ) : null}
            <span>Pequeno de propósito: dá pra fazer agora.</span>
          </p>
          {task.minimalVersion ? (
            <p className="well mt-3 rounded-2xl px-3.5 py-2.5 text-sm text-ink-muted">
              Dia corrido? Vale a versão mínima: {task.minimalVersion.toLowerCase()}
            </p>
          ) : null}
        </div>

        {complete.error ? <p className="text-sm text-danger">{complete.error}</p> : null}

        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={() => onStartFocus(task)}>
            <Icon name="play" className="size-4" />
            Começar
          </PrimaryButton>
          <SoftButton disabled={complete.running} onClick={() => void complete.run(task)}>
            <Icon name="check" className="size-4" />
            Já fiz
          </SoftButton>
        </div>
      </Card>
    </motion.div>
  )
}
