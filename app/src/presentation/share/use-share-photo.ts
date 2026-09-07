import { useCallback, useEffect, useRef, useState } from 'react'
import type { SharePhoto } from './render/render-share-card'

/**
 * A foto de fundo do card.
 *
 * Ela NUNCA sai do aparelho. O arquivo é lido pelo navegador, desenhado no
 * canvas e vira parte do PNG — não existe upload, não existe bucket, o servidor
 * do Momentumm não fica sabendo que a foto existiu. É a mesma promessa do resto
 * do Share Studio, e aqui ela importa mais: a foto é do quarto, do treino, do
 * rosto da pessoa.
 *
 * A decodificação acontece uma vez e o resultado fica guardado, porque o
 * preview redesenha a cada toque em toggle e decodificar um JPEG de 12
 * megapixels a cada quadro travaria a tela do celular.
 */

export interface SharePhotoState {
  readonly photo: SharePhoto | null
  readonly loading: boolean
  readonly error: string | null
  choose(file: File): Promise<void>
  clear(): void
}

/** Acima disso é foto de câmera profissional: decodificar trava o aparelho. */
const MAX_BYTES = 25 * 1024 * 1024

export function useSharePhoto(): SharePhotoState {
  const [photo, setPhoto] = useState<SharePhoto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  // Sem isso, cada foto trocada deixa um blob preso na memória da aba até a
  // pessoa fechar o app.
  useEffect(() => revoke, [revoke])

  const clear = useCallback(() => {
    revoke()
    setPhoto(null)
    setError(null)
  }, [revoke])

  const choose = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Esse arquivo não é uma imagem.')
        return
      }
      if (file.size > MAX_BYTES) {
        setError('Essa imagem é grande demais. Tenta uma foto menor.')
        return
      }

      setLoading(true)
      setError(null)
      revoke()

      const url = URL.createObjectURL(file)
      urlRef.current = url

      try {
        /*
          `Image` em vez de `createImageBitmap`: o navegador aplica a orientação
          do EXIF sozinho ao carregar a tag, e foto de celular vem deitada com
          muita frequência. Com o bitmap cru, metade dos cards sairia de lado.
        */
        const image = await loadImage(url)
        setPhoto({ image, width: image.naturalWidth, height: image.naturalHeight })
      } catch {
        revoke()
        setPhoto(null)
        setError('Não consegui abrir essa imagem. Tenta outra.')
      } finally {
        setLoading(false)
      }
    },
    [revoke],
  )

  return { photo, loading, error, choose, clear }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('imagem inválida')))
    image.src = url
  })
}
