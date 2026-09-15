import type { ShareTemplateId } from '@/domain/share/share-card'
import type { Quote } from '@/domain/entities/quote'
import { QUOTE_CATEGORY_LABELS } from '@/domain/entities/quote'
import { drawLine, lineHeightOf, measureText, resolveColor, wrapLines, type TextStyle } from './canvas-kit'
import { SHARE_THEMES } from './share-templates'

/**
 * O card da frase do dia, no mesmo formato e nas mesmas cores do Share Studio.
 *
 * Uma composição só: a frase grande no meio, a categoria em cima, a marca
 * embaixo. É uma peça de texto, então o texto é o desenho: nada de número,
 * barra ou lista competindo com ele.
 */
export function renderQuoteCard(
  ctx: CanvasRenderingContext2D,
  quote: Quote,
  template: ShareTemplateId,
  username: string | null,
): void {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  const theme = SHARE_THEMES[template]
  const accent = resolveColor('var(--color-brand)')
  const pad = 96
  const contentWidth = width - pad * 2

  ctx.clearRect(0, 0, width, height)
  theme.paintBackground(ctx, width, height, accent)

  // Categoria, em cima: pequena, espaçada, sem chamar atenção.
  const kicker: TextStyle = { size: 30, weight: 600, color: theme.inkFaint, tracking: 4, uppercase: true }
  drawLine(ctx, QUOTE_CATEGORY_LABELS[quote.category], width / 2, height * 0.3, kicker, 'center')

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

  // Um traço curto de acento abaixo da frase: é o único elemento não textual.
  ctx.fillStyle = accent
  ctx.fillRect(width / 2 - 36, y + 24, 72, 6)

  // Marca e nome, embaixo.
  const brand: TextStyle = { size: 30, weight: 600, color: theme.inkMuted, tracking: 1 }
  const label = 'Momentumm'
  const dot = 13
  const spacing = 16
  const textWidth = measureText(ctx, label, brand)
  const total = dot + spacing + textWidth
  const startX = width / 2 - total / 2
  const baseline = height - pad
  ctx.fillStyle = resolveColor('var(--color-brand-hi)')
  ctx.beginPath()
  ctx.arc(startX + dot / 2, baseline - brand.size * 0.34, dot / 2, 0, Math.PI * 2)
  ctx.fill()
  drawLine(ctx, label, startX + dot + spacing, baseline, brand, 'left')

  if (username) {
    const name: TextStyle = { size: 26, weight: 500, color: theme.inkFaint }
    drawLine(ctx, username, width / 2, baseline - 46, name, 'center')
  }

  theme.paintForeground?.(ctx, width, height, accent)
}
