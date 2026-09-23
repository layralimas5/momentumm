import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isRunning } from '@/domain/entities/objective'
import { Button, buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { usePlanner } from '@/presentation/planner/use-planner'
import { PRO_TAGLINE } from '@/presentation/plan/pro-benefits'
import type { QuizActivationLimit } from './quiz-activation'

interface QuizActivationLimitViewProps {
  readonly limit: QuizActivationLimit
  /** Chamado depois de liberar espaço: a ativação roda de novo. */
  readonly onRetry: () => void
}

/**
 * O plano do quiz está pronto, mas a conta encostou num limite do gratuito.
 *
 * Quem cai aqui é a conta antiga: já tem os dois objetivos do plano gratuito
 * em andamento e o teste do PRO encerrado. "Tentar de novo" falharia igual,
 * então a tela faz o que resolve no mesmo toque — pausar um objetivo libera
 * a vaga e ativa o plano na hora. Pausar não apaga nada: o objetivo sai da
 * fila do dia e volta quando a pessoa quiser.
 */
export function QuizActivationLimitView({ limit, onRetry }: QuizActivationLimitViewProps) {
  const planner = usePlanner()
  const [pausing, setPausing] = useState<string | null>(null)

  const running = planner.objectives.filter(isRunning)
  // A lista só resolve o limite de objetivos; nos outros, o PRO é a saída.
  const canFreeSpace = limit.feature === 'Objetivos ativos' && running.length > 0

  const pause = async (id: string) => {
    setPausing(id)
    try {
      await planner.setObjectivePaused(id, true)
      onRetry()
    } finally {
      setPausing(null)
    }
  }

  return (
    <div className="w-full text-left">
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">
        Seu plano está pronto. Falta espaço na conta.
      </h1>
      <p className="mt-2 text-sm text-pretty text-ink-muted">
        {limit.message} Seu plano continua guardado: é só abrir uma vaga ou assinar o PRO.
      </p>

      {canFreeSpace ? (
        <section className="mt-6" aria-labelledby="liberar-espaco">
          <h2 id="liberar-espaco" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Pausar um objetivo e ativar
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Pausar tira o objetivo da fila do dia sem apagar nada. Dá pra retomar quando quiser.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {running.map((objective) => (
              <li
                key={objective.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{objective.title}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  loading={pausing === objective.id}
                  disabled={pausing !== null}
                  onClick={() => void pause(objective.id)}
                >
                  <Icon name="pausa" className="size-4" />
                  Pausar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="sem-limite">
        <h2 id="sem-limite" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Ou tire o limite do caminho
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">{PRO_TAGLINE}</p>
        <Link
          to="/app/assinatura"
          className={buttonClass({ size: 'lg', className: 'mt-3 w-full' })}
        >
          <Icon name="raio" className="size-4" />
          Assinar o PRO
        </Link>
      </section>

      <Button variant="ghost" className="mt-2 w-full" onClick={onRetry}>
        Já liberei espaço, ativar agora
      </Button>
    </div>
  )
}
