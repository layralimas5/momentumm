import type { QuizThemeKey } from '@/domain/entities/quiz'
import type { QuizAttribution } from './funnel-events'

/**
 * Os links curtos do quiz: `/plano` e `/plano/<codigo>`.
 *
 * O link é o que vai na resposta de um comentário, no direct e na bio, então
 * ele precisa caber numa linha e ser ditável em voz alta. Montar `utm_*` na
 * mão pra cada envio produziria o de sempre — `utm_medium` escrito de três
 * jeitos, e um funil que não fecha. Aqui o código curto é a única coisa que
 * circula, e a origem completa sai desta tabela.
 *
 * Código novo se cria acrescentando uma linha. Código que não existe não dá
 * erro: o quiz abre sem origem, porque um link errado numa campanha não pode
 * virar uma página de erro.
 */

/** De onde o link foi enviado. Vira o `utm_medium`. */
export const QUIZ_CHANNELS = ['comentario', 'dm', 'bio'] as const
export type QuizChannel = (typeof QUIZ_CHANNELS)[number]

/**
 * O canal padrão é o comentário: é o caso que gerou os links curtos (responder
 * quem comentou a CTA), e é o único em que a URL fica visível pra todo mundo.
 */
export const DEFAULT_QUIZ_CHANNEL: QuizChannel = 'comentario'

/** `?c=dm` no fim do link. Curto porque o link do direct também é lido. */
const CHANNEL_PARAM = 'c'

const CHANNEL_ALIASES: Readonly<Record<string, QuizChannel>> = {
  c: 'comentario',
  com: 'comentario',
  comentario: 'comentario',
  dm: 'dm',
  bio: 'bio',
}

interface QuizLinkCode {
  /** `utm_source`: a rede de onde a pessoa veio. */
  readonly source: string
  /**
   * `utm_medium` fixo do código, quando ele não vem de envio manual — é o
   * caso dos botões da própria landing, que não são comentário nem direct.
   * `?c=` continua vencendo, pra um link ser reaproveitado em outro canal.
   */
  readonly medium?: string
  /** `utm_campaign`: o assunto que trouxe ela, pra somar os envios do mesmo tema. */
  readonly campaign: string
  /** O tema troca o título e a introdução do quiz. Sem tema, a copy é a padrão. */
  readonly theme: QuizThemeKey | null
  /** Pra que serve, na lista de links que a Lay copia. */
  readonly note: string
}

/**
 * Os códigos são `<rede>-<assunto>`, curtos de propósito: eles aparecem na
 * URL que vai no comentário público.
 */
