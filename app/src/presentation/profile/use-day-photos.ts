import { useCallback, useEffect, useState } from 'react'
import type { DayKey } from '@/domain/entities/day'
import type { DayPhoto } from '@/domain/entities/day-photo'
import { photosByDay } from '@/domain/entities/day-photo'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { downscaleToDayPhoto, downscaleToDayPhotoDataUrl } from './downscale-image'

/**
 * O álbum de um intervalo, pronto pro calendário.
 *
 * Duas coisas acontecem aqui, e elas são diferentes de propósito:
 *
 *   as LINHAS   vêm do `DayPhotoRepository`, dia e caminho, nada mais.
 *   as IMAGENS  vêm do `MediaRepository`, por link assinado que expira em
 *               minutos, pedido uma vez por foto e guardado em memória
 *               enquanto a tela está aberta.
 *
 * Assinar trinta links de uma vez, na abertura do mês, é uma escolha: dá uma
 * rajada de chamadas em vez de trinta esperas espalhadas, e a imagem aparece
 * junto com a célula em vez de piscar depois dela.
 */
export interface DayPhotosView {
  readonly photos: ReadonlyMap<DayKey, DayPhoto>
  /** A URL pra exibir, por dia. Vazia enquanto o link não chegou. */
  readonly urls: ReadonlyMap<DayKey, string>
  readonly loading: boolean
  readonly error: string | null
  readonly saving: boolean
  /** Escolheu uma imagem: ela é reduzida, guardada e trocada no dia. */
  save(day: DayKey, file: File): Promise<void>
  remove(day: DayKey): Promise<void>
}

export function useDayPhotos(from: DayKey, to: DayKey): DayPhotosView {
  const { profile } = useAuth()
  const userId = profile?.id ?? null

  const [photos, setPhotos] = useState<ReadonlyMap<DayKey, DayPhoto>>(new Map())
  const [urls, setUrls] = useState<ReadonlyMap<DayKey, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(
    async (list: readonly DayPhoto[]) => {
      if (!userId) return new Map<DayKey, string>()

      const pairs = await Promise.all(
        list.map(async (photo) => {
          try {
            return [photo.day, await displayUrl(userId, photo.path)] as const
          } catch {
            // Link vencido ou arquivo apagado por fora: a célula fica sem foto,
            // e o dia continua marcado. Foto quebrada é pior que dia sem foto.
            return null
          }
        }),
      )

      return new Map(pairs.filter((pair): pair is readonly [DayKey, string] => pair !== null))
    },
    [userId],
  )

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const list = await container.dayPhotos.listBetween(userId, from, to)
      setPhotos(photosByDay(list))
      setUrls(await resolve(list))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não consegui carregar as fotos.')
    } finally {
      setLoading(false)
    }
  }, [userId, from, to, resolve])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (day: DayKey, file: File) => {
      if (!userId) return
      setSaving(true)
      setError(null)
      try {
        const path = await storeFile(userId, file)
        const photo = await container.dayPhotos.save({ userId, day, path })
        const url = await displayUrl(userId, path)

        setPhotos((current) => new Map(current).set(day, photo))
        setUrls((current) => new Map(current).set(day, url))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não consegui guardar essa foto.')
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const remove = useCallback(
    async (day: DayKey) => {
      if (!userId) return
      setSaving(true)
      setError(null)
      try {
        await container.dayPhotos.remove(userId, day)
        setPhotos((current) => {
          const next = new Map(current)
          next.delete(day)
          return next
        })
        setUrls((current) => {
          const next = new Map(current)
          next.delete(day)
          return next
        })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não consegui tirar essa foto.')
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  return { photos, urls, loading, error, saving, save, remove }
}

/**
 * Onde o arquivo fica, e é a única diferença entre os dois mundos.
 *
 * Com Supabase, a imagem sobe pro bucket privado e o que é guardado na linha é
 * o CAMINHO. No modo demo não existe bucket que sobreviva a um reload, o
 * repositório de mídia guarda os arquivos em memória, então a imagem vira
 * data URL e mora na própria linha, que é o que o armazenamento local
 * consegue devolver depois.
 */
async function storeFile(userId: string, file: File): Promise<string> {
  if (container.demo) return downscaleToDayPhotoDataUrl(file)

  const blob = await downscaleToDayPhoto(file)
  const stored = await container.media.upload(userId, 'fotos', blob)
  return stored.path
}

/** Data URL do demo abre direto; caminho de bucket precisa de link assinado. */
async function displayUrl(userId: string, path: string): Promise<string> {
  if (path.startsWith('data:')) return path
  return container.media.signedUrl(userId, path)
}
