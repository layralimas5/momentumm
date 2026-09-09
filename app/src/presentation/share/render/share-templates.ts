import type { ShareCompositionId, ShareTemplateId } from '@/domain/share/share-card'
import { roundRect, withAlpha, type TextAlign } from './canvas-kit'

/**
 * Cor e arranjo, separados.
 *
 * `ShareTheme` responde COM QUE COR o card é pintado — fundo, tinta, linha,
 * moldura. `ShareComposition` responde COMO a informação se organiza dentro
 * dele — ordem dos blocos, alinhamento, âncora, tamanho do número e se existe
 * gráfico ou mapa.
 *
 * Antes as duas coisas moravam na mesma descrição, e a consequência era um
 * template novo por combinação: "cartaz claro" e "cartaz escuro" seriam duas
 * cópias que divergiriam na primeira correção. Separadas, quatro cores e seis
 * arranjos dão vinte e quatro cards com dez descrições.
 */

export interface ShareTheme {
  readonly id: ShareTemplateId
  readonly transparent: boolean
  readonly ink: string
  readonly inkMuted: string
  readonly inkFaint: string
  readonly line: string
  readonly chipBg: string
  readonly chipInk: string
  /** Sombra atrás do texto: só o transparente precisa, sobre foto alheia. */
  readonly shadow: boolean
  paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string): void
  /** Desenhado DEPOIS do conteúdo: moldura, faixa, traço de borda. */
  paintForeground?(ctx: CanvasRenderingContext2D, width: number, height: number, accent: string): void
}

/**
 * O arranjo.
 *
 * - `destaque`: kicker, título, número no meio. A leitura do app.
 * - `cartaz`: o número primeiro e enorme, texto encostado no rodapé.
 * - `editorial`: título grande, régua fina, número em corpo menor.
 * - `topicos`: tudo vira lista, uma informação por linha.
 * - `grafico`: anel de progresso e barras no lugar do número solto.
 * - `mapa`: o assunto no centro e o que sai dele em volta.
 */
export interface ShareComposition {
  readonly id: ShareCompositionId
  readonly align: TextAlign
  /** `minimal` corta a lista de itens: sobra o essencial. */
  readonly density: 'full' | 'minimal'
  /** Quantos itens da lista cabem antes do "+N outras". */
  readonly maxItems?: number
  readonly anchor: 'center' | 'bottom'
  /** Multiplicador do tamanho do número. */
  readonly metricScale: number
  /** Desenha o anel de progresso no lugar do número. */
  readonly chart?: 'anel'
  /** Desenha o mapa: centro e ramos. */
  readonly diagram?: 'mapa'
  /** Kicker, título e stats viram linhas de lista com marcador. */
  readonly bulleted?: boolean
}

const CANVAS_BLACK = '#0a0a0b'
const INK_LIGHT = '#f4f4f5'
const INK_LIGHT_MUTED = '#a1a1aa'
const INK_LIGHT_FAINT = '#71717a'

function paintFlat(color: string) {
  return (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)
  }
}

/**
 * Preto — a identidade do app.
 *
 * Fundo quase preto com um brilho do eixo no canto superior. O brilho é fraco
 * de propósito: em preto, qualquer luz forte vira mancha cinza, e o objetivo é
 * dar profundidade sem competir com o número.
 */
export const SHARE_TEMPLATE_DARK: ShareTheme = {
  id: 'dark',
  transparent: false,
  ink: INK_LIGHT,
  inkMuted: INK_LIGHT_MUTED,
  inkFaint: '#8b8b96',
  line: '#26262c',
  chipBg: '#18181c',
  chipInk: INK_LIGHT,
  shadow: false,
  paintBackground(ctx, width, height, accent) {
    ctx.fillStyle = CANVAS_BLACK
    ctx.fillRect(0, 0, width, height)

    const glow = ctx.createRadialGradient(
      width * 0.14,
      height * 0.1,
      0,
      width * 0.14,
      height * 0.1,
      width * 1.05,
    )
    glow.addColorStop(0, withAlpha(accent, 0.2))
    glow.addColorStop(0.45, withAlpha(accent, 0.04))
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
  },
}

