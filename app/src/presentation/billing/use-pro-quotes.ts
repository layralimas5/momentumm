import { useMemo } from 'react'
import { BILLING_CYCLES, quotePro, type BillingCycle, type ProQuote } from '@/domain/billing/billing-plans'
import { container } from '@/infrastructure/container'
import { useFeature } from '@/presentation/plan/use-feature'

export interface ProQuotes {
  readonly quotes: Readonly<Record<BillingCycle, ProQuote>>
  readonly foundersActive: boolean
  /** Ainda perguntando pela campanha. O anual não troca de preço na frente da pessoa. */
  readonly loading: boolean
}

/**
 * O preço de cada ciclo pra quem está olhando.
 *
 * `firstSubscription` vem de quem chama: na landing é sempre `true` (quem lê
 * a landing é, quase sempre, quem nunca assinou), e no app é "não tem
 * assinatura nenhuma". Quem decide de verdade é a função de cobrança, que
 * confere no banco; aqui é o que a tela promete, e ela promete o mesmo.
 */
export function useProQuotes(firstSubscription: boolean): ProQuotes {
  const founders = useFeature('foundersOffer')
  const foundersActive = container.demo ? previewFounders() : founders.enabled

  const quotes = useMemo(() => {
    const context = { firstSubscription, foundersActive }
    return Object.fromEntries(BILLING_CYCLES.map((cycle) => [cycle, quotePro(cycle, context)])) as Record<
      BillingCycle,
      ProQuote
    >
  }, [firstSubscription, foundersActive])

  return { quotes, foundersActive, loading: !container.demo && founders.loading }
}

/** No demo não há painel pra ligar a campanha: `?oferta=fundadores` mostra como ela fica. */
function previewFounders(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('oferta') === 'fundadores'
  } catch {
    return false
  }
}
