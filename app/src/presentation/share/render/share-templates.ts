import type { ShareTemplateId } from '@/domain/share/share-card'
import { withAlpha, type TextAlign } from './canvas-kit'

/**
 * Os cinco templates oficiais.
 *
 * Cada um é um TEMA, não um desenho próprio: eles definem fundo, paleta,
 * alinhamento e densidade, e o layout é o mesmo pros cinco. Cinco funções de
 * desenho independentes seriam cinco lugares pra corrigir quando o card do
 * momentum ganhar uma linha — e, na prática, quatro deles ficariam pra trás.
 *
 * O que muda de verdade entre eles está aqui: pretume, ar, gradiente, quanta
 * informação cabe e se existe fundo.
 */

export interface ShareTheme {
  readonly id: ShareTemplateId
  readonly align: TextAlign
  /**
   * `minimal` corta a lista e a barra de progresso: sobra kicker, título,
   * número, uma linha de apoio e a assinatura. É o que faz o template Minimal
   * ser realmente outro card, e não o Dark com menos contraste.
   */
  readonly density: 'full' | 'minimal'
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
 * Dark — a identidade do app.
 *
 * Fundo quase preto com um brilho do eixo no canto superior. O brilho é fraco
 * de propósito: em preto, qualquer luz forte vira mancha cinza, e o objetivo é
 * dar profundidade sem competir com o número.
 */
export const SHARE_TEMPLATE_DARK: ShareTheme = {
  id: 'dark',
  align: 'left',
  density: 'full',
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

/** Light — fundo claro e muito espaço em branco. */
export const SHARE_TEMPLATE_LIGHT: ShareTheme = {
  id: 'light',
  align: 'left',
  density: 'full',
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
 * Gradient — violeta de marca, contido.
 *
 * Dois passos só: violeta profundo em cima, preto embaixo. Gradiente de três
 * ou mais cores é o atalho mais rápido pra um card parecer template genérico
 * de rede social, que é exatamente o que este produto não é.
 */
export const SHARE_TEMPLATE_GRADIENT: ShareTheme = {
  id: 'gradient',
  align: 'left',
  density: 'full',
  transparent: false,
  ink: INK_LIGHT,
  inkMuted: '#c4c1e0',
  inkFaint: '#9490b8',
  line: 'rgba(255, 255, 255, 0.14)',
  chipBg: 'rgba(255, 255, 255, 0.1)',
  chipInk: INK_LIGHT,
  shadow: false,
  paintBackground(ctx, width, height) {
    const base = ctx.createLinearGradient(0, 0, width * 0.55, height)
    base.addColorStop(0, '#2a2450')
    base.addColorStop(0.55, '#16142b')
    base.addColorStop(1, CANVAS_BLACK)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, width, height)

    const halo = ctx.createRadialGradient(
      width * 0.85,
      height * 0.08,
      0,
      width * 0.85,
      height * 0.08,
      width * 0.9,
    )
    halo.addColorStop(0, 'rgba(136, 120, 255, 0.28)')
    halo.addColorStop(1, 'rgba(136, 120, 255, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, width, height)
  },
}

/** Minimal — o dado no centro e nada mais. Feito pro Story. */
export const SHARE_TEMPLATE_MINIMAL: ShareTheme = {
  id: 'minimal',
  align: 'center',
  density: 'minimal',
  transparent: false,
  ink: INK_LIGHT,
  inkMuted: INK_LIGHT_MUTED,
  inkFaint: INK_LIGHT_FAINT,
  line: '#26262c',
  chipBg: '#141417',
  chipInk: INK_LIGHT,
  shadow: false,
  paintBackground: paintFlat(CANVAS_BLACK),
}

/**
 * Transparent — sem fundo, pra ir por cima da foto da pessoa.
 *
 * Texto branco com sombra suave: é a única forma de garantir leitura sem saber
 * o que vai atrás. Pintar uma caixa escura por baixo resolveria o contraste e
 * destruiria o motivo de o template existir.
 */
export const SHARE_TEMPLATE_TRANSPARENT: ShareTheme = {
  id: 'transparent',
  align: 'center',
  density: 'minimal',
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
  light: SHARE_TEMPLATE_LIGHT,
  gradient: SHARE_TEMPLATE_GRADIENT,
  minimal: SHARE_TEMPLATE_MINIMAL,
  transparent: SHARE_TEMPLATE_TRANSPARENT,
}
