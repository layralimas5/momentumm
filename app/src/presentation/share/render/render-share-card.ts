import {
  SHARE_FORMAT_SPECS,
  type ShareCardData,
  type ShareCompositionId,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import {
  drawCheckDot,
  drawLine,
  drawProgressTrack,
  withAlpha,
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
  const composition = SHARE_COMPOSITIONS_BY_ID[options.composition ?? 'selo']
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
  const subtitle = () =>
    data.subtitle ? subtitleBlock(ctx, data.subtitle, theme, composition, m) : null
  const metric = () =>
    data.primaryMetric.value ? metricBlock(ctx, data, theme, composition, m) : null
  const secondary = () =>
    data.secondaryMetric
      ? secondaryBlock(ctx, data.secondaryMetric.value, data.secondaryMetric.label, theme, composition, m)
      : null
  const stats = () =>
    data.stats.length > 0 ? statsBlock(ctx, data, theme, composition, m, accent) : null
  const items = () =>
    data.items.length > 0 ? itemsBlock(ctx, data, theme, composition, m, accent) : null
  const momentum = () =>
    showsMomentum ? momentumBlock(ctx, data, theme, composition, m, accent) : null
  const figures = figuresOf(data)
  const statsRow = () =>
    figures.length > 0 ? statsRowBlock(ctx, figures.slice(0, 3), theme, composition, m) : null
  const ring = () => ringBlock(ctx, data, theme, m, accent)

  const push = (...candidates: readonly (Block | null)[]) => {
    for (const block of candidates) if (block) blocks.push(block)
  }

  /*
    Cada composição é uma ORDEM de blocos, e é só isso.

    Nenhuma delas tem função de desenho própria: selo, grade, pilha e a coluna
    da semana acrescentam um bloco novo, e o resto é a mesma pilha em
    sequências diferentes. Foi assim que quatro cores e oito arranjos couberam
    num renderizador só — e é por isso que uma correção no bloco do momentum
    vale pros trinta e dois cards.
  */
  switch (composition.id) {
    case 'selo':
      push(
        badgeBlock(ctx, data, theme, composition, m, accent),
        metric(),
        title(),
        subtitle(),
        stats(),
        momentum(),
      )
      return blocks

    case 'resumo':
      push(kicker(), title(), statsRow(), items(), momentum())
      return blocks

    case 'lista':
      push(kicker(), title(), listWithWeekBlock(ctx, data, theme, m, accent), stats(), momentum())
      return blocks

    case 'anel':
      push(statsRow(), ring() ?? metric(), barsBlock(ctx, data, theme, m, accent), momentum())
      return blocks

    case 'figura':
      push(kicker(), title(), ring() ?? metric(), statsRow(), momentum())
      return blocks

    case 'grade':
      push(kicker(), title(), gridBlock(ctx, figures.slice(0, 4), theme, m), momentum())
      return blocks

    case 'pilha':
      push(stackBlock(ctx, figures.slice(0, 4), theme, m), momentum())
      return blocks

    case 'recap':
      push(
        iconBlock(ctx, composition, m, accent, theme),
        metric(),
        sentenceBlock(ctx, data, theme, composition, m),
        secondary(),
        momentum(),
      )
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

/**
 * O selo do momento: um círculo na cor do eixo com a palavra que resume o
 * que aconteceu. É o "PR" do app de treino traduzido: recorde, marco, volta,
 * feito. Sobre foto o círculo fica branco, pela mesma razão do kicker.
 */
function badgeBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
  accent: string,
): Block {
  const size = 180
  const word = badgeWordOf(data.eventType)
  const fill = theme.shadow ? theme.ink : accent
  const inkOnFill = theme.shadow ? '#0a0a0b' : '#ffffff'
  const style: TextStyle = {
    // "Recorde" tem sete letras e precisa caber dentro do círculo com folga.
    size: word.length > 5 ? 32 : 44,
    weight: 800,
    color: inkOnFill,
    tracking: 2,
    uppercase: true,
  }

  return {
    gap: 0,
    height: size + 30,
    draw(y) {
      const cx = composition.align === 'center' ? m.x : m.x + size / 2
      const cy = y + size / 2

      ctx.save()
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.fill()
      // Duas fitas embaixo, como uma medalha: é o que faz o círculo ler como
      // selo e não como um botão.
      ctx.fillStyle = withAlpha(fill, 0.55)
      ctx.beginPath()
      ctx.moveTo(cx - 52, cy + size * 0.36)
      ctx.lineTo(cx - 22, cy + size / 2 + 30)
      ctx.lineTo(cx - 4, cy + size * 0.44)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx + 52, cy + size * 0.36)
      ctx.lineTo(cx + 22, cy + size / 2 + 30)
      ctx.lineTo(cx + 4, cy + size * 0.44)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      drawLine(ctx, word, cx, cy + style.size * 0.36, style, 'center')
    },
  }
}

function badgeWordOf(type: ShareCardData['eventType']): string {
  switch (type) {
    case 'momentum_record':
      return 'Recorde'
    case 'milestone':
    case 'challenge_milestone':
      return 'Marco'
    case 'comeback':
      return 'Voltei'
    case 'goal_completed':
    case 'challenge_completed':
      return 'Feito'
    case 'weekly_review':
      return 'Semana'
    case 'challenge_joined':
      return 'Dentro'
    default:
      return 'Hoje'
  }
}

/**
 * Números em linha: rótulo em cima, valor embaixo, até três colunas.
 *
 * É a linha "Duração · Volume · Recorde" do app de treino. Cada coluna tem a
 * mesma largura, então o card não muda de forma quando um valor é "1h30" e o
 * outro é "84".
 */
function statsRowBlock(
  ctx: CanvasRenderingContext2D,
  figures: readonly Figure[],
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
): Block {
  const labelStyle: TextStyle = { size: 30, weight: 500, color: theme.inkMuted }
  const valueStyle: TextStyle = { size: 60, weight: 700, color: theme.ink, tracking: -1 }
  const columnWidth = m.contentWidth / 3
  const centered = composition.align === 'center'
  const startX = centered ? m.x - (columnWidth * figures.length) / 2 : m.x

  return {
    gap: 36,
    drop: 45,
    height: labelStyle.size + 14 + valueStyle.size,
    draw(y) {
      figures.forEach((figure, index) => {
        // Centrado, cada coluna centra o seu texto; à esquerda, as colunas
        // alinham pela margem, como o título acima delas.
        const x = startX + columnWidth * index + (centered ? columnWidth / 2 : 0)
        const align = centered ? 'center' : 'left'
        const base = figure.value.length > 6 ? { ...valueStyle, size: 46 } : valueStyle
        if (figure.label) drawLine(ctx, figure.label, x, y + labelStyle.size * 0.8, labelStyle, align)
        drawLine(ctx, figure.value, x, y + labelStyle.size + 14 + base.size * 0.78, base, align)
      })
    },
  }
}

/**
 * A lista do que saiu e, à direita, a semana em pontos.
 *
 * Os sete pontos fazem o papel da figura do corpo no card de treino: dizem,
 * sem palavra, quanto da janela já tem movimento. Preferem os dias ativos;
 * sem eles, a sequência, até sete. Sem nenhum dos dois, a coluna some e a
 * lista ocupa a largura inteira.
 */
function listWithWeekBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block | null {
  const week = weekDotsOf(data)
  const style: TextStyle = { size: 36, weight: 500, color: theme.ink }
  const rowHeight = 62
  const dot = 30
  const gapAfterDot = 22
  const shown = data.items.slice(0, m.maxItems)
  const hidden = data.items.length - shown.length
  if (shown.length === 0 && !week) return null

  const columnWidth = week ? 150 : 0
  const listWidth = m.contentWidth - columnWidth
  const overflowStyle: TextStyle = { size: 30, weight: 500, color: theme.inkFaint }
  const dotsHeight = week ? 7 * 68 : 0
  const listHeight = shown.length * rowHeight + (hidden > 0 ? 40 : 0)
  const height = Math.max(listHeight, dotsHeight)

  return {
    gap: 36,
    drop: 60,
    height,
    draw(y) {
      shown.forEach((item, index) => {
        const rowY = y + index * rowHeight
        drawCheckDot(ctx, m.x, rowY + 4, dot, item.done, accent, theme.line)
        const label = truncateToWidth(ctx, item.label, style, listWidth - dot - gapAfterDot)
        drawLine(
          ctx,
          label,
          m.x + dot + gapAfterDot,
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
          'left',
        )
      }

      if (!week) return
      const cx = m.x + m.contentWidth - 40
      const labelStyle: TextStyle = {
        size: 22,
        weight: 700,
        color: theme.inkFaint,
        tracking: 3,
        uppercase: true,
      }
      week.labels.forEach((letter, index) => {
        const cy = y + 34 + index * 68
        const active = index < week.active
        ctx.save()
        ctx.fillStyle = active ? (theme.shadow ? theme.ink : accent) : 'transparent'
        ctx.strokeStyle = active ? 'transparent' : theme.line
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, 22, 0, Math.PI * 2)
        if (active) ctx.fill()
        else ctx.stroke()
        ctx.restore()
        drawLine(ctx, letter, cx - 48, cy + labelStyle.size * 0.36, labelStyle, 'center')
      })
    },
  }
}

const WEEKDAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const

function weekDotsOf(
  data: ShareCardData,
): { readonly active: number; readonly labels: readonly string[] } | null {
  const activeDays = data.stats.find((stat) => stat.label === 'dias ativos')
  if (activeDays) {
    const active = Number.parseInt(activeDays.value, 10)
    if (Number.isFinite(active)) return { active: Math.min(7, active), labels: WEEKDAY_LETTERS }
  }
  const streak = data.stats.find(
    (stat) => stat.label === 'dia seguido' || stat.label === 'dias seguidos',
  )
  if (streak) {
    const days = Number.parseInt(streak.value, 10)
    if (Number.isFinite(days) && days > 0) {
      return {
        active: Math.min(7, days),
        labels: Array.from({ length: 7 }, (_, index) => `${index + 1}`),
      }
    }
  }
  return null
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  maxWidth: number,
): string {
  if (measureText(ctx, text, style) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && measureText(ctx, `${cut}…`, style) > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
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

/** O raio da marca, na cor do eixo. É o "halter" do card de treino. */
function iconBlock(
  ctx: CanvasRenderingContext2D,
  composition: ShareComposition,
  m: Metrics,
  accent: string,
  theme: ShareTheme,
): Block {
  const size = 120
  // O raio da marca (o mesmo do ícone `raio`), em pontos de um quadrado de 24.
  const points: readonly (readonly [number, number])[] = [
    [13, 3],
    [5, 14],
    [11, 14],
    [10, 21],
    [18, 10],
    [12, 10],
  ]

  return {
    gap: 0,
    height: size + 20,
    draw(y) {
      const x = composition.align === 'center' ? m.x - size / 2 : m.x
      const unit = size / 24
      ctx.save()
      ctx.fillStyle = theme.shadow ? theme.ink : accent
      ctx.beginPath()
      points.forEach(([px, py], index) => {
        if (index === 0) ctx.moveTo(x + px * unit, y + py * unit)
        else ctx.lineTo(x + px * unit, y + py * unit)
      })
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    },
  }
}

/**
 * A frase do recap, escrita a partir da linha de apoio: "São 12 dias
 * seguidos, 5 hábitos e 3 ações." Sem dados de apoio, entra o subtítulo.
 */
function sentenceBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
): Block | null {
  const text = sentenceOf(data)
  if (!text) return null
  const style: TextStyle = { size: 40, weight: 400, color: theme.inkMuted, leading: 1.34 }
  const lines = wrapLines(ctx, text, style, m.contentWidth, 4)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 24,
    drop: 20,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, composition.align)
      })
    },
  }
}

