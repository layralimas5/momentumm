/**
 * Primitivas de desenho do Share Studio.
 *
 * ## Por que canvas, e não HTML virado em imagem
 *
 * A exigência do produto é que a imagem exportada seja EXATAMENTE o preview.
 * As bibliotecas que fotografam DOM (html2canvas e parentes) reimplementam o
 * layout do navegador por conta própria e erram em três coisas que este app
 * usa em todo lugar: cor em `oklch` (o padrão do Tailwind v4), `dvh` e fonte
 * de sistema. E `foreignObject` dentro de SVG, o outro caminho, é justamente o
 * que quebra no Safari do iPhone — o aparelho onde o Stories acontece.
 *
 * Desenhando no canvas existe UM renderizador. O preview é o mesmo desenho em
 * escala menor, então divergir é impossível por construção: não há dois
 * caminhos pra divergir.
 *
 * Todo desenho acontece num espaço de coordenadas fixo de 1080 de largura. Quem
 * escala é o `ctx.scale` de quem chama — nenhum template conhece o tamanho real
 * do canvas, e por isso o mesmo código serve pro preview de 300px e pro PNG de
 * 1080.
 */

export const SHARE_FONT_STACK =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export interface TextStyle {
  readonly size: number
  readonly weight: number
  readonly color: string
  /** Espaçamento entre letras, em px do espaço de 1080. */
  readonly tracking?: number
  /** Multiplicador da altura de linha. */
  readonly leading?: number
  readonly uppercase?: boolean
}

export type TextAlign = 'left' | 'center'

export function applyFont(ctx: CanvasRenderingContext2D, style: TextStyle): void {
  ctx.font = `${style.weight} ${style.size}px ${SHARE_FONT_STACK}`
  ctx.fillStyle = style.color
  ctx.textBaseline = 'alphabetic'
}

function textOf(text: string, style: TextStyle): string {
  return style.uppercase ? text.toLocaleUpperCase('pt-BR') : text
}

export function measureText(ctx: CanvasRenderingContext2D, text: string, style: TextStyle): number {
  applyFont(ctx, style)
  const value = textOf(text, style)
  const base = ctx.measureText(value).width
  const tracking = style.tracking ?? 0
  // O espaçamento é aplicado ENTRE as letras: a última não empurra nada.
  return tracking === 0 ? base : base + tracking * Math.max(0, value.length - 1)
}

export function lineHeightOf(style: TextStyle): number {
  return style.size * (style.leading ?? 1.2)
}

