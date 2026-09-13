import type { ShareCompositionId, ShareTemplateId } from '@/domain/share/share-card'
import { roundRect, withAlpha, type TextAlign } from './canvas-kit'

/**
 * Cor e arranjo, separados.
 *
 * `ShareTheme` responde COM QUE COR o card é pintado — fundo, tinta, linha,
 * moldura. `ShareComposition` responde COMO a informação se organiza dentro
 * dele — ordem dos blocos, alinhamento, âncora, tamanho do número.
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
 * Cada composição é uma ORDEM de blocos no renderizador mais estes ajustes de
 * alinhamento, âncora, tamanho de título e de número. Nenhuma tem função de
 * desenho própria.
 */
export interface ShareComposition {
  readonly id: ShareCompositionId
  readonly align: TextAlign
  /** Quantos itens da lista cabem antes do "+N outras". */
  readonly maxItems?: number
  readonly anchor: 'center' | 'bottom'
  /** Multiplicador do tamanho do número. */
  readonly metricScale: number
  readonly titleSize: number
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

/** Selo — o selo do momento no alto, o número grande e o que ele é. */
export const SHARE_COMPOSITION_SELO: ShareComposition = {
  id: 'selo',
  align: 'left',
  anchor: 'center',
  metricScale: 0.9,
  titleSize: 72,
}

/**
 * Resumo — o título, três números em linha e a lista do que saiu.
 *
 * É o card de "como foi o dia": a linha de números responde rápido e a lista
 * conta o resto. Seis itens no máximo: acima disso o card vira relatório.
 */
export const SHARE_COMPOSITION_RESUMO: ShareComposition = {
  id: 'resumo',
  align: 'left',
  anchor: 'center',
  maxItems: 6,
  titleSize: 76,
  metricScale: 0.5,
}

/**
 * Lista — o que saiu à esquerda e a semana à direita.
 *
 * A coluna de pontos faz o papel que a figura do corpo faz no app de treino:
 * mostra, sem palavra nenhuma, quanto da semana já tem movimento.
 */
export const SHARE_COMPOSITION_LISTA: ShareComposition = {
  id: 'lista',
  align: 'left',
  anchor: 'center',
  maxItems: 7,
  titleSize: 72,
  metricScale: 0.5,
}

/** Anel — os números em cima e o progresso desenhado no meio. */
export const SHARE_COMPOSITION_ANEL: ShareComposition = {
  id: 'anel',
  align: 'center',
  anchor: 'center',
  maxItems: 4,
  titleSize: 64,
  metricScale: 1,
}

/** Figura — o desenho no centro, título em cima e os números embaixo. */
export const SHARE_COMPOSITION_FIGURA: ShareComposition = {
  id: 'figura',
  align: 'center',
  anchor: 'center',
  titleSize: 68,
  metricScale: 1,
}

/** Grade — quatro números grandes, um em cada canto. */
export const SHARE_COMPOSITION_GRADE: ShareComposition = {
  id: 'grade',
  align: 'left',
  anchor: 'center',
  titleSize: 72,
  metricScale: 0.5,
}

/** Pilha — tudo centrado, um número embaixo do outro, assinatura no meio. */
export const SHARE_COMPOSITION_PILHA: ShareComposition = {
  id: 'pilha',
  align: 'center',
  anchor: 'center',
  titleSize: 60,
  metricScale: 0.5,
}

/**
 * Recap — o ícone, o número e a frase que o explica.
 *
 * "10 treinos. São 8 horas de esforço." O número é a manchete e a frase é o
 * subtítulo, escrita a partir dos mesmos dados da linha de apoio.
 */
export const SHARE_COMPOSITION_RECAP: ShareComposition = {
  id: 'recap',
  align: 'left',
  anchor: 'center',
  titleSize: 64,
  metricScale: 1.1,
}

export const SHARE_COMPOSITIONS_BY_ID: Readonly<Record<ShareCompositionId, ShareComposition>> = {
  selo: SHARE_COMPOSITION_SELO,
  resumo: SHARE_COMPOSITION_RESUMO,
  lista: SHARE_COMPOSITION_LISTA,
  anel: SHARE_COMPOSITION_ANEL,
  figura: SHARE_COMPOSITION_FIGURA,
  grade: SHARE_COMPOSITION_GRADE,
  pilha: SHARE_COMPOSITION_PILHA,
  recap: SHARE_COMPOSITION_RECAP,
}