function sentenceOf(data: ShareCardData): string | null {
  // Só o que é quantidade entra na frase: "Leitura" solto no meio de "12 dias
  // seguidos e 5 hábitos" não é uma soma, é um nome.
  const parts = data.stats.filter((stat) => stat.label).map((stat) => `${stat.value} ${stat.label}`)
  if (parts.length === 0) return data.subtitle
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
  const opening = data.title ? `${data.title}. ` : ''
  return `${opening}São ${joined}.`
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

function subtitleBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
): Block {
  const style: TextStyle = { size: 38, weight: 400, color: theme.inkMuted, leading: 1.34 }
  const lines = wrapLines(ctx, text, style, m.contentWidth, 3)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 20,
    drop: 20,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, composition.align)
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
  composition: ShareComposition,
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
      drawLine(ctx, data.primaryMetric.value, m.x, y + style.size * 0.74, style, composition.align)
      if (data.primaryMetric.label) {
        drawLine(
          ctx,
          data.primaryMetric.label,
          m.x,
          y + style.size * 0.78 + labelGap + labelStyle.size * 0.8,
          labelStyle,
          composition.align,
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
  composition: ShareComposition,
  m: Metrics,
): Block {
  const style: TextStyle = { size: 38, weight: 500, color: theme.inkMuted, leading: 1.3 }
  const text = label ? `${value} ${label}` : value
  const lines = wrapLines(ctx, text, style, m.contentWidth, 2)
  const lineHeight = lineHeightOf(style)

  return {
    gap: 26,
    drop: 30,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        drawLine(ctx, line, m.x, y + lineHeight * (index + 0.78), style, composition.align)
      })
    },
  }
}

