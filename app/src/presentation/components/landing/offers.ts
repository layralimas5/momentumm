/**
 * As ofertas em teste no TikTok (setembro/2026), e a landing que continua
 * cada conversa.
 *
 * O conteúdo promete uma coisa ("parar de recomeçar toda segunda") e a
 * primeira frase da página tem que ser a MESMA conversa, não uma
 * apresentação de software. Cada oferta tem um link próprio pra bio
 * (`/?oferta=a`), e a página troca só o que é promessa: título, subtítulo e
 * o texto do botão. O resto da landing é igual.
 *
 * A oferta que trouxe a pessoa fica guardada no navegador e vai junto no
 * `onboarding_completed` (`metadata.source`): é assim que se descobre qual
 * ângulo trouxe gente que de fato começou, não só gente que clicou.
 *
 * A oferta troca só a PROMESSA: título, subtítulo e a frase que fecha a
 * página. O botão não entra nessa lista de propósito — a página inteira usa
 * um CTA só ("Criar meu plano"), e três textos diferentes de botão na mesma
 * campanha tornam impossível saber se foi o ângulo ou a palavra do botão que
 * mudou o resultado.
 *
 * Quando a vencedora estiver escolhida, ela vira o `DEFAULT_OFFER` e os
 * links por oferta continuam valendo pra testes seguintes.
 */

export const OFFER_KEYS = ['a', 'b', 'c'] as const
export type OfferKey = (typeof OFFER_KEYS)[number]

export interface Offer {
  readonly key: OfferKey
  /** Nome interno, pra ler no painel. */
  readonly name: string
  /** As linhas do título. A última ganha a cor da marca. */
  readonly lines: readonly [string, string]
  readonly subtitle: string
  /** O título do CTA final da página, que fecha a mesma conversa. */
  readonly closing: string
}

export const OFFERS: Readonly<Record<OfferKey, Offer>> = {
  a: {
    key: 'a',
    name: 'Para quem começa e abandona',
    lines: ['Um sistema pra você parar', 'de recomeçar toda segunda-feira.'],
    subtitle:
      'Não é falta de força de vontade. É plano grande demais pro dia que você tem, e um app que te pune quando falha. O Momentumm monta o plano que cabe e ajusta quando a semana não sai como o planejado.',
    closing: 'A última vez que você recomeça do zero pode ser esta.',
  },
  b: {
    key: 'b',
    name: 'Transformar metas em ações',
    lines: ['Transforme uma meta confusa', 'num plano possível pra começar hoje.'],
    subtitle:
      'Você diz o que quer alcançar, até quando e quanto tempo tem de verdade. O Momentumm quebra isso em etapas, monta as ações e te entrega o primeiro passo, hoje.',
    closing: 'Sua meta já sabe o que quer. Falta o primeiro passo.',
  },
  c: {
    key: 'c',
    name: 'Voltar depois de parar',
    lines: ['Você não precisa começar do zero', 'só porque perdeu alguns dias.'],
    subtitle:
      'Perdeu o ritmo, sumiu uma semana, o plano ficou pra trás. O Modo Retomada pega de onde você parou e monta um retorno que cabe na semana que você tem agora, sem cobrar os dias que passaram.',
    closing: 'Parar faz parte. Voltar é o que conta.',
  },
}

export const OFFER_PARAM = 'oferta'
const STORAGE_KEY = 'momentumm.offer.v1'

export function isOfferKey(value: string | null | undefined): value is OfferKey {
  return value !== null && value !== undefined && (OFFER_KEYS as readonly string[]).includes(value)
}

/** A oferta guardada no navegador, se a pessoa chegou por um link de oferta. */
export function storedOffer(): OfferKey | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isOfferKey(value) ? value : null
  } catch {
    return null
  }
}

export function rememberOffer(key: OfferKey): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // Sem armazenamento a oferta vale só nesta página. Aceitável.
  }
}

/** O valor que vai em `metadata.source` do evento: curto e fechado. */
export function offerSource(key: OfferKey | null): string | null {
  return key ? `oferta_${key}` : null
}
