import type { MediaKind } from '@/domain/media/media-policy'

export interface StoredMedia {
  /** O caminho no bucket: `<uid>/<tipo>/<id>.<ext>`. É a chave da autorização. */
  readonly path: string
  readonly kind: MediaKind
  readonly mimeType: string
  readonly size: number
}

/**
 * Fotos, áudios e anexos da pessoa, num bucket privado.
 *
 * Nada aqui devolve URL pública: o arquivo só sai por link assinado, curto,
 * pedido na hora de abrir. O dono é sempre a sessão atual — a porta não
 * aceita id de outra pessoa, e a política do Storage recusaria de qualquer
 * jeito.
 */
export interface MediaRepository {
  upload(userId: string, kind: MediaKind, file: Blob): Promise<StoredMedia>
  /** Link temporário pra abrir o arquivo. Expira em minutos. */
  signedUrl(userId: string, path: string): Promise<string>
  remove(userId: string, path: string): Promise<void>
  list(userId: string, kind: MediaKind): Promise<StoredMedia[]>
}
