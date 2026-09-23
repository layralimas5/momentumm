import type { ShareTemplateId } from '@/domain/share/share-card'
import type { Quote } from '@/domain/entities/quote'
import { drawLine, lineHeightOf, measureText, resolveColor, wrapLines, type TextStyle } from './canvas-kit'
import { SHARE_THEMES } from './share-templates'

/**
 * O card da frase do dia, no mesmo formato e nas mesmas cores do Share Studio.
 *
 * Uma composição só: a frase grande no meio e a marca logo abaixo. É uma peça
 * de texto, então o texto é o desenho: nada de número, barra ou lista
 * competindo com ele.
 *
 * Sem o arroba no rodapé. A frase não é conquista de ninguém, é uma frase: o
 * card existe pra ser repassado, e assinar quem postou só ocupa o pé da
 * imagem. Os cards de progresso, esses sim, continuam assinados.
 */
export function renderQuoteCard(
  ctx: CanvasRenderingContext2D,
  quote: Quote,
  template: ShareTemplateId,
  logo: HTMLImageElement | null = null,
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const theme = SHARE_THEMES[template]
  const accent = resolveColor('var(--color-brand)')
  const pad = 96
  const contentWidth = width - pad * 2

  ctx.clearRect(0, 0, width, height)
  theme.paintBackground(ctx, width, height, accent)

  // A frase: o tamanho cai até caber em cinco linhas.
  let size = 88
  let lines: string[] = []
  let style: TextStyle = { size, weight: 700, color: theme.ink, leading: 1.18 }
  for (;;) {
    style = { size, weight: 700, color: theme.ink, leading: 1.18 }
    lines = wrapLines(ctx, quote.text, style, contentWidth, 6)
    const joined = lines.join(' ')
    if ((lines.length <= 5 && joined.length >= quote.text.trim().length - 2) || size <= 56) break
    size -= 6
  }

  const lineHeight = lineHeightOf(style)
  const blockHeight = lines.length * lineHeight
  let y = height / 2 - blockHeight / 2 + style.size
  for (const line of lines) {
    drawLine(ctx, line, width / 2, y, style, 'center')
    y += lineHeight
  }

  // A marca logo abaixo da frase, como no app: o logo em branco nos temas
  // escuros e no PNG; no branco ele vira tinta escura pelo recorte.
  const logoWidth = 300
  const logoHeight = Math.round((logoWidth * 53) / 1000)
  const logoY = y + 28
  if (logo) {
    drawTinted(ctx, logo, width / 2 - logoWidth / 2, logoY, logoWidth, logoHeight, theme.ink)
  } else {
    const brand: TextStyle = { size: 30, weight: 600, color: theme.inkMuted, tracking: 1 }
    const label = 'Momentumm'
    const dot = 13
    const spacing = 16
    const textWidth = measureText(ctx, label, brand)
    const total = dot + spacing + textWidth
    const startX = width / 2 - total / 2
    const baseline = logoY + brand.size
    ctx.fillStyle = resolveColor('var(--color-brand-hi)')
    ctx.beginPath()
    ctx.arc(startX + dot / 2, baseline - brand.size * 0.34, dot / 2, 0, Math.PI * 2)
    ctx.fill()
    drawLine(ctx, label, startX + dot + spacing, baseline, brand, 'left')
  }

  theme.paintForeground?.(ctx, width, height, accent)
}

/** Desenha a imagem recolorida: o logo é branco no arquivo, e o tema decide a tinta. */
function drawTinted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const layer = document.createElement('canvas')
  layer.width = Math.max(1, Math.round(width))
  layer.height = Math.max(1, Math.round(height))
  const inner = layer.getContext('2d')
  if (!inner) return
  inner.drawImage(image, 0, 0, layer.width, layer.height)
  inner.globalCompositeOperation = 'source-in'
  inner.fillStyle = color
  inner.fillRect(0, 0, layer.width, layer.height)
  ctx.drawImage(layer, x, y, width, height)
}

/** O logo do app, pronto pro canvas. Falha vira null e o card usa a marca em texto. */
export function loadBrandLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = '/logo.png'
  })
}
