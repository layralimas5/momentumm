import {
  SHARE_FORMAT_SPECS,
  type ShareCardData,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import {
  drawCheckDot,
  drawLine,
  lineHeightOf,
  measureText,
  resolveColor,
  wrapLines,
  type TextStyle,
} from './canvas-kit'
import { SHARE_THEMES, overPhoto, type ShareTheme } from './share-templates'

/**
 * O renderizador único do Share Studio.
 *
 * Preview e exportação chamam ESTA função. O preview desenha num canvas menor
 * com `ctx.scale`, a exportação desenha em 1080 de largura — mesmas
 * coordenadas, mesmo código, nenhum caminho pra divergir. É assim que a
 * promessa "o que você vê é o que sai" fica garantida por construção em vez de
 * por disciplina.
 *
 * O layout é um só pros cinco templates: uma pilha vertical de blocos medida
 * antes de ser desenhada, e depois centrada no espaço que sobra entre o
 * cabeçalho e o rodapé. O que cada template muda é paleta, alinhamento e
 * densidade — nunca a estrutura.
 */

/**
 * A foto de fundo escolhida pela pessoa.
 *
 * Vem já decodificada porque desenhar é síncrono: o renderizador não pode
 * esperar um `onload` no meio do preview. As medidas vêm junto porque
 * `CanvasImageSource` não expõe tamanho de forma uniforme, e sem elas não dá
 * pra recortar a foto preservando a proporção.
 */
export interface SharePhoto {
  readonly image: CanvasImageSource
  readonly width: number
  readonly height: number
}

export interface RenderOptions {
  readonly template: ShareTemplateId
  readonly format: ShareFormat
  /** Nula quando a pessoa não escolheu foto: o template pinta o próprio fundo. */
  readonly photo?: SharePhoto | null
}

/** Um bloco já medido. O desenho só acontece depois que a pilha inteira cabe. */
interface Block {
  readonly height: number
  /** Espaço acima deste bloco. O primeiro bloco ignora o próprio. */
  readonly gap: number
  draw(y: number): void
}

interface Metrics {
  readonly pad: number
  readonly contentWidth: number
  readonly x: number
  readonly titleSize: number
  readonly metricSize: number
  readonly maxItems: number
}

function metricsFor(format: ShareFormat, width: number, theme: ShareTheme): Metrics {
  const pad = format === 'stories' ? 104 : format === 'post' ? 92 : 88
  return {
    pad,
    contentWidth: width - pad * 2,
    x: theme.align === 'center' ? width / 2 : pad,
    titleSize: format === 'stories' ? 68 : format === 'post' ? 62 : 58,
    metricSize: format === 'stories' ? 300 : format === 'post' ? 250 : 230,
    // O quadrado é o formato mais apertado: seis linhas de lista nele
    // espremeriam o número, que é justamente o que precisa dominar.
    maxItems: format === 'stories' ? 6 : format === 'post' ? 5 : 4,
  }
}

export function renderShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  options: RenderOptions,
): void {
  const spec = SHARE_FORMAT_SPECS[options.format]
  const photo = options.photo ?? null
  const theme = photo ? overPhoto(SHARE_THEMES[options.template]) : SHARE_THEMES[options.template]
  const { width, height } = spec
  const accent = resolveColor(data.accent)
  const m = metricsFor(options.format, width, theme)

  ctx.clearRect(0, 0, width, height)

  if (photo) {
    drawPhotoCover(ctx, photo, width, height)
    drawScrim(ctx, width, height)
  } else {
    theme.paintBackground(ctx, width, height, accent)
  }

  // Sem fundo, o texto pode cair sobre uma foto clara: a sombra vale pro card
  // inteiro, incluindo chips e barra, senão só as letras sobreviveriam.
  if (theme.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 4
  }

  const headerBottom = drawHeader(ctx, data, theme, m)
  const footerTop = drawFooter(ctx, data, theme, m, height)

  const blocks = buildBody(ctx, data, theme, m, accent)
  const total = blocks.reduce(
    (sum, block, index) => sum + block.height + (index === 0 ? 0 : block.gap),
    0,
  )

  /*
    Sem foto, a pilha fica centrada no espaço livre.

    Com foto, ela desce e encosta no rodapé. É a diferença entre um card do app
    e um card da pessoa: ancorando embaixo, os dois terços de cima da foto
    ficam limpos — o rosto, o lugar, o treino — e o texto cai justamente sobre a
    faixa que o véu mais escurece. Centralizado, o número aterrissaria no meio
    da foto e cobriria o que ela tem de melhor.
  */
  const available = footerTop - headerBottom
  const offset = photo ? Math.max(0, available - total) : Math.max(0, (available - total) / 2)
  let cursor = headerBottom + offset

  blocks.forEach((block, index) => {
    if (index > 0) cursor += block.gap
    block.draw(cursor)
    cursor += block.height
  })

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

/**
 * A foto preenchendo o card sem deformar.
 *
 * Recorte por cobertura, centrado: a foto do celular é 3:4 e o Story é 9:16, e
 * esticar pra encaixar deixaria a pessoa da foto mais magra ou mais gorda — o
 * tipo de detalhe que faz alguém desistir de postar.
 */
function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  photo: SharePhoto,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / photo.width, height / photo.height)
  const drawWidth = photo.width * scale
  const drawHeight = photo.height * scale

  ctx.drawImage(
    photo.image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

/**
 * O véu por cima da foto.
 *
 * Sem ele, o card não tem como prometer legibilidade: a foto pode ser uma
 * parede branca ao meio-dia. É um escurecimento leve e uniforme mais um
 * gradiente que fecha em cima e embaixo, onde moram data e assinatura. A parte
 * do meio, que é onde a foto interessa, é a que menos escurece.
 */
function drawScrim(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Escurecimento base leve: garante contraste mínimo mesmo numa parede branca
  // ao meio-dia, sem apagar a foto.
  ctx.fillStyle = 'rgba(10, 10, 11, 0.16)'
  ctx.fillRect(0, 0, width, height)

  /*
    O gradiente é assimétrico porque o conteúdo é. Em cima mora só a data, então
    basta uma sombra fraca; embaixo mora o número, a métrica, o momentum e a
    assinatura, e é lá que o véu fecha. O miolo quase não escurece: é a parte da
    foto que a pessoa escolheu mostrar.
  */
  const veil = ctx.createLinearGradient(0, 0, 0, height)
  veil.addColorStop(0, 'rgba(10, 10, 11, 0.42)')
  veil.addColorStop(0.18, 'rgba(10, 10, 11, 0.06)')
  veil.addColorStop(0.45, 'rgba(10, 10, 11, 0.06)')
  veil.addColorStop(0.72, 'rgba(10, 10, 11, 0.42)')
  veil.addColorStop(1, 'rgba(10, 10, 11, 0.82)')
  ctx.fillStyle = veil
  ctx.fillRect(0, 0, width, height)
}

// ---------------------------------------------------------------------------
// cabeçalho e rodapé
// ---------------------------------------------------------------------------

function drawHeader(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
): number {
  if (!data.date) return m.pad

  const style: TextStyle = { size: 30, weight: 500, color: theme.inkFaint }
  drawLine(ctx, data.date, m.x, m.pad + style.size, style, theme.align)
  return m.pad + style.size + 28
}

/** Devolve o topo do rodapé: é onde o corpo do card precisa parar. */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  height: number,
): number {
  let baseline = height - m.pad
  let top = height - m.pad

  if (data.branding || data.username) {
    const brandStyle: TextStyle = {
      size: 27,
      weight: 700,
      color: theme.inkMuted,
      tracking: 6,
      uppercase: true,
    }
    const nameStyle: TextStyle = { size: 28, weight: 500, color: theme.inkFaint }

    if (theme.align === 'center') {
      if (data.branding) drawBrandMark(ctx, m.x, baseline, theme, brandStyle, 'center')
      if (data.username) {
        drawLine(ctx, data.username, m.x, baseline - (data.branding ? 46 : 0), nameStyle, 'center')
      }
      top = baseline - (data.branding && data.username ? 78 : 40)
    } else {
      if (data.branding) drawBrandMark(ctx, m.x, baseline, theme, brandStyle, 'left')
      if (data.username) {
        // À direita, na mesma linha da assinatura: duas linhas de rodapé
        // roubariam altura do número por uma informação de apoio.
        const width = measureText(ctx, data.username, nameStyle)
        drawLine(ctx, data.username, m.x + m.contentWidth - width, baseline, nameStyle, 'left')
      }
      top = baseline - 40
    }
  }

  if (data.note) {
    const noteStyle: TextStyle = { size: 34, weight: 500, color: theme.inkMuted }
    baseline = top - 22
    drawLine(ctx, data.note, m.x, baseline, noteStyle, theme.align)
    top = baseline - noteStyle.size
  }

  return top - 36
}

