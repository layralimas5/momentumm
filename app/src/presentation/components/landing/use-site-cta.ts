import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { hasAttribution, readAttribution } from '@/domain/analytics/funnel-events'
import { quizPathFor, QUIZ_SHORT_PATH, type QuizLinkCodeKey } from '@/domain/analytics/quiz-links'
import { useAuth } from '@/presentation/auth/use-auth'
import { CTA } from './site'

export interface SiteLink {
  readonly label: string
  readonly to: string
}

export interface SiteCta {
  /** Sessão aberta neste navegador. */
  readonly signedIn: boolean
  /** O botão principal da página: cria o plano, ou abre o app pra quem já tem. */
  readonly primary: SiteLink
  /** A porta discreta de login. Null com sessão aberta: não há o que entrar. */
  readonly entry: SiteLink | null
}

const OPEN_APP: SiteLink = { label: 'Abrir o app', to: '/app' }
const ENTRY: SiteLink = { label: 'Entrar', to: '/entrar' }

/**
 * Os CTAs da landing conhecem a sessão e o lugar de onde foram clicados.
 *
 * Quem já tem conta volta pra página inicial o tempo todo (favorito, link
 * salvo, o próprio domínio digitado), e mandar essa pessoa pro quiz de novo é
 * fazer ela montar um plano que já existe. Com sessão aberta, todo botão
 * principal vira "Abrir o app" e a entrada some.
 *
 * ## Qual origem o botão leva
 *
 * O `code` é o lugar da página (`lp-hero`, `lp-precos`...) e vira `utm_*` no
 * funil. Mas ele só entra quando a pessoa chegou SEM origem: no quiz, o
 * código do link vence os `utm_*` da URL (`use-quiz.ts`), então usar o código
 * em cima de alguém que veio de um carrossel trocaria "instagram, carrossel
 * 07" por "site, hero" e apagaria justamente a informação que decide o
 * conteúdo.
 *
 * Com origem na URL, o botão leva ela adiante e o lugar do clique fica
 * guardado do outro jeito: pelos eventos `hero_cta_clicked` e
 * `pricing_cta_clicked`, na mesma sessão.
 */
export function useSiteCta(code: QuizLinkCodeKey = 'lp-hero'): SiteCta {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const signedIn = !loading && user !== null

  const quizTo = useMemo(() => {
    const attribution = readAttribution(params)
    if (!hasAttribution(attribution)) return quizPathFor(code)

    const forward = new URLSearchParams()
    if (attribution.source) forward.set('utm_source', attribution.source)
    if (attribution.medium) forward.set('utm_medium', attribution.medium)
    if (attribution.campaign) forward.set('utm_campaign', attribution.campaign)
    if (attribution.content) forward.set('utm_content', attribution.content)
    if (attribution.theme) forward.set('tema', attribution.theme)
    return `${QUIZ_SHORT_PATH}?${forward.toString()}`
  }, [code, params])

  return {
    signedIn,
    primary: signedIn ? OPEN_APP : { label: CTA.primary.label, to: quizTo },
    entry: signedIn ? null : ENTRY,
  }
}
