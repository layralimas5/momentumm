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
  /** A cor: preto, neon, branco ou PNG. */
  readonly template: ShareTemplateId
  /** O arranjo: destaque, cartaz, editorial, tópicos, gráfico ou mapa. */
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
    // No editorial a frase é o assunto, então o título cresce e o número recua.
    titleSize: composition.id === 'editorial' ? 84 : 68,
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
  const composition = SHARE_COMPOSITIONS_BY_ID[options.composition ?? 'destaque']
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
  const footerTop = drawFooter(ctx, data, theme, composition, m, height)

  const available0 = footerTop - headerBottom
  const blocks = fitBlocks(buildBody(ctx, data, theme, composition, m, accent), available0)
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
  const available = available0
  const anchorBottom = photo !== null || composition.anchor === 'bottom'
  const offset = anchorBottom ? Math.max(0, available - total) : Math.max(0, (available - total) / 2)
  let cursor = headerBottom + offset

  blocks.forEach((block, index) => {
    if (index > 0) cursor += block.gap
    block.draw(cursor)
    cursor += block.height
  })

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

/** Devolve o topo do rodapé: é onde o corpo do card precisa parar. */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  composition: ShareComposition,
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

    if (composition.align === 'center') {
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
    drawLine(ctx, data.note, m.x, baseline, noteStyle, composition.align)
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
  composition: ShareComposition,
  m: Metrics,
  accent: string,
): Block[] {
  const blocks: Block[] = []
  const full = composition.density === 'full'
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
    full && data.items.length > 0 ? itemsBlock(ctx, data, theme, composition, m, accent) : null
  const momentum = () =>
    showsMomentum ? momentumBlock(ctx, data, theme, composition, m, accent) : null

  const push = (...candidates: readonly (Block | null)[]) => {
    for (const block of candidates) if (block) blocks.push(block)
  }

  /*
    Cada composição é uma ORDEM de blocos, e é só isso.

    Nenhuma delas tem função de desenho própria: gráfico e mapa acrescentam um
    bloco novo, e o resto é a mesma pilha em sequências diferentes. Foi assim
    que quatro cores e seis arranjos couberam num renderizador só — e é por isso
    que uma correção no bloco do momentum vale pros vinte e quatro cards.
  */
  switch (composition.id) {
    case 'cartaz':
      push(kicker(), metric(), stats(), title(), subtitle(), secondary(), momentum())
      return blocks

    case 'editorial':
      push(
        kicker(),
        title(),
        ruleBlock(ctx, theme, composition, m, accent),
        metric(),
        stats(),
        subtitle(),
        secondary(),
        items(),
        momentum(),
      )
      return blocks

    case 'topicos':
      push(
        kicker(),
        title(),
        bulletsBlock(ctx, data, theme, m, accent),
        items(),
        momentum(),
      )
      return blocks

    case 'grafico':
      push(
        kicker(),
        title(),
        ringBlock(ctx, data, theme, m, accent),
        barsBlock(ctx, data, theme, m, accent),
        stats(),
        items(),
        momentum(),
      )
      return blocks

    case 'mapa':
      push(kicker(), mapBlock(ctx, data, theme, m, accent), subtitle(), momentum())
      return blocks

    case 'destaque':
      push(kicker(), title(), subtitle(), metric(), secondary(), stats(), items(), momentum())
      return blocks
  }
}