/**
 * A assinatura: um ponto na cor da marca e o nome espaçado.
 *
 * Discreta de propósito. A descoberta orgânica só acontece se o card for bonito
 * o bastante pra ser postado, e uma marca d'água grande é a forma mais rápida
 * de garantir que ele não seja.
 */
function drawBrandMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  theme: ShareTheme,
  style: TextStyle,
  align: 'left' | 'center',
): void {
  const label = 'Momentumm'
  const dot = 13
  const spacing = 16
  const textWidth = measureText(ctx, label, style)
  const total = dot + spacing + textWidth
  const startX = align === 'center' ? x - total / 2 : x

  ctx.fillStyle = resolveColor('var(--color-brand-hi)')
  ctx.beginPath()
  ctx.arc(startX + dot / 2, baseline - style.size * 0.34, dot / 2, 0, Math.PI * 2)
  ctx.fill()

  drawLine(ctx, label, startX + dot + spacing, baseline, { ...style, color: theme.inkMuted }, 'left')
}

// ---------------------------------------------------------------------------
// corpo
// ---------------------------------------------------------------------------

function buildBody(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block[] {
  const blocks: Block[] = []
  const full = theme.density === 'full'

  if (data.kicker) blocks.push(kickerBlock(ctx, data.kicker, theme, m, accent))
  if (data.title) blocks.push(titleBlock(ctx, data.title, theme, m))
  if (data.subtitle) blocks.push(subtitleBlock(ctx, data.subtitle, theme, m))
  if (data.primaryMetric.value) blocks.push(metricBlock(ctx, data, theme, m))

  // A métrica secundária sobrevive à densidade mínima: é uma linha só, e é ela
  // que dá movimento ao número ("+6 nesta semana"). O que o Minimal corta é a
  // lista e a barra, que são o que enche o card.
  if (data.secondaryMetric) {
    blocks.push(secondaryBlock(ctx, data.secondaryMetric.value, data.secondaryMetric.label, theme, m))
  }

  if (full && data.items.length > 0) blocks.push(itemsBlock(ctx, data, theme, m, accent))

  /*
    O selo do momentum não entra no card DO momentum: lá o score já é o número
    gigante do meio, e repetir "MOMENTUM 78 → 84" logo abaixo dele seria dizer
    a mesma coisa duas vezes em tamanhos diferentes. A variação continua
    aparecendo, pela métrica secundária.
  */
  if (data.momentumAfter !== null && data.eventType !== 'momentum_record') {
    blocks.push(momentumBlock(ctx, data, theme, m, accent))
  }

  return blocks
}

function kickerBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block {
  const style: TextStyle = {
    size: 32,
    weight: 700,
    // Sobre foto (ou sem fundo), o violeta da marca some numa parede clara e
    // briga com qualquer cor que a foto tenha. Branco é a única escolha que
    // funciona sem saber o que está atrás.
    color: theme.shadow ? theme.ink : accent,
    tracking: 7,
    uppercase: true,
  }
  const lines = wrapLines(ctx, text, style, m.contentWidth, 2)
  const lineHeight = lineHeightOf({ ...style, leading: 1.3 })

  return {
    gap: 0,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, theme.align)
      })
    },
  }
}

function titleBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  m: Metrics,
): Block {
  const style: TextStyle = { size: m.titleSize, weight: 600, color: theme.ink, leading: 1.16 }
  const lines = wrapLines(ctx, text, style, m.contentWidth, 3)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 26,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, theme.align)
      })
    },
  }
}

function subtitleBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  m: Metrics,
): Block {
  const style: TextStyle = { size: 38, weight: 400, color: theme.inkMuted, leading: 1.34 }
  const lines = wrapLines(ctx, text, style, m.contentWidth, 3)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 20,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, theme.align)
      })
    },
  }
}

/**
 * A estrela do card.
 *
 * O tamanho é reduzido só quando o valor não cabe na largura — "1h30" e "84"
 * ocupam larguras muito diferentes, e fixar a fonte faria um deles vazar. O
 * rótulo fica embaixo e pequeno: ele explica o número, não disputa com ele.
 */
function metricBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
): Block {
  const base: TextStyle = {
    size: m.metricSize,
    weight: 700,
    color: theme.ink,
    tracking: -m.metricSize * 0.03,
  }
  const measured = measureText(ctx, data.primaryMetric.value, base)
  const scale = measured > m.contentWidth ? m.contentWidth / measured : 1
  const style: TextStyle = { ...base, size: base.size * scale, tracking: base.tracking! * scale }

  const labelStyle: TextStyle = { size: 40, weight: 500, color: theme.inkMuted }
  const hasLabel = Boolean(data.primaryMetric.label)
  const labelGap = 14

  return {
    gap: 40,
    height: style.size * 0.78 + (hasLabel ? labelGap + labelStyle.size : 0),
    draw(y) {
      drawLine(ctx, data.primaryMetric.value, m.x, y + style.size * 0.74, style, theme.align)
      if (data.primaryMetric.label) {
        drawLine(
          ctx,
          data.primaryMetric.label,
          m.x,
          y + style.size * 0.78 + labelGap + labelStyle.size * 0.8,
          labelStyle,
          theme.align,
        )
      }
    },
  }
}