/**
 * Desenha uma linha. Devolve a largura ocupada.
 *
 * O espaçamento entre letras é aplicado à mão em vez de usar `ctx.letterSpacing`
 * porque a propriedade só existe em navegadores recentes e, onde falta, ela
 * falha em silêncio: o kicker sairia apertado no aparelho de alguém e ninguém
 * ficaria sabendo.
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
  align: TextAlign = 'left',
): number {
  const value = textOf(text, style)
  if (value.length === 0) return 0

  applyFont(ctx, style)
  const width = measureText(ctx, text, style)
  const startX = align === 'center' ? x - width / 2 : x

  const tracking = style.tracking ?? 0
  if (tracking === 0) {
    ctx.textAlign = 'left'
    ctx.fillText(value, startX, y)
    return width
  }

  let cursor = startX
  ctx.textAlign = 'left'
  for (const char of value) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + tracking
  }
  return width
}

/**
 * Quebra o texto em linhas que cabem na largura.
 *
 * A última linha ganha reticências quando o texto não cabe no limite. Cortar é
 * melhor que encolher a fonte: um título de objetivo longo derrubaria a
 * hierarquia do card inteiro pra caber, e a hierarquia é o produto aqui.
 */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measureText(ctx, candidate, style) <= maxWidth || current === '') {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }

  if (lines.length < maxLines && current) lines.push(current)

  if (lines.length === maxLines) {
    const overflowed =
      words.join(' ') !== lines.join(' ') ||
      measureText(ctx, lines[maxLines - 1] ?? '', style) > maxWidth

    if (overflowed) {
      lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] ?? '', style, maxWidth)
    }
  }

  return lines
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  line: string,
  style: TextStyle,
  maxWidth: number,
): string {
  let text = line
  while (text.length > 1 && measureText(ctx, `${text}…`, style) > maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text.trimEnd()}…`
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Barra de progresso: trilho e preenchimento, sem texto. */
export function drawProgressTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  ratio: number,
  trackColor: string,
  fillColor: string,
  thickness = 10,
): void {
  ctx.fillStyle = trackColor
  roundRect(ctx, x, y, width, thickness, thickness / 2)
  ctx.fill()

  const filled = Math.max(0, Math.min(1, ratio)) * width
  if (filled <= 0) return

  ctx.fillStyle = fillColor
  roundRect(ctx, x, y, Math.max(thickness, filled), thickness, thickness / 2)
  ctx.fill()
}

/** Círculo de "concluído" das listas. Vazado quando o item não saiu. */
export function drawCheckDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  done: boolean,
  accent: string,
  faint: string,
): void {
  const radius = size / 2
  ctx.beginPath()
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2)

  if (!done) {
    ctx.strokeStyle = faint
    ctx.lineWidth = Math.max(2, size * 0.09)
    ctx.stroke()
    return
  }

  ctx.fillStyle = accent
  ctx.fill()

  ctx.strokeStyle = '#0a0a0b'
  ctx.lineWidth = Math.max(2.5, size * 0.13)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x + size * 0.28, y + size * 0.52)
  ctx.lineTo(x + size * 0.44, y + size * 0.68)
  ctx.lineTo(x + size * 0.73, y + size * 0.34)
  ctx.stroke()
}

/**
 * Sombra suave, usada só pelo template transparente.
 *
 * Sem fundo, o texto pode cair sobre uma foto clara e sumir. A sombra é o que
 * garante contraste sem inventar uma caixa preta por trás — que anularia a
 * razão de o template existir.
 */
export function withSoftShadow(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 4
  draw()
  ctx.restore()
}

/**
 * Resolve `var(--color-brand)` no valor real.
 *
 * O canvas não entende variável de CSS. Ler do documento mantém o card fiel ao
 * tema do app mesmo quando um token muda em `index.css`; o mapa de reserva
 * cobre o caso de o desenho acontecer fora do documento (teste, worker).
 */
const COLOR_FALLBACK: Readonly<Record<string, string>> = {
  '--color-brand': '#6d5cff',
  '--color-brand-hi': '#8878ff',
  '--color-brand-ink': '#cfc7ff',
  '--color-flame': '#ff6b35',
  '--color-positive': '#3ecf8e',
  '--color-ink-faint': '#8b8b96',
  '--color-axis-leitura': '#f2b544',
  '--color-axis-estudo': '#4a9eff',
  '--color-axis-treino': '#ff5c8a',
  '--color-axis-meditacao': '#3ecf8e',
  '--color-axis-custom-1': '#a78bfa',
  '--color-axis-custom-2': '#22d3ee',
  '--color-axis-custom-3': '#f472b6',
  '--color-axis-custom-4': '#a3e635',
}

export function resolveColor(token: string): string {
  const match = /^var\((--[a-z0-9-]+)\)$/i.exec(token.trim())
  if (!match) return token

  const name = match[1] ?? ''
  if (typeof document !== 'undefined') {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (value) return value
  }
  return COLOR_FALLBACK[name] ?? '#6d5cff'
}

/** Mistura a cor com o fundo, pra bordas e trilhos que não roubam atenção. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const value = hex[1] ?? '000000'
    const r = parseInt(value.slice(0, 2), 16)
    const g = parseInt(value.slice(2, 4), 16)
    const b = parseInt(value.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Cor em formato que não dá pra decompor (oklch, nome): o navegador resolve
  // sozinho com `color-mix`, e onde ele não existir a cor cheia é aceitável.
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}
