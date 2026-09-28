import { DomainError } from '@/shared/errors'
import type { DayKey } from './day'
import { dayKeyOf } from './day'

/**
 * A publicação.
 *
 * É o que a camada de momentos (`journey-event`) não era: aquilo é o que o
 * APP percebeu sozinho — dia fechado, objetivo avançado, marco alcançado. Isto
 * é o que a PESSOA quis contar, com a foto e as palavras dela.
 *
 * As duas convivem, e não se misturam. Momento continua alimentando o Share
 * Studio e o Círculo; publicação alimenta o Feed, o perfil e o calendário.
 * Fundir as duas faria o feed encher de "hábito concluído" automático, que é
 * exatamente o feed que ninguém lê.
 *
 * ## O dia é escolhido, não deduzido
 *
 * `day` não sai do `createdAt`. Quem publica 00:40 de quarta está quase sempre
 * contando a terça, e quem viaja muda de fuso sem mudar de vida. O dia é o que
 * o calendário do perfil usa, então ele precisa ser o dia da PESSOA.
 *
 * ## O progresso é congelado
 *
 * `progress` guarda o par (feito, alvo) do momento em que a publicação nasceu.
 * Ler o objetivo hoje pra desenhar um card de dois meses atrás reescreveria o
 * que ela contou: "dia 8 de 30" viraria "dia 30 de 30" no dia em que ela
 * terminasse, e a publicação deixaria de dizer o que dizia.
 */

export const POST_VISIBILITIES = ['seguidores', 'privada'] as const
export type PostVisibility = (typeof POST_VISIBILITIES)[number]

export const POST_VISIBILITY_LABELS: Readonly<Record<PostVisibility, string>> = {
  seguidores: 'Quem me acompanha',
  privada: 'Só eu',
}

export const POST_VISIBILITY_HINTS: Readonly<Record<PostVisibility, string>> = {
  seguidores:
    'Vale a regra do teu perfil: aberto, qualquer pessoa vê; fechado, só quem você aceitou.',
  privada: 'Não aparece pra ninguém. Continua no teu calendário e no teu perfil, só pra você.',
}

export const DEFAULT_POST_VISIBILITY: PostVisibility = 'seguidores'

export const MAX_CAPTION_LENGTH = 2200
export const MAX_POST_PHOTOS = 10

export interface PostMedia {
  readonly id: string
  /** Caminho no bucket privado `social-media`. Nunca uma URL pública. */
  readonly path: string
  readonly position: number
  /** Medidas reais da imagem, pro feed reservar o espaço antes de ela chegar. */
  readonly width: number | null
  readonly height: number | null
}

/**
 * O progresso congelado: "1.240 de 1.800 páginas".
 *
 * A unidade vem junto porque o objetivo não é legível por quem vê a
 * publicação: a RLS de `objectives` é de dono puro, e nome de objetivo é texto
 * escrito pela pessoa. Sem ela, o card de terceiros mostraria dois números
 * soltos.
 */
export interface PostProgress {
  readonly done: number
  readonly goal: number
  /** No plural: "páginas", "minutos". `null` mostra só os números. */
  readonly unit: string | null
}

export interface PostAuthor {
  readonly id: string
  readonly name: string
  readonly handle: string
  readonly avatarUrl: string | null
}

export interface Post {
  readonly id: string
  readonly author: PostAuthor
  readonly caption: string | null
  readonly day: DayKey
  readonly visibility: PostVisibility
  readonly objectiveId: string | null
  /**
   * O título do objetivo. Só vem preenchido pra o AUTOR: a RLS de `objectives`
   * é de dono puro, e nome de objetivo é texto escrito pela pessoa. Pra quem
   * vê de fora, o que conta a história é a legenda.
   */
  readonly objectiveTitle: string | null
  readonly progress: PostProgress | null
  readonly media: readonly PostMedia[]
  readonly likeCount: number
  readonly commentCount: number
  readonly liked: boolean
  readonly saved: boolean
  readonly createdAt: Date
  readonly editedAt: Date | null
}

export interface NewPostInput {
  readonly userId: string
  readonly caption: string | null
  readonly day: DayKey
  readonly visibility: PostVisibility
  readonly objectiveId: string | null
  readonly progress: PostProgress | null
}

export function assertValidCaption(caption: string | null): void {
  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    throw new DomainError(`A legenda pode ter no máximo ${MAX_CAPTION_LENGTH} caracteres.`)
  }
}

export function assertDayNotAhead(day: DayKey): void {
  if (day > dayKeyOf(new Date())) {
    throw new DomainError('Dá pra publicar sobre hoje ou sobre um dia que já passou.')
  }
}

export const MAX_PROGRESS_UNIT = 24

export function assertValidProgress(progress: PostProgress | null): void {
  if (!progress) return
  if (progress.unit && progress.unit.length > MAX_PROGRESS_UNIT) {
    throw new DomainError('A unidade do progresso é longa demais.')
  }
  if (!Number.isInteger(progress.done) || !Number.isInteger(progress.goal)) {
    throw new DomainError('O progresso precisa ser um número inteiro.')
  }
  if (progress.goal <= 0 || progress.done < 0 || progress.done > progress.goal) {
    throw new DomainError('O progresso precisa ficar entre zero e o alvo.')
  }
}

export function assertValidPost(input: NewPostInput): void {
  assertValidCaption(input.caption)
  assertDayNotAhead(input.day)
  assertValidProgress(input.progress)
}

export function assertPhotoCount(count: number): void {
  if (count < 1) {
    throw new DomainError('Escolhe pelo menos uma foto.')
  }
  if (count > MAX_POST_PHOTOS) {
    throw new DomainError(`Dá pra publicar até ${MAX_POST_PHOTOS} fotos de uma vez.`)
  }
}

/**
 * "1.240 de 1.800 páginas".
 *
 * A frase é da entidade e não do componente porque o card do feed, a grade do
 * perfil e o visualizador do calendário mostram a mesma coisa. Três cópias
 * divergiriam no dia em que alguém achasse que "1240/1800" fica melhor.
 *
 * É a mesma construção que o Share Studio já usa no card de imagem, de
 * propósito: a publicação e a imagem compartilhada contam o mesmo avanço, e
 * duas frases diferentes pro mesmo número fariam a pessoa conferir qual está
 * certa.
 */
export function progressLabel(progress: PostProgress | null): string | null {
  if (!progress) return null
  const numbers = `${format(progress.done)} de ${format(progress.goal)}`
  return progress.unit ? `${numbers} ${progress.unit}` : numbers
}

/** Percentual inteiro, pro anel e pra barra. */
export function progressRatio(progress: PostProgress | null): number {
  if (!progress || progress.goal <= 0) return 0
  return Math.min(1, progress.done / progress.goal)
}

function format(value: number): string {
  return value.toLocaleString('pt-BR')
}

/** A capa: a primeira foto. É ela que vira a célula do calendário e da grade. */
export function coverOf(post: Post): PostMedia | null {
  return post.media[0] ?? null
}

/**
 * O relógio do feed: "agora", "12 min", "3 h", "ontem", "12 set".
 *
 * Curto de propósito. A data completa fica no `title` e no rótulo do leitor de
 * tela; no card ela roubaria a linha do nome.
 */
export function shortAgo(created: Date, now = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000))
  if (seconds < 60) return 'agora'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `${days} d`

  return created.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}
