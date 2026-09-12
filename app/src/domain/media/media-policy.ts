import { DomainError } from '@/shared/errors'

/**
 * O que o bucket `user-media` aceita, espelhado do banco (migration 0020).
 *
 * A checagem aqui é a primeira, não a única: o Storage recusa pelo
 * `allowed_mime_types` e a política de insert confere o tipo de novo. O
 * cliente valida antes pra falhar com uma frase útil em vez de um 400.
 */
export const MEDIA_KINDS = ['fotos', 'audios', 'anexos'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_MIME_TYPES: Readonly<Record<MediaKind, readonly string[]>> = {
  fotos: ['image/jpeg', 'image/png', 'image/webp'],
  audios: ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'],
  anexos: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
}

export const MEDIA_MAX_BYTES: Readonly<Record<MediaKind, number>> = {
  fotos: 5 * 1024 * 1024,
  audios: 10 * 1024 * 1024,
  anexos: 10 * 1024 * 1024,
}

/** Quantos uploads por hora o banco aceita por conta. */
export const MEDIA_UPLOADS_PER_HOUR = 60

/** Quanto tempo um link assinado vale. Curto: é pra abrir agora, não pra guardar. */
export const MEDIA_SIGNED_URL_SECONDS = 5 * 60

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
}

export interface MediaUploadInput {
  readonly kind: MediaKind
  readonly mimeType: string
  readonly size: number
}

export function assertMediaAllowed(input: MediaUploadInput): void {
  if (!MEDIA_MIME_TYPES[input.kind].includes(input.mimeType)) {
    throw new DomainError(`Esse tipo de arquivo não é aceito em ${input.kind}.`)
  }
  if (input.size <= 0) {
    throw new DomainError('O arquivo está vazio.')
  }
  if (input.size > MEDIA_MAX_BYTES[input.kind]) {
    const mb = Math.round(MEDIA_MAX_BYTES[input.kind] / (1024 * 1024))
    throw new DomainError(`O arquivo passa de ${mb}MB.`)
  }
}

/**
 * O caminho no bucket: `<uid>/<tipo>/<id>.<ext>`. O primeiro segmento É a
 * autorização (a política compara com `auth.uid()`), o segundo é o tipo que a
 * política também confere, e o nome é um id — nunca o nome original do
 * arquivo, que carrega o que a pessoa digitou no computador dela.
 */
export function mediaPath(userId: string, kind: MediaKind, mimeType: string, id: string): string {
  const extension = EXTENSIONS[mimeType]
  if (!extension) throw new DomainError('Esse tipo de arquivo não é aceito.')
  return `${userId}/${kind}/${id}.${extension}`
}

/** Só o dono da pasta pode pedir link pra ela. A RLS repete; aqui é o aviso cedo. */
export function assertOwnsMediaPath(userId: string, path: string): void {
  if (!path.startsWith(`${userId}/`) || path.includes('..')) {
    throw new DomainError('Esse arquivo não é seu.')
  }
}
