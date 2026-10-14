import type { TargetAndTransition, Transition } from 'framer-motion'

/**
 * O movimento do quiz, num lugar só.
 *
 * As curvas e os tempos vêm do quiz da Cláudia (webclaudia.com.br), a
 * referência de onboarding que o quiz segue: entrada curta que desacelera
 * cedo, mola que passa um pouco do ponto e volta, e linha que se desenha
 * devagar no começo e no fim. Ninguém escreve `cubic-bezier` solto numa
 * tela do quiz: duas telas com curvas diferentes parecem dois produtos.
 *
 * Toda animação aqui some com `prefers-reduced-motion`; quem usa estes
 * tokens confere `useReducedMotion()` antes.
 */

/** Entrada: rápida no começo, assenta suave. */
export const EASE_ENTER = [0.22, 0.8, 0.3, 1] as const
/** Mola: passa um pouco do ponto e volta. Pra o que "chega" (check, selo). */
export const EASE_SPRING = [0.3, 1.42, 0.56, 1] as const
/** Mola forte: pra o que pousa com peso (marcador, troféu). */
export const EASE_SPRING_STRONG = [0.26, 1.7, 0.5, 1] as const
/** Traço: devagar nas pontas, pra a linha parecer desenhada à mão. */
export const EASE_DRAW = [0.42, 0, 0.24, 1] as const
/** Espalha: o confete sai rápido e freia. */
export const EASE_SCATTER = [0.16, 0.64, 0.34, 1] as const

/** O passo da cascata: cada bloco entra um pouco depois do anterior. */
export const CASCADE_STEP = 0.06

/**
 * Entrada em cascata: sobe 10px e acende. `order` é a posição do bloco na
 * tela, então título, dica e opções entram em sequência sem ninguém
 * calcular atraso na mão.
 */
export function cascade(order: number, reduced: boolean | null, base = 0) {
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, delay: base + order * CASCADE_STEP, ease: EASE_ENTER } satisfies Transition,
  }
}

type Bezier = readonly [number, number, number, number]

/**
 * Em que fração do tempo uma curva chega a `progress` do caminho.
 *
 * A linha do caminho anda com `EASE_DRAW`, não em velocidade constante: o
 * marco do meio é alcançado depois da metade do tempo. Pra o marco acender
 * no instante em que a ponta da linha passa por ele, o atraso sai daqui, e
 * não de `duração × posição`, que acenderia o marco antes da linha chegar.
 */
export function timeAtProgress(ease: Bezier, progress: number): number {
  const [x1, y1, x2, y2] = ease
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  let low = 0
  let high = 1
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    // Acha o parâmetro em que o y da curva vale `progress`...
    if (at(y1, y2, mid) < progress) low = mid
    else high = mid
  }
  // ...e devolve o x (o tempo) desse mesmo parâmetro.
  return at(x1, x2, (low + high) / 2)
}

/** Tremida curta, pra resposta que falta. Lateral e com giro, nunca vertical. */
export const SHAKE: TargetAndTransition = {
  x: [0, -4, 4, -3, 2, -1, 0],
  rotate: [0, -1.2, 1.2, -0.8, 0.6, -0.3, 0],
  transition: { duration: 0.5, ease: 'easeInOut' },
}
