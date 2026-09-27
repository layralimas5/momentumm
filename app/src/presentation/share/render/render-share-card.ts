import {
  SHARE_FORMAT_SPECS,
  type ShareCardData,
  type ShareCompositionId,
  type ShareFormat,
  type ShareTemplateId,
  DEFAULT_SHARE_COMPOSITION,
} from '@/domain/share/share-card'
import {
  drawLine,
  lineHeightOf,
  measureText,
  resolveColor,
  wrapLines,
  type TextStyle,
} from './canvas-kit'
import {
  SHARE_COMPOSITIONS_BY_ID,
  SHARE_THEMES,
  overPhoto,
  type ShareComposition,
  type ShareTheme,
} from './share-templates'

/**
 * O renderizador único do Share Studio.
 *
 * Preview e exportação chamam ESTA função. O preview desenha num canvas menor
 * com `ctx.scale`, a exportação desenha em 1080 de largura — mesmas
 * coordenadas, mesmo código, nenhum caminho pra divergir. É assim que a
 * promessa "o que você vê é o que sai" fica garantida por construção em vez de
 * por disciplina.
 *
 * O layout é um só pras oito composições: uma pilha vertical de blocos medida
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
  /** A cor: preto, neon, branco ou PNG. */
  readonly template: ShareTemplateId
  /** O arranjo: selo, resumo, lista, anel, figura, grade, pilha ou recap. */
  readonly composition?: ShareCompositionId
  readonly format: ShareFormat
  /** Nula quando a pessoa não escolheu foto: o template pinta o próprio fundo. */
  readonly photo?: SharePhoto | null
}

