import { DomainError } from '@/shared/errors'

/**
 * As primitivas de imagem do app, num lugar só.
 *
 * Elas nasceram dentro de `presentation/profile/downscale-image`, que cuidava
 * de avatar, capa e foto do dia. Quando a publicação e o story passaram a
 * preparar imagem também, copiar `loadImage` e `toBlob` pra lá teria criado
 * duas versões da mesma leitura de EXIF e da mesma conversão — e elas
 * divergiriam na primeira vez que alguém corrigisse um bug numa só.
 */

/** Teto do arquivo de ENTRADA, antes de reduzir. Acima disso o navegador sofre. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export function assertImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new DomainError('Esse arquivo não é uma imagem.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new DomainError('Essa imagem é grande demais. Tenta uma foto menor.')
  }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => resolve(image))
    // O navegador aplica a orientação do EXIF sozinho ao carregar a tag, então
    // a selfie deitada chega em pé.
    image.addEventListener('error', () =>
      reject(new DomainError('Não consegui abrir essa imagem. Tenta outra.')),
    )
    image.src = url
  })
}

/** Abre o arquivo, faz o trabalho e devolve a memória do objeto URL. */
export async function withImage<T>(file: File, work: (image: HTMLImageElement) => T): Promise<T> {
  const url = URL.createObjectURL(file)
  try {
    return work(await loadImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function canvasOf(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new DomainError('Este navegador não conseguiu preparar a imagem.')
  }
  return ctx
}

/** O data URL virando arquivo, que é o que o bucket recebe. */
export async function toBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/**
 * Cabe dentro da caixa SEM cortar, mantendo a proporção.
 *
 * É o oposto do `cover` que avatar e foto do dia usam, e a diferença é o
 * propósito: aquelas viram círculo e quadrado, onde cortar pelo centro é o que
 * a pessoa espera. A publicação mostra a foto INTEIRA, porque a escolha do
 * enquadramento foi dela — cortar a paisagem pra caber num 4:5 é o app
 * decidindo o que importa na imagem de outra pessoa.
 *
 * Imagem menor que a caixa não é ampliada: esticar não acrescenta pixel, só
 * peso.
 */
export function fitWithin(
  image: HTMLImageElement,
  maxSide: number,
  quality: number,
): { readonly dataUrl: string; readonly width: number; readonly height: number } {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const ctx = canvasOf(width, height)
  ctx.drawImage(image, 0, 0, width, height)

  return { dataUrl: ctx.canvas.toDataURL('image/jpeg', quality), width, height }
}
