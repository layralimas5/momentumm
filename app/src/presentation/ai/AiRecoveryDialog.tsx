import { useEffect } from 'react'
import type { RecoveryState } from '@/domain/entities/recovery'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { usePlanner } from '@/presentation/planner/use-planner'
import { AiErrorNote } from './AiErrorNote'
import { AiProposals } from './AiProposals'
import { AiQuotaNote, AiSkeleton, AiSource } from './AiBits'
import type { AiController } from './use-ai'

interface AiRecoveryDialogProps {
  readonly open: boolean
  readonly ai: AiController
  readonly state: RecoveryState
  /** Chamado quando pelo menos um passo entrou: o card de retomada sai de cena. */
  readonly onApplied: () => void
  readonly onClose: () => void
}

/**
 * "Criar plano de retorno", a porta da IA no Modo Retomada.
 *
 * O pedido sai sozinho ao abrir: quem chegou aqui já escolheu voltar, e uma
 * segunda pergunta ("quer mesmo?") é a fricção que faz fechar a aba. O que a
 * IA devolve é curto de propósito: uma leitura sem culpa, até três passos
 * pequenos e os hábitos que valem manter na versão mínima. Aplicar continua
 * sendo decisão da pessoa, passo a passo.
 */
export function AiRecoveryDialog({ open, ai, state, onApplied, onClose }: AiRecoveryDialogProps) {
  const planner = usePlanner()
  const call = ai.planRecovery
  const plan = call.result

  useEffect(() => {
    if (!open || plan || call.loading) return
    void call.run({
      signals: state.signals.map((signal) => `${signal.label}: ${signal.detail}`),
      daysSinceLastMove: daysSinceLastMove(state),
    })
    // Só na abertura: a chamada tem freio próprio e o resultado fica guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    call.reset()
    onClose()
  }

  const keepHabits = plan
    ? plan.keepHabits
        .map((ref) => ai.refs.habits.get(ref))
        .map((id) => planner.habits.find((habit) => habit.id === id))
        .filter((habit): habit is NonNullable<typeof habit> => habit !== undefined)
    : []

  return (
    <Dialog
      open={open}
      title="Plano de retorno"
      description="Passos pequenos pra hoje, lidos do que já estava no teu plano. Nenhuma sequência é encerrada."
      size="lg"
      onClose={close}
    >
      <div className="flex flex-col gap-4">
        {call.error ? <AiErrorNote message={call.error} code={call.errorCode} /> : null}
        {call.loading ? <AiSkeleton lines={5} /> : null}

        {plan && !call.loading ? (
          <>
            <p className="text-pretty text-base text-ink">{plan.opening}</p>

            <AiProposals
              adjustments={plan.adjustments}
              refs={ai.refs}
              emptyText="Não achei um passo pequeno o bastante pra propor. Escolhe um dos passos do card."
              applyLabel="Começar por aqui"
              onApplied={(outcome) => {
                if (outcome.applied > 0) onApplied()
              }}
              onDiscard={close}
            />

            {keepHabits.length > 0 ? (
              <div className="rounded-xl border border-line bg-surface-hi/40 px-3.5 py-3">
                <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Vale manter na versão mínima
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {keepHabits.map((habit) => (
                    <li key={habit.id} className="flex items-center gap-2 text-sm text-ink-muted">
                      <Icon name="check" className="size-3.5 text-positive" />
                      {habit.name}
                      <span className="text-xs text-ink-faint">mínimo {habit.minimalTarget}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-sm text-ink-muted">{plan.reasoning}</p>
          </>
        ) : null}

        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <AiSource />
          <AiQuotaNote quota={ai.quota} simulated={ai.simulated} />
        </div>
      </div>
    </Dialog>
  )
}

/** O sinal de "dias fracos" carrega o número; sem ele, o mínimo que liga o modo. */
function daysSinceLastMove(state: RecoveryState): number {
  const match = state.signals.map((signal) => signal.detail.match(/(\d+)\s*dias?/)).find(Boolean)
  const parsed = match ? Number.parseInt(match[1] ?? '', 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 3
}
