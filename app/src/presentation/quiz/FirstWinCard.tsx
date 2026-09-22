import { motion, useReducedMotion } from 'framer-motion'
import type { Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import type { NextUp } from '@/presentation/planner/use-dashboard'

/**
 * A primeira tela depois do quiz: o plano está pronto e a ação de hoje é
 * uma só. Dois estados no mesmo lugar: a ação aberta (com concluir e
 * começar) e, logo depois de fechar, a comemoração com a próxima ação
 * recomendada. Discreto de propósito: é um card, não um confete.
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
        <Panel tone="brand" glow className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
            <Icon name="trofeu" className="size-4" />
            Primeira vitória
          </p>
          <p className="text-lg font-semibold text-balance text-ink">
            Você começou de verdade. O plano já está andando.
          </p>
          {nextUp ? (
            <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
              <p className="text-xs text-ink-faint">Próxima ação recomendada</p>
              <p className="mt-0.5 text-sm font-medium text-ink">{nextUp.task.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{nextUp.reason}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Por hoje é isso. Amanhã o Hoje mostra o próximo passo.
            </p>
          )}
          <div>
            <Button variant="ghost" className="min-h-10" onClick={onDismiss}>
              Fechar
            </Button>
          </div>
        </Panel>
      </motion.div>
    )
  }

  if (!task) return null

  return (
    <Panel tone="brand" glow className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
        <Icon name="raio" className="size-4" />
        Seu plano está pronto
      </p>
      <p className="text-lg font-semibold text-balance text-ink">
        Agora vamos conquistar sua primeira vitória.
      </p>

      <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
        <p className="text-base font-medium text-pretty text-ink">{task.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          {task.estimatedMin ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="relogio" className="size-3.5" />
              cerca de {task.estimatedMin} min
            </span>
          ) : null}
          {task.minimalVersion ? <span>Dia cheio? {task.minimalVersion}</span> : null}
        </p>
      </div>

      {complete.error ? <p className="text-sm text-danger">{complete.error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-12 flex-1"
          loading={complete.running}
          onClick={() => void complete.run(task)}
        >
          <Icon name="check" className="size-4" />
          Concluí
        </Button>
        <Button variant="secondary" className="min-h-12" onClick={() => onStartFocus(task)}>
          <Icon name="play" className="size-4" />
          Começar agora
        </Button>
      </div>
    </Panel>
  )
}
