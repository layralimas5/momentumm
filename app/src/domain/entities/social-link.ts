import { DomainError } from '@/shared/errors'

/**
 * As redes da pessoa, no perfil.
 *
 * Três, e fixas: Instagram, TikTok e LinkedIn. Uma lista aberta ("adicionar
 * link") viraria árvore de links, e árvore de links é outro produto — o perfil
 * do Momentumm é sobre o que a pessoa está construindo, e as redes estão aqui
 * só pra quem gostou do que viu conseguir continuar acompanhando.
 *
 * O que é guardado é sempre o @ LIMPO, nunca a URL. Quem cola
 * `instagram.com/lay/?igsh=...` está colando o endereço com rastreador dentro;
 * quem digita `@lay` está dizendo a mesma coisa sem ele. A tela mostra o @, e
 * a URL é montada na hora de abrir.
 */

export const SOCIAL_NETWORKS = ['instagram', 'tiktok', 'linkedin'] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

export type SocialLinks = Readonly<Record<SocialNetwork, string | null>>

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  instagram: null,
  tiktok: null,
  linkedin: null,
}

export const SOCIAL_LABELS: Readonly<Record<SocialNetwork, string>> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

/**
 * O sinal que vem antes do nome na tela.
 *
 * O LinkedIn usa `/` porque é assim que o endereço dele se lê
 * (`linkedin.com/in/lay`); escrever `@lay` ali seria um @ que não existe em
 * lugar nenhum daquela rede.
 */
export const SOCIAL_PREFIXES: Readonly<Record<SocialNetwork, string>> = {
  instagram: '@',
  tiktok: '@',
  linkedin: '/',
}

const BASE_URLS: Readonly<Record<SocialNetwork, string>> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  linkedin: 'https://linkedin.com/in/',
}

/** Limite generoso: nenhuma das três aceita nome maior que isso. */
export const SOCIAL_HANDLE_MAX = 40

const ALLOWED = /^[a-zA-Z0-9._-]+$/

/**
 * O que a pessoa colou vira um @.
 *
 * Aceita as três formas que ela vai usar na prática — `@lay`, `lay` e a URL
 * inteira, com ou sem `https://`, com ou sem parâmetros — e devolve sempre
 * `lay`. Campo vazio devolve `null`, que é como "não tenho essa rede" é
 * guardado.
 */
export function normalizeSocialHandle(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  let value = trimmed

  // A URL inteira: fica o último trecho do caminho, sem query nem barra final.
  const urlMatch = /^(?:https?:\/\/)?(?:www\.)?(?:instagram|tiktok|linkedin)\.com\/(.+)$/i.exec(value)
  if (urlMatch?.[1]) {
    value = urlMatch[1]
      .split(/[?#]/)[0]!
      .replace(/\/+$/, '')
      .replace(/^in\//i, '')
  }

  value = value.replace(/^@+/, '').replace(/^\/+/, '')

  if (value === '') return null

  if (value.length > SOCIAL_HANDLE_MAX) {
    throw new DomainError(`O @ pode ter no máximo ${SOCIAL_HANDLE_MAX} caracteres.`)
  }

  if (!ALLOWED.test(value)) {
    throw new DomainError('O @ aceita letras, números, ponto, hífen e underline.')
  }

  return value
}

/** O endereço pra abrir. Montado na hora, a partir do @ guardado. */
export function socialUrl(network: SocialNetwork, handle: string): string {
  return `${BASE_URLS[network]}${handle}`
}

/** O que aparece no chip: `@lay`, `/lay`. */
export function socialDisplay(network: SocialNetwork, handle: string): string {
  return `${SOCIAL_PREFIXES[network]}${handle}`
}

/** Só as redes preenchidas, na ordem fixa. Rede vazia não vira chip vazio. */
export function filledSocials(
  links: SocialLinks,
): readonly { network: SocialNetwork; handle: string }[] {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const handle = links[network]
    return handle ? [{ network, handle }] : []
  })
}
