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
}

export type QuizLinkCodeKey = keyof typeof QUIZ_LINK_CODES

/** A rota curta. O `/criar-meu-plano` continua valendo, pros links já enviados. */
export const QUIZ_SHORT_PATH = '/plano'

export function isQuizLinkCode(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.toLowerCase() in QUIZ_LINK_CODES
}

export function readQuizChannel(params: URLSearchParams): QuizChannel {
  const raw = params.get(CHANNEL_PARAM)?.trim().toLowerCase()
  return (raw ? CHANNEL_ALIASES[raw] : undefined) ?? DEFAULT_QUIZ_CHANNEL
}

/**
 * A origem de um link curto. `content` guarda o próprio código: é ele que
 * separa dois envios do mesmo tema na mesma rede quando um vier do direct e
 * o outro do comentário.
 */
export function attributionForCode(
  code: string | null | undefined,
  channel: QuizChannel = DEFAULT_QUIZ_CHANNEL,
): QuizAttribution | null {
  if (!code) return null
  const entry = QUIZ_LINK_CODES[code.toLowerCase()]
  if (!entry) return null
  return {
    source: entry.source,
    medium: channel,
    campaign: entry.campaign,
    content: code.toLowerCase(),
    theme: entry.theme,
  }
}

/** O link pronto pra copiar, com o canal só quando ele não é o padrão. */
export function quizLinkFor(
  origin: string,
  code: string | null = null,
  channel: QuizChannel = DEFAULT_QUIZ_CHANNEL,
): string {
  const base = `${origin}${QUIZ_SHORT_PATH}${code ? `/${code}` : ''}`
  return channel === DEFAULT_QUIZ_CHANNEL ? base : `${base}?${CHANNEL_PARAM}=${channel}`
}
