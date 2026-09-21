import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isOfferKey, OFFER_PARAM, OFFERS, rememberOffer, type Offer } from './offers'

/**
 * A oferta desta visita. Vem do link (`?oferta=a`) e, quando vem, fica
 * guardada pra o onboarding saber de onde a pessoa veio. Sem parâmetro a
 * landing usa a copy padrão (null): a página não muda pra quem chega
 * pelo Google ou digitando o domínio.
 */
export function useOffer(): Offer | null {
  const [params] = useSearchParams()
  const key = params.get(OFFER_PARAM)

  return useMemo(() => {
    if (!isOfferKey(key)) return null
    rememberOffer(key)
    return OFFERS[key]
  }, [key])
}
