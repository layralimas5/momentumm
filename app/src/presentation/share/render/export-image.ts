import {
  SHARE_FORMAT_SPECS,
  SHARE_TEMPLATE_SPECS,
  type ShareCardData,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { renderShareCard } from './render-share-card'

/**
 * Exportação e compartilhamento da imagem.
 *
 * A saída é sempre PNG. JPEG seria menor, mas não tem canal alpha — e o
 * template Transparent existe exatamente pra a pessoa colar o card por cima de
 * uma foto dela. Um formato por template significaria dois caminhos de
 * exportação e a garantia de que um deles envelheceria.
 */

export interface ExportRequest {
  readonly data: ShareCardData
  readonly template: ShareTemplateId
  readonly format: ShareFormat
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported'

export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}

/** Desenha o card em resolução cheia e devolve o arquivo. */
export async function renderToBlob(request: ExportRequest): Promise<Blob> {
  const spec = SHARE_FORMAT_SPECS[request.format]
  const canvas = document.createElement('canvas')
  canvas.width = spec.width
  canvas.height = spec.height

  // `alpha: true` é o padrão, mas fica explícito: é o que separa o PNG
  // transparente de um PNG com fundo preto que ninguém pediu.
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) {
    throw new ExportError('Este navegador não conseguiu preparar a imagem.')
  }

  renderShareCard(ctx, request.data, { template: request.template, format: request.format })

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })

  if (!blob) {
    throw new ExportError('Não consegui gerar a imagem agora. Tenta de novo.')
  }
  return blob
}

export function fileNameFor(request: ExportRequest, day: string): string {
  const template = SHARE_TEMPLATE_SPECS[request.template].id
  return `momentumm-${request.data.eventType}-${template}-${day}.png`
}

/**
 * Existe compartilhamento nativo com arquivo?
 *
 * A checagem precisa incluir `canShare` com um arquivo de verdade: há
 * navegador que expõe `navigator.share` e recusa arquivos, e nele o botão
 * principal levaria a pessoa a um erro em vez de ao share sheet.
 */
export function supportsFileShare(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false

  try {
    const probe = new File([new Blob([''], { type: 'image/png' })], 'probe.png', {
      type: 'image/png',
    })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/**
 * Abre o share sheet do aparelho.
 *
 * Sem integração direta com Instagram, TikTok ou WhatsApp: cada uma exigiria
 * SDK, chave e manutenção própria pra entregar o que o share sheet nativo já
 * faz — e o sheet nativo mostra os apps que a pessoa realmente usa.
 */
export async function shareImage(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  if (!supportsFileShare()) return 'unsupported'

  const file = new File([blob], fileName, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (cause) {
    // Fechar o share sheet é uma decisão, não uma falha: virar erro na tela
    // faria a pessoa achar que o app quebrou quando ela só mudou de ideia.
    if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled'
    throw new ExportError('Não consegui abrir o compartilhamento. Salva a imagem e posta direto.')
  }
}

/** Salva o arquivo. É o caminho de quem não tem share nativo — desktop, quase sempre. */
export function downloadImage(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Revogar na hora cancela o download em alguns navegadores; um quadro depois
  // o arquivo já foi entregue.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