function secondaryBlock(
  ctx: CanvasRenderingContext2D,
  value: string,
  label: string | null,
  theme: ShareTheme,
  m: Metrics,
): Block {
  const style: TextStyle = { size: 38, weight: 500, color: theme.inkMuted, leading: 1.3 }
  const text = label ? `${value} ${label}` : value
  const lines = wrapLines(ctx, text, style, m.contentWidth, 2)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 26,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, theme.align)
      })
    },
  }
}

function itemsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block {
  const style: TextStyle = { size: 36, weight: 500, color: theme.ink }
  const rowHeight = 58
  const dot = 30
  const gapAfterDot = 22
  const shown = data.items.slice(0, m.maxItems)
  const hidden = data.items.length - shown.length

  const overflowStyle: TextStyle = { size: 30, weight: 500, color: theme.inkFaint }
  const height = shown.length * rowHeight + (hidden > 0 ? 40 : 0)

  return {
    gap: 36,
    height,
    draw(y) {
      shown.forEach((item, index) => {
        const rowY = y + index * rowHeight
        const labelWidth = measureText(ctx, item.label, style)
        const rowWidth = dot + gapAfterDot + labelWidth
        const startX = theme.align === 'center' ? m.x - rowWidth / 2 : m.x

        drawCheckDot(ctx, startX, rowY + 4, dot, item.done, accent, theme.line)
        drawLine(
          ctx,
          item.label,
          startX + dot + gapAfterDot,
          rowY + dot * 0.86,
          { ...style, color: item.done ? theme.ink : theme.inkFaint },
          'left',
        )
      })

      if (hidden > 0) {
        drawLine(
          ctx,
          `+${hidden} ${hidden === 1 ? 'outra' : 'outras'}`,
          m.x,
          y + shown.length * rowHeight + 28,
          overflowStyle,
          theme.align,
        )
      }
    },
  }
}

/**
 * O momentum: uma linha, não um selo.
 *
 * A versão anterior era um chip com caixa e borda. Sobre a foto de alguém, uma
 * caixa desenhada por cima é o elemento que denuncia "isto saiu de um app" —
 * e é exatamente essa a impressão que o card não pode dar. Rótulo pequeno em
 * caixa alta e os dois números do lado resolvem a mesma informação sem
 * construir moldura nenhuma.
 *
 * Mostrar os dois lados é o que dá sentido ao número. "81" sozinho é uma nota;
 * "76 → 81" é movimento, que é a única coisa que este produto mede.
 */
function momentumBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block {
  const labelStyle: TextStyle = {
    size: 26,
    weight: 700,
    color: theme.transparent || theme.shadow ? theme.inkFaint : accent,
    tracking: 5,
    uppercase: true,
  }
  const valueStyle: TextStyle = { size: 40, weight: 700, color: theme.ink }

  const before = data.momentumBefore
  const after = data.momentumAfter ?? 0
  const value = before !== null && before !== after ? `${before} → ${after}` : `${after}`

  const spacing = 18
  const labelWidth = measureText(ctx, 'Momentum', labelStyle)
  const valueWidth = measureText(ctx, value, valueStyle)
  const total = labelWidth + spacing + valueWidth

  return {
    gap: 34,
    height: valueStyle.size,
    draw(y) {
      const startX = theme.align === 'center' ? m.x - total / 2 : m.x
      const baseline = y + valueStyle.size * 0.78

      drawLine(ctx, 'Momentum', startX, baseline - 2, labelStyle, 'left')
      drawLine(ctx, value, startX + labelWidth + spacing, baseline, valueStyle, 'left')
    },
  }
}
