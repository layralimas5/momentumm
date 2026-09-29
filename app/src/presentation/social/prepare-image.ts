import type { PostPhotoUpload } from '@/domain/repositories/social-repository'
import { assertImageFile, fitWithin, toBlob, withImage } from '@/shared/lib/image'

/**
 * A foto saindo da câmera e entrando na publicação.
 *
 * O arquivo do celular tem 12 megapixels e alguns megabytes. O feed desenha a
 * imagem na largura da tela, e num aparelho retina isso é ~1200px: 1440 cobre
 * com folga e derruba o arquivo pra algumas centenas de KB.
 *
 * Reduzir aqui, no navegador, e não no servidor, tem três consequências que
 * valem juntas: o upload é rápido no 4G, o feed de quem vê não baixa
 * megabytes por card, e o bucket não vira depósito de original de câmera. É o
 * item "otimizar imagens antes do upload" resolvido no único lugar onde ele
 * custa zero de infraestrutura.
 *
 * As MEDIDAS voltam junto porque o feed precisa delas antes da imagem chegar:
 * sem `width`/`height`, cada foto que carrega empurra a lista pra baixo, e
 * isso é o CLS que o produto mede.
 */

/** Largura máxima do maior lado. Cobre a tela do celular em retina. */
export const POST_MAX_SIDE = 1440
/** Story ocupa a tela toda em pé: 1080x1920 é o formato, 1920 é o maior lado. */
export const STORY_MAX_SIDE = 1920

const QUALITY = 0.82

export async function preparePostPhoto(file: File): Promise<PostPhotoUpload> {
  assertImageFile(file)

  const fitted = await withImage(file, (image) => fitWithin(image, POST_MAX_SIDE, QUALITY))
  return {
    blob: await toBlob(fitted.dataUrl),
    width: fitted.width,
    height: fitted.height,
  }
}

export async function prepareStoryImage(file: File): Promise<PostPhotoUpload> {
  assertImageFile(file)

  const fitted = await withImage(file, (image) => fitWithin(image, STORY_MAX_SIDE, QUALITY))
  return {
    blob: await toBlob(fitted.dataUrl),
    width: fitted.width,
    height: fitted.height,
  }
}

/**
 * A prévia, antes de enviar.
 *
 * `URL.createObjectURL` sobre o arquivo ORIGINAL, e não sobre o reduzido: a
 * redução custa alguns décimos por foto e a prévia precisa aparecer no toque.
 * Quem chama é responsável por devolver a memória (`releasePreview`) quando a
 * folha fecha — sem isso, escolher dez fotos e desistir deixa dez imagens
 * presas até a aba ser fechada.
 */
export function previewOf(file: File): string {
  return URL.createObjectURL(file)
}

export function releasePreview(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
