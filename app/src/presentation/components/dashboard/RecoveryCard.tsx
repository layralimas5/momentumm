import type { ReactNode } from 'react'
import { track } from '@/infrastructure/analytics/track'
import { motion } from 'framer-motion'
import type { RecoveryState, RecoveryStep } from '@/domain/entities/recovery'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, Tag } from '@/presentation/components/ui/Surface'

/**
 * Modo Retomada.
 *
 * O card mais delicado do app, e as regras dele são de tom antes de serem de
 * código:
 *
 * - Não conta dias perdidos. "Você quebrou uma sequência de 12 dias" é verdade
 *   e é exatamente a frase que faz a pessoa não voltar.
 * - Não mostra a lista do que ficou pra trás. Ela existe no plano, e é lá que
 *   ela deve ser resolvida — com calma, num dia em que voltar já aconteceu.
 * - Oferece até três passos pequenos, e o botão de cada um é a única coisa
 *   que ele pede.
 *
 * Os sinais que ligaram o modo ficam visíveis, com número, porque um app que
 * diz "notei que você sumiu" sem mostrar o que olhou é um app que a pessoa
 * aprende a não acreditar.
 */

interface RecoveryCardProps {
  readonly state: RecoveryState | null
  /** Minutos que o dia passa a ter depois de escolher esse passo. */
  readonly budgetFor: (step: RecoveryStep) => number
  readonly onChoose: (step: RecoveryStep) => void
  readonly onDismiss: () => void
  /** A porta da IA ("Criar plano de retorno"), quando o plano tem. */
  readonly aiEntry?: ReactNode
}

export function RecoveryCard({ state, budgetFor, onChoose, onDismiss, aiEntry }: RecoveryCardProps) {
  if (!state) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel tone="brand" aria-labelledby="retomada-titulo">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
          <Icon name="desfazer" className="size-4" />
          Modo retomada
        </p>

        <h2 id="retomada-titulo" className="mt-3 text-base font-semibold text-balance text-ink">
          {state.message}
        </h2>

        <p className="mt-2 text-sm text-ink-muted">{state.headline}</p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {state.signals.map((signal) => (
            <li key={signal.key}>
              <Tag>{signal.detail}</Tag>
            </li>
          ))}
        </ul>

        {state.steps.length > 0 ? (
          <>
            <p className="mt-5 text-sm font-medium text-ink">
              {state.steps.length === 1
                ? 'Um passo pequeno pra voltar:'
                : `Escolhe um destes ${state.steps.length}. Um só já conta:`}
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              {state.steps.map((step) => (
                <li
                  key={`${step.kind}-${step.id}`}
                  className="rounded-xl border border-brand/25 bg-canvas/40 px-3.5 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-balance text-ink">{step.title}</p>
                      <p className="mt-1 text-sm text-ink-muted">{step.reason}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {step.kind === 'habito' ? <Tag>Hábito</Tag> : null}
                        {step.objectiveTitle ? <Tag tone="brand">{step.objectiveTitle}</Tag> : null}
                        {step.fromAnotherDay ? <Tag>Vem de outro dia</Tag> : null}
                        {step.minutes > 0 ? (
                          <Tag>
                            <Icon name="relogio" className="size-3.5" />
                            {step.minutes} min
                          </Tag>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => {
                        track('recovery_started', 'retomada')
                        onChoose(step)
                      }}
                    >
                      Começar por essa
                      <span className="sr-only">
                        {`. O dia fica com ${budgetFor(step)} minutos.`}
                      </span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-brand/25 bg-canvas/40 px-3.5 py-3 text-sm text-ink">
            Não tem nada pequeno o suficiente montado pra hoje. Cria uma ação de dez minutos: o
            tamanho dela é o que menos importa agora.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {aiEntry}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Hoje não
          </Button>
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          Nenhuma sequência foi encerrada e nada do que ficou pra trás foi somado ao seu dia.
        </p>
      </Panel>
    </motion.div>
  )
}
