import { useAuth } from '@/presentation/auth/use-auth'
import { CTA } from './site'

export interface SiteLink {
  readonly label: string
  readonly to: string
}

export interface SiteCta {
  /** Sessão aberta neste navegador. */
  readonly signedIn: boolean
  /** O botão principal da página: cria conta, ou abre o app pra quem já tem. */
  readonly primary: SiteLink
  /** A porta discreta de login. Null com sessão aberta: não há o que entrar. */
  readonly entry: SiteLink | null
}

const OPEN_APP: SiteLink = { label: 'Abrir o app', to: '/app' }
const ENTRY: SiteLink = { label: 'Entrar', to: '/entrar' }

/**
 * Os CTAs da landing conhecem a sessão.
 *
 * Quem já tem conta volta pra página inicial o tempo todo (favorito, link
 * salvo, o próprio domínio digitado), e mandar essa pessoa pro formulário de
 * login de novo é fazer ela entrar duas vezes. Com sessão aberta, todo botão
 * principal vira "Abrir o app" e a entrada some.
 */
export function useSiteCta(): SiteCta {
  const { user, loading } = useAuth()
  const signedIn = !loading && user !== null

  return {
    signedIn,
    primary: signedIn ? OPEN_APP : CTA.primary,
    entry: signedIn ? null : ENTRY,
  }
}
