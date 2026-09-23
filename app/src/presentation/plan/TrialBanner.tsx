import { Link, useLocation } from 'react-router-dom'
import { isTrialActive, trialDaysLeft } from '@/domain/billing/trial'
import { isPro } from '@/domain/entities/plan'
import { useAuth } from '@/presentation/auth/use-auth'
import { Icon } from '@/presentation/components/ui/Icon'
import { SUBSCRIPTION_PATH } from './subscription-path'

/** "24 de setembro", sem ano: o teste dura sete dias, o ano é sempre este. */
export function formatTrialEnd(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

/**
 * A linha que diz que o PRO de agora tem prazo.
 *
 * Aparece em toda tela do app enquanto o teste vale, porque a pessoa precisa
 * saber ANTES do oitavo dia que o histórico completo e a IA vão parar. Uma
 * linha, sem modal, sem contagem regressiva em vermelho: informa e sai do
 * caminho, como o resto das chamadas de PRO. Na tela de assinatura ela
 * some, porque lá a mesma informação vira o painel principal.
 */
export function TrialBanner() {
  const { profile, trial } = useAuth()
  const { pathname } = useLocation()

  if (!profile || !isPro(profile.plan) || !isTrialActive(trial)) return null
  if (pathname.startsWith(SUBSCRIPTION_PATH)) return null

  const days = trialDaysLeft(trial)

  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-dim/30 px-3 py-2 text-xs text-ink-muted lg:mb-5"
    >
      <Icon name="raio" className="mt-px size-3.5 shrink-0 text-brand-hi" />
      <span>
        <strong className="font-semibold text-ink">PRO de teste</strong> até {formatTrialEnd(trial.endsAt)}
        {days > 0 ? ` (${days === 1 ? 'último dia' : `faltam ${days} dias`})` : ''}. Sem cartão e sem cobrança:
        no fim, a conta volta pro gratuito com tudo guardado.{' '}
        <Link to="/app/assinatura" className="font-medium text-brand-hi underline-offset-2 hover:underline">
          Assinar o PRO
        </Link>
      </span>
    </p>
  )
}
