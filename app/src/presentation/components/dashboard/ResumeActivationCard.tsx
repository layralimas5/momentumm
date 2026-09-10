import { ACTIVATION_STEPS } from '@/presentation/planner/use-activation'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'

/**
 * A porta de volta pro onboarding.
 *
 * Deixar a pessoa pular é fácil; o difícil é ela conseguir voltar. Sem este
 * card, "deixar pra depois" viraria "nunca", e a conta ficaria pra sempre num
 * dashboard vazio que não explica o que fazer.
 *
 * Ele só existe enquanto a conta não tem nada criado: assim que houver um
 * objetivo — pelo onboarding ou pela mão — o app para de convidar.
 */

interface ResumeActivationCardProps {
  /** Passo em que a pessoa parou, base zero. */
  readonly step: number
  /** Já respondeu alguma coisa: muda "começar" pra "retomar". */
  readonly started: boolean
  readonly onResume: () => void
}

export function ResumeActivationCard({ step, started, onResume }: ResumeActivationCardProps) {
  const label = ACTIVATION_STEPS[Math.min(step, ACTIVATION_STEPS.length - 1)]

  return (
    <Panel tone="brand" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
          <Icon name="objetivo" className="size-4" />
          Seu primeiro objetivo
        </p>

        <p className="mt-2 text-base font-semibold text-balance text-ink">
          {started
            ? `Você parou em “${label}”. Faltam poucos toques.`
            : 'Quatro perguntas e você sai com um plano e o passo de hoje.'}
        </p>

        <p className="mt-1 text-sm text-ink-muted">
          As respostas continuam guardadas neste dispositivo. Nada foi salvo ainda.
        </p>
      </div>

      <Button className="min-h-12 shrink-0" onClick={onResume}>
        <Icon name="play" className="size-4" />
        {started ? 'Retomar' : 'Começar'}
      </Button>
    </Panel>
  )
}
