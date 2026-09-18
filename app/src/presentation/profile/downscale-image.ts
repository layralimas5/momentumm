import { DomainError } from '@/shared/errors'

/**
 * A foto escolhida virando um avatar pequeno.
 *
 * O arquivo que sai da câmera tem 12 megapixels e alguns megabytes. O que o
 * perfil precisa é de um quadrado de 256px — o maior tamanho em que ele é
 * desenhado, dobrado pra tela retina. Reduzir aqui, no navegador, é o que
 * permite guardar a imagem na própria coluna `avatar_url` em vez de montar um
 * bucket de Storage inteiro pra um arquivo por conta.
 *
 * JPEG, não PNG: um retrato em PNG de 256px passa de 150KB, e o mesmo retrato
 * em JPEG fica em torno de 20KB sem diferença visível nesse tamanho. Avatar não
 * precisa de transparência.
 */

export const AVATAR_SIZE = 256
const QUALITY = 0.82
const MAX_BYTES = 25 * 1024 * 1024

export async function downscaleToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new DomainError('Esse arquivo não é uma imagem.')
  }
  if (file.size > MAX_BYTES) {
    throw new DomainError('Essa imagem é grande demais. Tenta uma foto menor.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    return crop(image)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A capa é larga e baixa: 1024x360 cobre a largura do card em tela retina. */
export const BANNER_WIDTH = 1024
export const BANNER_HEIGHT = 360

export async function downscaleToBanner(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new DomainError('Esse arquivo não é uma imagem.')
  }
  if (file.size > MAX_BYTES) {
    throw new DomainError('Essa imagem é grande demais. Tenta uma foto menor.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    return cropCover(image, BANNER_WIDTH, BANNER_HEIGHT)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Recorte pelo centro na proporção pedida, como `object-fit: cover`. */
function cropCover(image: HTMLImageElement, width: number, height: number): string {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new DomainError('Este navegador não conseguiu preparar a imagem.')
  }

  ctx.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  )

  return canvas.toDataURL('image/jpeg', QUALITY)
}

/**
 * Recorte quadrado pelo centro.
 *
 * A foto de celular é 3:4 e o avatar é 1:1. Espremer pra caber deformaria o
 * rosto; cortar pelo centro é o que todo app faz e o que a pessoa espera ao
 * escolher uma selfie.
 */
function crop(image: HTMLImageElement): string {
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new DomainError('Este navegador não conseguiu preparar a imagem.')
  }

  ctx.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  )

  return canvas.toDataURL('image/jpeg', QUALITY)
}

function loadImage(url: string): Promise<HTMLImageElement> {
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