/**
 * A linha de apoio: sequencia, avanco, contagens e area.
 *
 * Uma linha so, com o valor em peso maior que o rotulo e um ponto separando as
 * informacoes. Sem caixa, sem chip e sem icone: a moldura desenhada por cima de
 * um Story e o que denuncia que a imagem saiu de um app, e essa linha existe
 * justamente pra dar densidade ao card sem custar essa impressao.
 *
 * Quebra em duas linhas quando nao cabe, e a segunda continua no mesmo ritmo.
 * Encolher a fonte pra forcar tudo numa linha faria a densidade do card variar
 * conforme o que a pessoa ligou.
 */
function statsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
  accent: string,
): Block {
  const valueStyle: TextStyle = { size: 34, weight: 700, color: theme.ink }
  const labelStyle: TextStyle = { size: 34, weight: 400, color: theme.inkMuted }
  const separatorStyle: TextStyle = { size: 34, weight: 400, color: theme.inkFaint }

  const gapAfterValue = 10
  const separator = '·'
  const separatorSpace = 18
  const lineHeight = 50

  // Cada estatistica vira uma peca medida: valor em negrito, rotulo ao lado.
  const parts = data.stats.map((stat) => {
    const valueWidth = measureText(ctx, stat.value, valueStyle)
    const labelWidth = stat.label ? measureText(ctx, stat.label, labelStyle) : 0
    return {
      stat,
      width: valueWidth + (stat.label ? gapAfterValue + labelWidth : 0),
      valueWidth,
    }
  })

  const separatorWidth = measureText(ctx, separator, separatorStyle) + separatorSpace * 2

  // A quebra e por largura acumulada, do mesmo jeito que o texto quebra: e o
  // que mantem a linha alinhada com a margem em vez de vazar pela direita.
  const lines: (typeof parts)[] = []
  let current: typeof parts = []
  let width = 0

  for (const part of parts) {
    const extra = current.length === 0 ? part.width : separatorWidth + part.width
    if (current.length > 0 && width + extra > m.contentWidth) {
      lines.push(current)
      current = [part]
      width = part.width
      continue
    }
    current.push(part)
    width += extra
  }
  if (current.length > 0) lines.push(current)

  return {
    gap: 30,
    drop: 50,
    height: lines.length * lineHeight,
    draw(y) {
      lines.forEach((line, index) => {
        const lineWidth = line.reduce(
          (sum, part, position) => sum + part.width + (position === 0 ? 0 : separatorWidth),
          0,
        )
        let cursor = composition.align === 'center' ? m.x - lineWidth / 2 : m.x
        const baseline = y + lineHeight * index + valueStyle.size * 0.82

        line.forEach((part, position) => {
          if (position > 0) {
            drawLine(ctx, separator, cursor + separatorSpace, baseline, separatorStyle, 'left')
            cursor += separatorWidth
          }

          drawLine(
            ctx,
            part.stat.value,
            cursor,
            baseline,
            // O valor puxa a cor do eixo quando ela existe: e o que faz a linha
            // ler como dado do app e nao como legenda esquecida.
            { ...valueStyle, color: theme.shadow ? theme.ink : accent },
            'left',
          )
          cursor += part.valueWidth

          if (part.stat.label) {
            cursor += gapAfterValue
            drawLine(ctx, part.stat.label, cursor, baseline, labelStyle, 'left')
            cursor += measureText(ctx, part.stat.label, labelStyle)
          }
        })
      })
    },
  }
}

