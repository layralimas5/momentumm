import { DomainError } from '@/shared/errors'

/**
 * O story: o que vale contar hoje e não vale guardar.
 *
 * As 24 horas não são um detalhe de produto, são o que separa story de
 * publicação. Publicação entra no calendário e vira memória; story é o
 * intervalo entre uma coisa e outra, e some justamente pra não virar arquivo.
 *
 * O prazo é do BANCO (`expires_at` entra na política de leitura), nunca do
 * cliente: filtro de tela é conveniência, e um relógio errado no aparelho não
 * pode ressuscitar o que venceu.
 */

export const STORY_KINDS = ['imagem', 'video'] as const
export type StoryKind = (typeof STORY_KINDS)[number]

export const STORY_HOURS = 24
export const MAX_STORY_CAPTION = 200
/** Quinze segundos: passado disso o arquivo cresce e a atenção não acompanha. */
export const MAX_STORY_VIDEO_SECONDS = 15

export interface Story {
  readonly id: string
  readonly userId: string
  readonly path: string
  readonly kind: StoryKind
  readonly caption: string | null
  readonly width: number | null
  readonly height: number | null
  readonly createdAt: Date
  readonly expiresAt: Date
  /** Eu já vi este. */
  readonly seen: boolean
  /** Quantas pessoas viram. Só chega preenchido pro dono. */
  readonly views: number
}

/** Uma pessoa na bandeja de stories. */
export interface StoryRing {
  readonly userId: string
  readonly name: string
  readonly handle: string
  readonly avatarUrl: string | null
  readonly total: number
  readonly unseen: number
  readonly latest: Date
}

export interface NewStoryInput {
  readonly userId: string
  readonly path: string
  readonly kind: StoryKind
  readonly caption: string | null
  readonly width: number | null
  readonly height: number | null
}

export function assertValidStoryCaption(caption: string | null): void {
  if (caption && caption.trim().length > MAX_STORY_CAPTION) {
    throw new DomainError(`A legenda do story pode ter no máximo ${MAX_STORY_CAPTION} caracteres.`)
  }
}

/** Ainda no ar. A tela usa pra não desenhar o que o servidor já não devolve. */
export function isLive(story: Story, now = new Date()): boolean {
  return story.expiresAt.getTime() > now.getTime()
}

/**
 * Quanto falta, em palavras curtas: "23 h", "40 min", "acabando".
 *
 * Só aparece pro dono, no próprio story. Pra quem vê, o tempo restante do
 * story dos outros é informação que não muda nada.
 */
export function timeLeftLabel(story: Story, now = new Date()): string {
  const minutes = Math.floor((story.expiresAt.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return 'acabou'
  if (minutes < 10) return 'acabando'
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h`
}

/**
 * A ordem da bandeja: quem tem coisa nova primeiro, depois o resto, cada
 * grupo do mais recente pro mais antigo.
 *
 * O próprio usuário não entra aqui: ele é sempre o primeiro item, e a tela
 * cuida disso. Ordenar a si mesmo junto com os outros faria a própria pessoa
 * mudar de lugar conforme os amigos postassem.
 */
export function sortRings(rings: readonly StoryRing[]): StoryRing[] {
  return [...rings].sort((a, b) => {
    const unseenA = a.unseen > 0 ? 0 : 1
    const unseenB = b.unseen > 0 ? 0 : 1
    if (unseenA !== unseenB) return unseenA - unseenB
    return b.latest.getTime() - a.latest.getTime()
  })
}
