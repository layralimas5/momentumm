import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'
import {
  hasAttribution,
  readAttribution,
  type FunnelEventName,
} from '@/domain/analytics/funnel-events'
import { trackFunnel } from '@/infrastructure/analytics/funnel'

/**
 * A landing dentro do funil que já existe.
 *
 * Não é uma segunda instrumentação: é o mesmo `trackFunnel`, a mesma sessão
 * no navegador e a mesma tabela do quiz. O ganho é o vínculo — a visita, o
 * clique no botão e o quiz caem na MESMA linha, então o painel consegue dizer
 * qual origem trouxe alguém que de fato começou, e não só quem clicou.
 *
 * Os `utm_*` são lidos da URL a cada disparo em vez de guardados num estado:
 * a pessoa pode chegar na página por um link com origem e só clicar no botão
 * três minutos depois, e a origem precisa ser a mesma nos dois eventos.
 */
export type LandingEvent = Extract<
  FunnelEventName,
  | 'landing_viewed'
  | 'hero_cta_clicked'
  | 'secondary_cta_clicked'
  | 'pricing_viewed'
  | 'pricing_cta_clicked'
  | 'faq_opened'
>

/**
 * Eventos que valem uma vez por carregamento. Sem isso, "abriu o preço" seria
 * disparado a cada rolagem de volta, e a taxa entre ver o preço e clicar
 * passaria de 100%.
 */
const fired = new Set<LandingEvent>()

function currentAttribution() {
  try {
    const value = readAttribution(new URLSearchParams(window.location.search))
    return hasAttribution(value) ? value : null
  } catch {
    return null
  }
}

export function trackLanding(event: LandingEvent): void {
  trackFunnel(event, null, currentAttribution())
}

export function trackLandingOnce(event: LandingEvent): void {
  if (fired.has(event)) return
  fired.add(event)
  trackLanding(event)
}

/** A visita. Dispara uma vez, mesmo com o duplo render do modo estrito. */
export function useLandingView(): void {
  useEffect(() => {
    trackLandingOnce('landing_viewed')
  }, [])
}

/**
 * "A pessoa chegou a ver esta seção." Devolve a ref pra pendurar no elemento.
 * O limiar é de um quarto: seção que só passou raspando no fim da rolagem não
 * foi vista.
 */
export function useSectionView(event: LandingEvent) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.25 })

  useEffect(() => {
    if (inView) trackLandingOnce(event)
  }, [inView, event])

  return ref
}