/**
 * Neon — moldura acesa no escuro.
 *
 * A única cor com moldura, e ela é fina e por dentro da margem: é a borda que
 * dá forma de peça ao card sem virar a caixa que denuncia captura de app.
 */
export const SHARE_TEMPLATE_NEON: ShareTheme = {
  id: 'neon',
  transparent: false,
  ink: INK_LIGHT,
  inkMuted: INK_LIGHT_MUTED,
  inkFaint: INK_LIGHT_FAINT,
  line: 'rgba(255, 255, 255, 0.2)',
  chipBg: 'rgba(255, 255, 255, 0.08)',
  chipInk: INK_LIGHT,
  shadow: false,
  paintBackground(ctx, width, height, accent) {
    ctx.fillStyle = CANVAS_BLACK
    ctx.fillRect(0, 0, width, height)

    const glow = ctx.createRadialGradient(
      width / 2,
      height * 0.88,
      0,
      width / 2,
      height * 0.88,
      width * 0.95,
    )
    glow.addColorStop(0, withAlpha(accent, 0.3))
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
  },
  paintForeground(ctx, width, height, accent) {
    const inset = 44
    const radius = 46

    ctx.save()
    ctx.strokeStyle = withAlpha(accent, 0.75)
    ctx.lineWidth = 3
    ctx.shadowColor = withAlpha(accent, 0.55)
    ctx.shadowBlur = 26
    roundRect(ctx, inset, inset, width - inset * 2, height - inset * 2, radius)
    ctx.stroke()
    ctx.restore()
  },
}

/** Branco — fundo claro e muito espaço em branco. */
export const SHARE_TEMPLATE_LIGHT: ShareTheme = {
  id: 'light',
  transparent: false,
  ink: '#0a0a0b',
  inkMuted: '#52525b',
  inkFaint: '#8b8b96',
  line: '#e4e4e7',
  chipBg: '#f1f1f3',
  chipInk: '#0a0a0b',
  shadow: false,
  paintBackground: paintFlat('#fafafa'),
}

/**
 * PNG — sem fundo, pra ir por cima da foto da pessoa.
 *
 * Texto branco com sombra suave: é a única forma de garantir leitura sem saber
 * o que vai atrás. Pintar uma caixa escura por baixo resolveria o contraste e
 * destruiria o motivo de o template existir.
 */
export const SHARE_TEMPLATE_TRANSPARENT: ShareTheme = {
  id: 'transparent',
  transparent: true,
  ink: '#ffffff',
  inkMuted: 'rgba(255, 255, 255, 0.82)',
  inkFaint: 'rgba(255, 255, 255, 0.62)',
  line: 'rgba(255, 255, 255, 0.35)',
  chipBg: 'rgba(255, 255, 255, 0.16)',
  chipInk: '#ffffff',
  shadow: true,
  paintBackground(ctx, width, height) {
    ctx.clearRect(0, 0, width, height)
  },
}

export const SHARE_THEMES: Readonly<Record<ShareTemplateId, ShareTheme>> = {
  dark: SHARE_TEMPLATE_DARK,
  neon: SHARE_TEMPLATE_NEON,
  light: SHARE_TEMPLATE_LIGHT,
  transparent: SHARE_TEMPLATE_TRANSPARENT,
}

/**
 * O tema quando existe foto de fundo.
 *
 * Com a foto da pessoa atrás, a paleta perde o sentido: o branco ficaria com
 * texto preto sobre uma foto noturna e sumiria. Sobre foto existe uma resposta
 * certa só — branco com sombra —, então a cor deixa de decidir e o arranjo
 * continua valendo inteiro.
 *
 * O fundo não é pintado aqui: quem desenha a foto e o véu é o renderizador,
 * porque só ele conhece o recorte e a proporção do arquivo escolhido. A
 * moldura também sai: um traço desenhado por cima da foto de alguém é
 * exatamente o que entrega que a imagem saiu de um app.
 */
