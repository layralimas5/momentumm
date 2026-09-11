import { isPro } from '@/domain/entities/plan'
import type { AiErrorCode } from '@/domain/ai/ai-error'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { ErrorNote } from '@/presentation/components/ui/States'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * O erro da IA com a saída certa pra cada código.
 *
 * Cota estourada no gratuito é o único caso em que existe algo a oferecer (o
 * PRO amplia a profundidade, e leituras por dia é profundidade). Nos outros
 * a mensagem já diz o que fazer: entrar de novo, esperar, ou avisar quem
 * configura o ambiente.
 */
export function AiErrorNote({
  message,
  code,
  className,
}: {
  readonly message: string
  readonly code: AiErrorCode | null
  readonly className?: string
}) {
  const planner = usePlanner()
  const offerPro = code === 'quota_exceeded' && !isPro(planner.limits.tier)

  return (
    <div className={className}>
      <ErrorNote message={message} />
      {offerPro ? (
        <UpgradeHint className="mt-2" message="Mais leituras por dia fazem parte do PRO." />
      ) : null}
    </div>
  )
}
