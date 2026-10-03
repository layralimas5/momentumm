import type { ReactNode } from 'react'
import { formatBRL, type ProQuote } from '@/domain/billing/billing-plans'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { useProQuotes } from '@/presentation/billing/use-pro-quotes'
import { Icon } from '@/presentation/components/ui/Icon'

/**
 * A oferta, na mesma tela do resultado.
 *
 * O que a pessoa ativa agora é grátis: o plano entra no app e a conta nasce
 * com o teste do PRO. O preço aparece aqui, logo abaixo do plano, porque é o
 * momento de maior clareza sobre o valor, e porque oferta que esconde o que
 * vem depois do teste vira susto no fim dele. Sem cartão, nenhuma cobrança
 * acontece sozinha: no fim do teste a conta volta pro gratuito.
 */
export function QuizOffer() {
  // Quem faz o quiz, quase sempre, nunca assinou: o preço de entrada.
  const { quotes } = useProQuotes(true)

  return (
    <section
      aria-labelledby="quiz-oferta"
      className="mt-4 rounded-2xl border border-brand/40 bg-brand-dim/30 p-4"
    >
      <h2 id="quiz-oferta" className="text-sm font-semibold text-ink">
        Ativar o plano é grátis
      </h2>
      <ul className="mt-2.5 flex flex-col gap-2 text-sm text-ink-muted">
        <OfferLine>O plano entra no app do jeito que está aqui, com o passo de hoje pronto.</OfferLine>
        <OfferLine>
          Sua conta começa com {TRIAL_DAYS} dias de PRO, sem cartão e sem cobrança automática.
        </OfferLine>
        <OfferLine>{afterTrial(quotes.mensal)}</OfferLine>
      </ul>
    </section>
  )
}

function OfferLine({ children }: { readonly children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-hi" />
      <span className="text-pretty">{children}</span>
    </li>
  )
}

function afterTrial(monthly: ProQuote): string {
  const price =
    monthly.offer === 'primeiro_mes'
      ? `${formatBRL(monthly.firstCents)} no primeiro mês (depois, ${formatBRL(monthly.renewalCents)}/mês)`
      : `${formatBRL(monthly.firstCents)}/mês`
  return `No fim do teste, você segue no gratuito ou assina o PRO por ${price}.`
}