/**
 * O anel de progresso, com o número dentro.
 *
 * Um anel diz o que um número solto não diz: QUANTO FALTA. É por isso que ele
 * substitui o número gigante em vez de acompanhá-lo — os dois juntos seriam a
 * mesma informação em duas linguagens, e o card ficaria com dois centros.
 *
 * Sem percentual (marco, retomada, entrada em desafio) o anel não é desenhado:
 * um círculo cheio pela metade sem número é decoração, e decoração que parece
 * dado é pior que dado nenhum.
 */
function ringBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block | null {
  const ratio = data.completionPercentage
  if (ratio === null) return null

  const size = Math.min(m.contentWidth, 520)
  const thickness = 30
  const radius = (size - thickness) / 2

  const valueStyle: TextStyle = { size: 150, weight: 700, color: theme.ink, tracking: -4 }
  const labelStyle: TextStyle = { size: 32, weight: 500, color: theme.inkMuted }

  return {
    gap: 44,
    height: size,
    draw(y) {
      const cx = m.x
      const cy = y + size / 2

      ctx.save()
      ctx.lineWidth = thickness
      ctx.lineCap = 'round'

      // O trilho inteiro primeiro: é ele que mostra o tamanho do caminho.
      ctx.strokeStyle = theme.line
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()

      // O preenchimento começa no topo e anda no sentido do relógio, como
      // qualquer mostrador que a pessoa já viu na vida.
      const start = -Math.PI / 2
      ctx.strokeStyle = accent
      ctx.beginPath()
      ctx.arc(cx, cy, radius, start, start + Math.PI * 2 * Math.min(1, Math.max(0, ratio)))
      ctx.stroke()
      ctx.restore()

      drawLine(ctx, `${Math.round(ratio * 100)}%`, cx, cy + valueStyle.size * 0.28, valueStyle, 'center')

      if (data.primaryMetric.label) {
        drawLine(ctx, data.primaryMetric.label, cx, cy + valueStyle.size * 0.28 + 52, labelStyle, 'center')
      }
    },
  }
}