/** Um bloco já medido. O desenho só acontece depois que a pilha inteira cabe. */
interface Block {
  readonly height: number
  /** Espaço acima deste bloco. O primeiro bloco ignora o próprio. */
  readonly gap: number
  /**
   * Ordem de sacrifício quando a pilha não cabe: quanto MAIOR, mais cedo o
   * bloco sai. Zero (o padrão) é o que nunca sai — kicker, título e número são
   * o card; sem eles não sobra o que postar.
   *
   * Existe porque o conteúdo agora é escolhido pela pessoa, e uma semana com
   * dez hábitos, volume, etapas, prazo e dias ativos pode pedir mais altura do
   * que 1920px têm. Sem isso o excesso simplesmente vazava pra fora da imagem,
   * em silêncio.
   */
  readonly drop?: number
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

function metricsFor(width: number, composition: ShareComposition): Metrics {
  const pad = 104
  return {
    pad,
    contentWidth: width - pad * 2,
    x: composition.align === 'center' ? width / 2 : pad,
    titleSize: composition.titleSize,
    metricSize: 300 * composition.metricScale,
    maxItems: composition.maxItems ?? 6,
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
  const composition = SHARE_COMPOSITIONS_BY_ID[options.composition ?? DEFAULT_SHARE_COMPOSITION]
  const { width, height } = spec
  const accent = resolveColor(data.accent)
  const m = metricsFor(width, composition)

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

  const headerBottom = drawHeader(ctx, data, theme, composition, m)
  const footerHeight = drawFooter(ctx, data, theme, composition, m, height - m.pad, { dry: true })

  const available = height - m.pad - footerHeight - headerBottom
  const blocks = fitBlocks(buildBody(ctx, data, theme, composition, m, accent), available)
  const total = blocks.reduce(
    (sum, block, index) => sum + block.height + (index === 0 ? 0 : block.gap),
    0,
  )

  /*
    Sem foto, a pilha fica centrada no espaço livre, e a assinatura vem COLADA
    embaixo dela: o card é o conteúdo mais a marca, um bloco só. Assinatura
    presa no rodapé, a um palmo do último número, lia como marca d'água de
    app — e o que a pessoa posta precisa parecer uma peça, não um print.

    Com foto, a pilha desce e encosta no rodapé. É a diferença entre um card
    do app e um card da pessoa: ancorando embaixo, os dois terços de cima da
    foto ficam limpos — o rosto, o lugar, o treino — e o texto cai justamente
    sobre a faixa que o véu mais escurece. Centralizado, o número aterrissaria
    no meio da foto e cobriria o que ela tem de melhor.
  */
  const anchorBottom = photo !== null || composition.anchor === 'bottom'
  const stack = total + footerHeight
  const offset = anchorBottom ? Math.max(0, available - total) : Math.max(0, (available + footerHeight - stack) / 2)
  let cursor = headerBottom + offset

  blocks.forEach((block, index) => {
    if (index > 0) cursor += block.gap
    block.draw(cursor)
    cursor += block.height
  })

  const footerBottom = anchorBottom ? height - m.pad : Math.min(height - m.pad, cursor + footerHeight)
  drawFooter(ctx, data, theme, composition, m, footerBottom)

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Moldura e outros traços de borda vêm por último: eles emolduram o card
  // inteiro, texto incluído, e desenhá-los antes deixaria o número por cima.
  theme.paintForeground?.(ctx, width, height, accent)
}

/**
 * A pilha cabendo na altura disponível.
 *
 * Enquanto não couber, sai o bloco de maior `drop` — a lista antes da linha de
 * apoio, a linha de apoio antes do momentum, o momentum antes do subtítulo.
 * Cortar é melhor que encolher: reduzir a fonte faria a densidade do card
 * variar conforme o que a pessoa ligou, e dois cards do mesmo dia sairiam com
 * tipografias diferentes.
 *
 * Nunca corta abaixo de um bloco: um card vazio não é uma saída.
 */
function fitBlocks(blocks: readonly Block[], available: number): Block[] {
  const kept = [...blocks]

  const heightOf = (list: readonly Block[]) =>
    list.reduce((sum, block, index) => sum + block.height + (index === 0 ? 0 : block.gap), 0)

  while (kept.length > 1 && heightOf(kept) > available) {
    let worst = -1
    let worstDrop = 0

    kept.forEach((block, index) => {
      const drop = block.drop ?? 0
      if (drop > worstDrop) {
        worstDrop = drop
        worst = index
      }
    })

    // Sobrou só o que não pode sair: melhor um card apertado do que um card
    // sem o número que ele existe pra mostrar.
    if (worst < 0) break
    kept.splice(worst, 1)
  }

  return kept
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
  composition: ShareComposition,
  m: Metrics,
): number {
  if (!data.date) return m.pad

  const style: TextStyle = { size: 30, weight: 500, color: theme.inkFaint }
  drawLine(ctx, data.date, m.x, m.pad + style.size, style, composition.align)
  return m.pad + style.size + 28
}

/**
 * A assinatura, o nome e a frase, com a borda de baixo em `bottom`. Devolve
 * a ALTURA que ocupa (respiro acima incluído). Com `dry`, só mede: o
 * renderizador precisa da altura antes de decidir onde o corpo termina.
 */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
  bottom: number,
  options: { readonly dry?: boolean } = {},
): number {
  const dry = options.dry === true
  const write: typeof drawLine = (...args) => (dry ? 0 : drawLine(...args))
  let baseline = bottom
  let top = bottom

  if (data.branding || data.username) {
    const brandStyle: TextStyle = {
      size: 27,
      weight: 700,
      color: theme.inkMuted,
      tracking: 6,
      uppercase: true,
    }
    const nameStyle: TextStyle = { size: 28, weight: 500, color: theme.inkFaint }

    if (composition.align === 'center') {
      if (data.branding && !dry) drawBrandMark(ctx, m.x, baseline, theme, brandStyle, 'center')
      if (data.username) {
        write(ctx, data.username, m.x, baseline - (data.branding ? 46 : 0), nameStyle, 'center')
      }
      top = baseline - (data.branding && data.username ? 78 : 40)
    } else {
      if (data.branding && !dry) drawBrandMark(ctx, m.x, baseline, theme, brandStyle, 'left')
      if (data.username) {
        // À direita, na mesma linha da assinatura: duas linhas de rodapé
        // roubariam altura do número por uma informação de apoio.
        const width = measureText(ctx, data.username, nameStyle)
        write(ctx, data.username, m.x + m.contentWidth - width, baseline, nameStyle, 'left')
      }
      top = baseline - 40
    }
  }

  if (data.note) {
    const noteStyle: TextStyle = { size: 34, weight: 500, color: theme.inkMuted }
    baseline = top - 22
    write(ctx, data.note, m.x, baseline, noteStyle, composition.align)
    top = baseline - noteStyle.size
  }

  // O respiro entre o conteúdo e a assinatura é curto de propósito.
  return bottom - top + 44
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
  composition: ShareComposition,
  m: Metrics,
  accent: string,
): Block[] {
  const blocks: Block[] = []
  const showsMomentum = data.momentumAfter !== null && data.eventType !== 'momentum_record'

  const kicker = () => (data.kicker ? kickerBlock(ctx, data.kicker, theme, composition, m, accent) : null)
  const title = () => (data.title ? titleBlock(ctx, data.title, theme, composition, m) : null)
  const momentum = () =>
    showsMomentum ? momentumBlock(ctx, data, theme, composition, m, accent) : null
  const figures = figuresOf(data)

  const push = (...candidates: readonly (Block | null)[]) => {
    for (const block of candidates) if (block) blocks.push(block)
  }

  /*
    Cada composição é uma ORDEM de blocos, e é só isso.

    Nenhuma das duas tem função de desenho própria: a grade e a pilha
    acrescentam um bloco, e o resto é a mesma pilha de sempre. Foi assim que
    quatro cores e os arranjos couberam num renderizador só — e é por isso que
    uma correção no bloco do momentum vale pra todos os cards.
  */
  switch (composition.id) {
    case 'grade':
      push(kicker(), title(), gridBlock(ctx, figures.slice(0, 4), theme, m), momentum())
      return blocks

    case 'pilha':
      push(stackBlock(ctx, figures.slice(0, 4), theme, m), momentum())
      return blocks
  }
}

/** Um número com rótulo, como a grade e a pilha desenham. */
interface Figure {
  readonly value: string
  readonly label: string | null
}

/**
 * Os números do card, em ordem de importância: a estrela, a secundária e a
 * linha de apoio. É a lista que a grade, a pilha e a linha de números leem —
 * a mesma pra as três, pra que o card não mostre "5 hábitos" numa e "5" na
 * outra.
 */
function figuresOf(data: ShareCardData): readonly Figure[] {
  const figures: Figure[] = []
  if (data.primaryMetric.value) {
    figures.push({ value: data.primaryMetric.value, label: data.primaryMetric.label })
  }
  if (data.secondaryMetric) {
    figures.push({ value: data.secondaryMetric.value, label: data.secondaryMetric.label })
  }
  for (const stat of data.stats) figures.push({ value: stat.value, label: stat.label })
  return figures
}

/** A grade: até quatro números grandes, dois por linha, rótulo embaixo. */
function gridBlock(
  ctx: CanvasRenderingContext2D,
  figures: readonly Figure[],
  theme: ShareTheme,
  m: Metrics,
): Block | null {
  if (figures.length === 0) return null
  const valueStyle: TextStyle = { size: 96, weight: 700, color: theme.ink, tracking: -2 }
  const labelStyle: TextStyle = { size: 34, weight: 400, color: theme.inkMuted }
  const cellHeight = valueStyle.size + 12 + labelStyle.size
  const rowGap = 64
  const rows = Math.ceil(figures.length / 2)
  const columnWidth = m.contentWidth / 2

  return {
    gap: 44,
    height: rows * cellHeight + (rows - 1) * rowGap,
    draw(y) {
      figures.forEach((figure, index) => {
        const column = index % 2
        const row = Math.floor(index / 2)
        const x = m.x + column * columnWidth
        const top = y + row * (cellHeight + rowGap)
        const maxWidth = columnWidth - 24
        const measured = measureText(ctx, figure.value, valueStyle)
        const style =
          measured > maxWidth
            ? { ...valueStyle, size: valueStyle.size * (maxWidth / measured) }
            : valueStyle
        drawLine(ctx, figure.value, x, top + valueStyle.size * 0.78, style, 'left')
        if (figure.label) {
          drawLine(ctx, figure.label, x, top + valueStyle.size + 12 + labelStyle.size * 0.8, labelStyle, 'left')
        }
      })
    },
  }
}

/** A pilha: valor e rótulo centrados, um par embaixo do outro. */
function stackBlock(
  ctx: CanvasRenderingContext2D,
  figures: readonly Figure[],
  theme: ShareTheme,
  m: Metrics,
): Block | null {
  if (figures.length === 0) return null
  const valueStyle: TextStyle = { size: 72, weight: 700, color: theme.ink, tracking: -1 }
  const labelStyle: TextStyle = { size: 34, weight: 400, color: theme.inkMuted }
  const pairHeight = valueStyle.size + 8 + labelStyle.size
  const pairGap = 44

  return {
    gap: 40,
    height: figures.length * pairHeight + (figures.length - 1) * pairGap,
    draw(y) {
      figures.forEach((figure, index) => {
        const top = y + index * (pairHeight + pairGap)
        drawLine(ctx, figure.value, m.x, top + valueStyle.size * 0.78, valueStyle, 'center')
        if (figure.label) {
          drawLine(ctx, figure.label, m.x, top + valueStyle.size + 8 + labelStyle.size * 0.8, labelStyle, 'center')
        }
      })
    },
  }
}

function kickerBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  composition: ShareComposition,
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
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, composition.align)
      })
    },
  }
}

function titleBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  composition: ShareComposition,
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
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, composition.align)
      })
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
  composition: ShareComposition,
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
  const labelWidth = measureText(ctx, 'Momentumm', labelStyle)
  const valueWidth = measureText(ctx, value, valueStyle)
  const total = labelWidth + spacing + valueWidth

  return {
    gap: 34,
    drop: 40,
    height: valueStyle.size,
    draw(y) {
      const startX = composition.align === 'center' ? m.x - total / 2 : m.x
      const baseline = y + valueStyle.size * 0.78

      drawLine(ctx, 'Momentumm', startX, baseline - 2, labelStyle, 'left')
      drawLine(ctx, value, startX + labelWidth + spacing, baseline, valueStyle, 'left')
    },
  }
}