export function overPhoto(theme: ShareTheme): ShareTheme {
  const { paintForeground: _framed, ...rest } = theme

  return {
    ...rest,
    ink: '#ffffff',
    inkMuted: 'rgba(255, 255, 255, 0.88)',
    inkFaint: 'rgba(255, 255, 255, 0.7)',
    line: 'rgba(255, 255, 255, 0.4)',
    chipBg: 'rgba(255, 255, 255, 0.16)',
    chipInk: '#ffffff',
    transparent: false,
    shadow: true,
    paintBackground: () => {},
  }
}

// ---------------------------------------------------------------------------
// composições
// ---------------------------------------------------------------------------

/** Destaque — o número no meio, com o título acima. */
export const SHARE_COMPOSITION_DESTAQUE: ShareComposition = {
  id: 'destaque',
  align: 'left',
  density: 'full',
  anchor: 'center',
  metricScale: 1,
}

/**
 * Cartaz — o número é a notícia.
 *
 * Ele vem antes do título e cresce; o título vira a legenda dele. O conteúdo
 * encosta embaixo, então o topo fica limpo — que é o que faz o card ser
 * reconhecido no meio de uma sequência de Stories.
 */
export const SHARE_COMPOSITION_CARTAZ: ShareComposition = {
  id: 'cartaz',
  align: 'left',
  // Lista curta: no cartaz o número é o assunto, e quatro linhas são o que
  // cabe embaixo dele sem transformar o card num relatório.
  density: 'full',
  maxItems: 4,
  anchor: 'bottom',
  metricScale: 1.16,
}

/**
 * Editorial — quando a frase é a notícia.
 *
 * Régua fina entre o título e o número, e o número recua pra corpo menor: em
 * "Objetivo concluído" ou "Você voltou", o dado é o detalhe e a frase é o
 * assunto. É o contrário do Cartaz, de propósito.
 */
export const SHARE_COMPOSITION_EDITORIAL: ShareComposition = {
  id: 'editorial',
  align: 'left',
  density: 'full',
  anchor: 'bottom',
  metricScale: 0.62,
}

/**
 * Tópicos — a mesma história em lista.
 *
 * Cada informação vira uma linha com marcador, inclusive as que nos outros
 * arranjos são texto corrido. Serve pra semana e pra rotina, onde o card tem
 * várias coisas pra dizer e nenhuma delas é maior que as outras.
 */
export const SHARE_COMPOSITION_TOPICOS: ShareComposition = {
  id: 'topicos',
  align: 'left',
  density: 'full',
  maxItems: 8,
  anchor: 'bottom',
  metricScale: 0.5,
  bulleted: true,
}

/**
 * Gráfico — o progresso desenhado.
 *
 * Um anel com o percentual no centro, e as barras do momentum e do que mais
 * tiver dois lados. É a composição pra quando o número tem CONTEXTO: 58% num
 * anel diz quanto falta, e "42% -> 58%" numa barra diz de onde veio.
 */
export const SHARE_COMPOSITION_GRAFICO: ShareComposition = {
  id: 'grafico',
  align: 'center',
  density: 'full',
  maxItems: 4,
  anchor: 'center',
  metricScale: 1,
  chart: 'anel',
}

/**
 * Mapa — o centro e o que sai dele.
 *
 * O assunto no meio, as informações em volta ligadas por um traço. É a leitura
 * que mostra que aquilo tudo pertence a uma coisa só — útil no dia e no
 * objetivo, onde as partes só fazem sentido juntas.
 */
export const SHARE_COMPOSITION_MAPA: ShareComposition = {
  id: 'mapa',
  align: 'center',
  density: 'minimal',
  anchor: 'center',
  metricScale: 0.72,
  diagram: 'mapa',
}

export const SHARE_COMPOSITIONS_BY_ID: Readonly<Record<ShareCompositionId, ShareComposition>> = {
  destaque: SHARE_COMPOSITION_DESTAQUE,
  cartaz: SHARE_COMPOSITION_CARTAZ,
  editorial: SHARE_COMPOSITION_EDITORIAL,
  topicos: SHARE_COMPOSITION_TOPICOS,
  grafico: SHARE_COMPOSITION_GRAFICO,
  mapa: SHARE_COMPOSITION_MAPA,
}