/**
 * As barras do que tem dois lados.
 *
 * Momentum antes e depois, e o avanço do objetivo. Duas barras no máximo: a
 * terceira transformaria o card num relatório, e relatório é o que a pessoa
 * abre no app, não o que ela posta.
 */
function barsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block | null {
  const bars: { label: string; ratio: number; value: string }[] = []

  if (data.momentumBefore !== null && data.momentumAfter !== null) {
    bars.push({
      label: 'Momentum antes',
      ratio: data.momentumBefore / 100,
      value: `${data.momentumBefore}`,
    })
    bars.push({
      label: 'Momentum agora',
      ratio: data.momentumAfter / 100,
      value: `${data.momentumAfter}`,
    })
  }

  if (bars.length === 0) return null

  const labelStyle: TextStyle = { size: 28, weight: 500, color: theme.inkMuted }
  const valueStyle: TextStyle = { size: 28, weight: 700, color: theme.ink }
  const thickness = 16
  const rowHeight = 78

  return {
    gap: 40,
    drop: 45,
    height: bars.length * rowHeight,
    draw(y) {
      bars.forEach((bar, index) => {
        const rowY = y + index * rowHeight
        const left = m.x - m.contentWidth / 2

        drawLine(ctx, bar.label, left, rowY + labelStyle.size, labelStyle, 'left')
        const valueWidth = measureText(ctx, bar.value, valueStyle)
        drawLine(ctx, bar.value, left + m.contentWidth - valueWidth, rowY + valueStyle.size, valueStyle, 'left')

        drawProgressTrack(
          ctx,
          left,
          rowY + labelStyle.size + 20,
          m.contentWidth,
          bar.ratio,
          theme.line,
          // A barra "antes" é a mesma cor com menos força: comparação entre
          // duas cores diferentes viraria disputa em vez de percurso.
          index === bars.length - 1 ? accent : withAlpha(accent, 0.42),
          thickness,
        )
      })
    },
  }
}

function itemsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
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
    drop: 60,
    height,
    draw(y) {
      shown.forEach((item, index) => {
        const rowY = y + index * rowHeight
        const labelWidth = measureText(ctx, item.label, style)
        const rowWidth = dot + gapAfterDot + labelWidth
        const startX = composition.align === 'center' ? m.x - rowWidth / 2 : m.x

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
          composition.align,
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
  const labelWidth = measureText(ctx, 'Momentum', labelStyle)
  const valueWidth = measureText(ctx, value, valueStyle)
  const total = labelWidth + spacing + valueWidth

  return {
    gap: 34,
    drop: 40,
    height: valueStyle.size,
    draw(y) {
      const startX = composition.align === 'center' ? m.x - total / 2 : m.x
      const baseline = y + valueStyle.size * 0.78

      drawLine(ctx, 'Momentum', startX, baseline - 2, labelStyle, 'left')
      drawLine(ctx, value, startX + labelWidth + spacing, baseline, valueStyle, 'left')
    },
  }
}
