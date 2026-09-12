import {
  assertMediaAllowed,
  assertOwnsMediaPath,
  MEDIA_SIGNED_URL_SECONDS,
  mediaPath,
  type MediaKind,
} from '@/domain/media/media-policy'
import type { MediaRepository, StoredMedia } from '@/domain/repositories/media-repository'
import { DomainError, InfrastructureError } from '@/shared/errors'
import { supabase } from './client'

const BUCKET = 'user-media'

/**
 * O bucket `user-media`, privado (migrations 0014 e 0020).
 *
 * O caminho começa pelo id da pessoa e a política compara esse prefixo com
 * `auth.uid()`: enviar, listar, apagar e assinar link só funcionam dentro da
 * própria pasta. Tipo e tamanho são checados aqui (mensagem útil), no bucket
 * (`allowed_mime_types`, `file_size_limit`) e na política de insert.
 */
export class SupabaseMediaRepository implements MediaRepository {
  async upload(userId: string, kind: MediaKind, file: Blob): Promise<StoredMedia> {
    assertMediaAllowed({ kind, mimeType: file.type, size: file.size })
    const path = mediaPath(userId, kind, file.type, crypto.randomUUID())

    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
      // A política recusa por ritmo (60/h), tipo ou pasta; o bucket, por tamanho.
      // A mensagem do Storage não distingue, e a tela não precisa do detalhe.
      throw new DomainError('O arquivo não foi aceito. Confere o tipo, o tamanho e tenta de novo em instantes.')
    }
    return { path, kind, mimeType: file.type, size: file.size }
  }

  async signedUrl(userId: string, path: string): Promise<string> {
    assertOwnsMediaPath(userId, path)
    const { data, error } = await supabase()
      .storage.from(BUCKET)
      .createSignedUrl(path, MEDIA_SIGNED_URL_SECONDS)
    if (error || !data) throw new InfrastructureError('Não consegui abrir o arquivo.', error)
    return data.signedUrl
  }

  async remove(userId: string, path: string): Promise<void> {
    assertOwnsMediaPath(userId, path)
    const { error } = await supabase().storage.from(BUCKET).remove([path])
    if (error) throw new InfrastructureError('Não consegui apagar o arquivo.', error)
  }

  async list(userId: string, kind: MediaKind): Promise<StoredMedia[]> {
    const prefix = `${userId}/${kind}`
    const { data, error } = await supabase().storage.from(BUCKET).list(prefix, { limit: 200 })
    if (error) throw new InfrastructureError('Não consegui listar os arquivos.', error)
    return (data ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        path: `${prefix}/${item.name}`,
        kind,
        mimeType: String(item.metadata?.['mimetype'] ?? ''),
        size: Number(item.metadata?.['size'] ?? 0),
      }))
  }
}
