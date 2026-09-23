import { useState } from 'react'
import { activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { isRunning } from '@/domain/entities/objective'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { usePlanner } from '@/presentation/planner/use-planner'

interface QuizActivationConflictProps {
  /** A área que o plano do quiz quer e que já está ocupada. */
  readonly axis: ActivityTypeSlug
  /** Chamado depois de liberar a área: a ativação roda de novo. */
  readonly onRetry: () => void
  /** Entrar no app sem esse plano. A saída que nunca pode faltar. */
  readonly onSkip: () => void
}

/**
 * O plano do quiz quer uma área que já tem objetivo ativo.
 *
 * É a regra do banco desde a 0003: um objetivo ativo por eixo, porque dois
 * disputando o mesmo eixo tornam o progresso ambíguo — os dois somam das
 * mesmas atividades.
 *
 * Antes disto, quem caía nesse caso via "Não consegui ativar seu plano" com
 * dois botões que falhavam sempre: "tentar de novo" esbarrava na mesma regra
 * e "refazer o quiz" levava à mesma área. E a casca do app, que manda pra cá
 * enquanto houver plano pendente, trazia a pessoa de volta a cada tentativa.
 * Conta criada, produto inacessível.
 *
 * A tela agora faz o que resolve, no mesmo toque: mostra QUAL objetivo ocupa
 * a área e oferece concluir ou arquivar. E, acima de tudo, deixa entrar no
 * app sem o plano — porque uma tela sem saída é pior que qualquer erro.
 */
export function QuizActivationConflictView({
  axis,
  onRetry,
  onSkip,
}: QuizActivationConflictProps) {
  const planner = usePlanner()
  const [busy, setBusy] = useState<string | null>(null)

  const area = activityType(axis)
  const ocupando = planner.objectives.filter((item) => item.axis === axis && isRunning(item))

  const liberar = async (id: string, como: 'arquivar' | 'concluir') => {
    setBusy(id)
    try {
      if (como === 'arquivar') await planner.archiveObjective(id)
      else await planner.completeObjective(id, true)
      onRetry()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="w-full text-left">
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">
        Seu plano está pronto. A área de {area.label} já tem dono.
      </h1>
      <p className="mt-2 text-sm text-pretty text-ink-muted">
        Cada área tem um objetivo ativo por vez — é o que mantém o progresso sem ambiguidade. Seu
        plano continua guardado neste aparelho.
      </p>

      {ocupando.length > 0 ? (
        <section className="mt-6" aria-labelledby="liberar-area">
          <h2 id="liberar-area" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            O que está ocupando {area.label}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {ocupando.map((objective) => (
              <li key={objective.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-sm font-medium text-ink">{objective.title}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy === objective.id}
                    disabled={busy !== null}
                    onClick={() => void liberar(objective.id, 'concluir')}
                  >
                    <Icon name="check" className="size-4" />
                    Já concluí esse
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void liberar(objective.id, 'arquivar')}
                  >
                    <Icon name="arquivar" className="size-4" />
                    Arquivar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            Nenhuma das duas apaga o histórico: o objetivo sai do dia e o que você já fez continua
            contando.
          </p>
        </section>
      ) : null}

      {/*
        A saída, sempre. Ela fica por último e discreta porque não é o melhor
        caminho — mas ela EXISTE, e é o que separa um erro de um beco sem
        saída. O plano do quiz não vale a conta inteira.
      */}
      <section className="mt-6 border-t border-line pt-4">
        <h2 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
          Ou deixa esse plano de lado
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Você entra no app agora, com o que já tem. O plano do quiz é descartado — dá pra montar
          outro objetivo a qualquer momento.
        </p>
        <Button variant="ghost" className="mt-3 w-full" onClick={onSkip}>
          Entrar no app sem esse plano
        </Button>
      </section>
    </div>
  )
}