export const QUIZ_LINK_CODES: Readonly<Record<string, QuizLinkCode>> = {
  'ig-proc': {
    source: 'instagram',
    campaign: 'procrastinacao',
    theme: 'procrastinacao',
    note: 'Instagram, post sobre adiar/procrastinação',
  },
  'ig-const': {
    source: 'instagram',
    campaign: 'constancia',
    theme: 'constancia',
    note: 'Instagram, post sobre recomeçar toda segunda',
  },
  'ig-tempo': {
    source: 'instagram',
    campaign: 'tempo',
    theme: 'tempo',
    note: 'Instagram, post sobre falta de tempo',
  },
  'ig-comeco': {
    source: 'instagram',
    campaign: 'comeco',
    theme: 'comeco',
    note: 'Instagram, post sobre não saber por onde começar',
  },
  'ig-foco': {
    source: 'instagram',
    campaign: 'foco',
    theme: 'foco',
    note: 'Instagram, post sobre fazer coisa demais ao mesmo tempo',
  },
  'ig-bio': {
    source: 'instagram',
    campaign: 'bio',
    theme: null,
    note: 'Instagram, link da bio (copy padrão)',
  },
  'tt-proc': {
    source: 'tiktok',
    campaign: 'procrastinacao',
    theme: 'procrastinacao',
    note: 'TikTok, vídeo sobre adiar/procrastinação',
  },
  'tt-const': {
    source: 'tiktok',
    campaign: 'constancia',
    theme: 'constancia',
    note: 'TikTok, vídeo sobre recomeçar toda segunda',
  },
  'tt-tempo': {
    source: 'tiktok',
    campaign: 'tempo',
    theme: 'tempo',
    note: 'TikTok, vídeo sobre falta de tempo',
  },
  'tt-comeco': {
    source: 'tiktok',
    campaign: 'comeco',
    theme: 'comeco',
    note: 'TikTok, vídeo sobre não saber por onde começar',
  },
  'tt-foco': {
    source: 'tiktok',
    campaign: 'foco',
    theme: 'foco',
    note: 'TikTok, vídeo sobre fazer coisa demais ao mesmo tempo',
  },
  'tt-bio': {
    source: 'tiktok',
    campaign: 'bio',
    theme: null,
    note: 'TikTok, link do perfil (copy padrão)',
  },
  /*
    Os botões da própria landing entram pelo mesmo caminho: sem código, quem
    vem do site cai como "direto" no funil e some junto com quem digitou o
    endereço. Cada lugar da página tem o próprio código, porque a pergunta
    que decide a copy é ONDE a pessoa se convenceu: no hero, depois de ver o
    preço, ou só na barra do celular depois de rolar tudo.
  */
  'lp-hero': {
    source: 'site',
    medium: 'landing',
    campaign: 'hero',
    theme: null,
    note: 'Botão do hero da landing',
  },
  'lp-fim': {
    source: 'site',
    medium: 'landing',
    campaign: 'cta-final',
    theme: null,
    note: 'Botão do CTA final da landing',
  },
  'lp-retomada': {
    source: 'site',
    medium: 'landing',
    campaign: 'retomada',
    theme: null,
    note: 'Botão da seção de dia adaptável e retomada',
  },
  'lp-header': {
    source: 'site',
    medium: 'landing',
    campaign: 'header',
    theme: null,
    note: 'Botão fixo do topo da landing',
  },
  'lp-precos': {
    source: 'site',
    medium: 'landing',
    campaign: 'precos',
    theme: null,
    note: 'Botão do plano gratuito, na seção de planos',
  },
  'lp-barra': {
    source: 'site',
    medium: 'landing',
    campaign: 'barra-celular',
    theme: null,
    note: 'Barra fixa do rodapé no celular',
  },
  'lp-rodape': {
    source: 'site',
    medium: 'landing',
    campaign: 'rodape',
    theme: null,
    note: 'Botão do rodapé da landing',
  },
}

export type QuizLinkCodeKey = keyof typeof QUIZ_LINK_CODES

/** A rota curta. O `/criar-meu-plano` continua valendo, pros links já enviados. */
export const QUIZ_SHORT_PATH = '/plano'

export function isQuizLinkCode(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.toLowerCase() in QUIZ_LINK_CODES
}

/** O canal pedido na URL, ou `null` quando o link não disse nada. */
export function readQuizChannel(params: URLSearchParams): QuizChannel | null {
  const raw = params.get(CHANNEL_PARAM)?.trim().toLowerCase()
  return (raw ? CHANNEL_ALIASES[raw] : undefined) ?? null
}

/**
 * A origem de um link curto. `content` guarda o próprio código: é ele que
 * separa dois envios do mesmo tema na mesma rede quando um vier do direct e
 * o outro do comentário.
 */
export function attributionForCode(
  code: string | null | undefined,
  channel: QuizChannel | null = null,
): QuizAttribution | null {
  if (!code) return null
  const entry = QUIZ_LINK_CODES[code.toLowerCase()]
  if (!entry) return null
  return {
    source: entry.source,
    medium: channel ?? entry.medium ?? DEFAULT_QUIZ_CHANNEL,
    campaign: entry.campaign,
    content: code.toLowerCase(),
    theme: entry.theme,
  }
}

/** O caminho interno do quiz com o código, pros botões da própria landing. */
export function quizPathFor(code: string): string {
  return `${QUIZ_SHORT_PATH}/${code}`
}

/** O link pronto pra copiar, com o canal só quando ele não é o padrão. */
export function quizLinkFor(
  origin: string,
  code: string | null = null,
  channel: QuizChannel | null = null,
): string {
  const base = `${origin}${QUIZ_SHORT_PATH}${code ? `/${code}` : ''}`
  return channel === null || channel === DEFAULT_QUIZ_CHANNEL
    ? base
    : `${base}?${CHANNEL_PARAM}=${channel}`
}
