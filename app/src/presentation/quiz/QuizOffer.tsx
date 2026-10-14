import { formatBRL, type ProQuote } from '@/domain/billing/billing-plans'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { useProQuotes } from '@/presentation/billing/use-pro-quotes'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

/**
 * A oferta, na mesma tela do resultado, em três fatos curtos.
 *
 * O que a pessoa ativa agora é grátis: o plano entra no app e a conta nasce
 * com o teste do PRO. O preço aparece aqui porque oferta que esconde o que
 * vem depois do teste vira susto no fim dele. Sem cartão, nenhuma cobrança
 * acontece sozinha: no fim do teste a conta volta pro gratuito.
 */
export function QuizOffer() {
  // Quem faz o quiz, quase sempre, nunca assinou: o preço de entrada.
  const { quotes } = useProQuotes(true)

  const facts: readonly { readonly icon: IconName; readonly title: string; readonly detail: string }[] = [
    { icon: 'check', title: 'Grátis', detail: 'pra ativar o plano' },
    { icon: 'estrela', title: `${TRIAL_DAYS} dias de PRO`, detail: 'sem cartão' },
    { icon: 'cadeado', title: 'Sem cobrança', detail: 'automática' },
  ]

  return (
    <section aria-label="O que acontece ao ativar" className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {facts.map((fact) => (
          <div key={fact.title} className="well flex flex-col items-center rounded-2xl px-2 py-3 text-center">
            <Icon name={fact.icon} className="size-4 text-brand-hi" />
            <p className="mt-1.5 text-xs font-semibold text-ink">{fact.title}</p>
            <p className="mt-0.5 text-[0.68rem] leading-tight text-pretty text-ink-faint">{fact.detail}</p>
          </div>
        ))}
      </div>
      <p className="px-1 text-center text-[0.7rem] text-pretty text-ink-faint">{afterTrial(quotes.mensal)}</p>
    </section>
  )
}

function afterTrial(monthly: ProQuote): string {
  const price =
    monthly.offer === 'primeiro_mes'
      ? `${formatBRL(monthly.firstCents)} no primeiro mês (depois, ${formatBRL(monthly.renewalCents)}/mês)`
      : `${formatBRL(monthly.firstCents)}/mês`
  return `No fim do teste, você segue no gratuito ou assina o PRO por ${price}.`
}