/** A régua do editorial: um traço curto na cor do eixo, e nada mais. */
function ruleBlock(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  composition: ShareComposition,
  m: Metrics,
  accent: string,
): Block {
  const width = 140
  const thickness = 5

  return {
    gap: 34,
    height: thickness,
    draw(y) {
      ctx.fillStyle = theme.shadow ? theme.ink : accent
      const startX = composition.align === 'center' ? m.x - width / 2 : m.x
      ctx.fillRect(startX, y, width, thickness)
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
 * Tópicos — cada informação numa linha, com marcador.
 *
 * O marcador é um traço curto na cor do eixo, e não um ponto: o ponto some no
 * meio do texto em corpo grande, e um ícone por linha viraria decoração. As
 * informações vêm da linha de apoio e das métricas — as MESMAS de sempre, só
 * que empilhadas em vez de escaladas por importância. É a composição pra quando
 * o card tem várias coisas a dizer e nenhuma é maior que as outras.
 */
function bulletsBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block {
  const style: TextStyle = { size: 40, weight: 500, color: theme.ink, leading: 1.25 }
  const dash = 46
  const gapAfterDash = 24
  const rowGap = 26
  const textWidth = m.contentWidth - dash - gapAfterDash

  const lines: string[] = []

  if (data.primaryMetric.value) {
    lines.push(
      data.primaryMetric.label
        ? `${data.primaryMetric.value} ${data.primaryMetric.label}`
        : data.primaryMetric.value,
    )
  }
  if (data.secondaryMetric) {
    lines.push(
      data.secondaryMetric.label
        ? `${data.secondaryMetric.value} ${data.secondaryMetric.label}`
        : data.secondaryMetric.value,
    )
  }
  for (const stat of data.stats) {
    lines.push(stat.label ? `${stat.value} ${stat.label}` : stat.value)
  }

  const rows = lines.map((text) => wrapLines(ctx, text, style, textWidth, 2))
  const lineHeight = lineHeightOf(style)
  const height = rows.reduce((sum, row) => sum + row.length * lineHeight + rowGap, 0)

  return {
    gap: 34,
    drop: 55,
    height: Math.max(0, height - rowGap),
    draw(y) {
      let cursor = y
      for (const row of rows) {
        ctx.fillStyle = accent
        ctx.fillRect(m.x, cursor + lineHeight * 0.42, dash, 4)

        row.forEach((line, index) => {
          drawLine(
            ctx,
            line,
            m.x + dash + gapAfterDash,
            cursor + lineHeight * (index + 0.75),
            style,
            'left',
          )
        })

        cursor += row.length * lineHeight + rowGap
      }
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

/**
 * O mapa: o assunto no centro e o que sai dele em volta.
 *
 * Cada informação vira um nó ligado ao centro por um traço curvo. É a leitura
 * que mostra PERTENCIMENTO — as partes só fazem sentido porque saem da mesma
 * coisa —, e é por isso que o número do meio é o do card e os nós são a linha
 * de apoio, nunca o contrário.
 *
 * No máximo quatro nós, dois de cada lado. Seis viram teia, e teia não se lê
 * num Story que dura cinco segundos.
 */
function mapBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  theme: ShareTheme,
  m: Metrics,
  accent: string,
): Block | null {
  const nodes = [
    ...data.stats.map((stat) => (stat.label ? `${stat.value} ${stat.label}` : stat.value)),
    ...(data.secondaryMetric
      ? [
          data.secondaryMetric.label
            ? `${data.secondaryMetric.value} ${data.secondaryMetric.label}`
            : data.secondaryMetric.value,
        ]
      : []),
    ...data.items.filter((item) => item.done).map((item) => item.label),
  ].slice(0, 4)

  if (nodes.length === 0) return null

  const centerStyle: TextStyle = { size: 120, weight: 700, color: theme.ink, tracking: -3 }
  const centerLabelStyle: TextStyle = { size: 30, weight: 500, color: theme.inkMuted }
  const nodeStyle: TextStyle = { size: 32, weight: 500, color: theme.ink, leading: 1.2 }

  const centerRadius = 150
  const rowGap = 118
  const height = centerRadius * 2 + Math.ceil(nodes.length / 2) * rowGap

  return {
    gap: 40,
    height,
    draw(y) {
      const cx = m.x
      const cy = y + centerRadius

      ctx.save()
      ctx.strokeStyle = theme.line
      ctx.lineWidth = 2

      nodes.forEach((node, index) => {
        const side = index % 2 === 0 ? -1 : 1
        const row = Math.floor(index / 2)
        const nodeY = cy + centerRadius + 40 + row * rowGap
        const nodeX = cx + side * (m.contentWidth / 2 - 40)

        // O traço sai do centro e curva até o nó: reta ligando dois pontos em
        // diagonal cruzaria o número quando o nó fica logo abaixo dele.
        ctx.beginPath()
        ctx.moveTo(cx, cy + centerRadius - 10)
        ctx.quadraticCurveTo(cx, nodeY, nodeX - side * 40, nodeY)
        ctx.stroke()

        const lines = wrapLines(ctx, node, nodeStyle, m.contentWidth / 2 - 60, 2)
        lines.forEach((line, position) => {
          drawLine(
            ctx,
            line,
            nodeX,
            nodeY + lineHeightOf(nodeStyle) * position,
            nodeStyle,
            side === -1 ? 'left' : 'left',
          )
        })
      })

      ctx.restore()

      // O centro por último: ele passa por cima dos traços que chegam nele.
      ctx.fillStyle = withAlpha(accent, 0.16)
      ctx.beginPath()
      ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.strokeStyle = withAlpha(accent, 0.6)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      const value = data.primaryMetric.value || `${data.momentumAfter ?? ''}`
      const scale = value.length > 4 ? 4 / value.length : 1
      drawLine(
        ctx,
        value,
        cx,
        cy + centerStyle.size * scale * 0.24,
        { ...centerStyle, size: centerStyle.size * scale },
        'center',
      )

      if (data.primaryMetric.label) {
        drawLine(ctx, data.primaryMetric.label, cx, cy + centerRadius * 0.62, centerLabelStyle, 'center')
      }
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
