import { useLayoutEffect } from 'react'

/**
 * Mantém o HTML pré-renderizado na tela até a rota do React estar pronta.
 *
 * O `createRoot` apaga o conteúdo do `#root` no primeiro render, e a primeira
 * coisa que ele desenha é o fallback do Suspense (as páginas são `lazy`). No
 * celular isso virava uns quatro segundos de tela preta com spinner em cima
 * de uma página que já tinha chegado pronta no HTML: o LCP medido era o do
 * React redesenhando o hero, não o do HTML.
 *
 * Então, antes do React montar, o conteúdo pré-renderizado sai do `#root` pra
 * um irmão logo acima dele, e o `#root` fica escondido. Quando a rota termina
 * de carregar (`PrerenderRelease`, dentro do Suspense), o snapshot sai e o
 * `#root` aparece, já com o conteúdo final.
 *
 * Os links do snapshot são `<a href>` de verdade: um clique antes da troca
 * vira navegação comum, sem nada quebrado.
 */

/** Se a rota travar, o snapshot não pode segurar a página pra sempre. */
const MAX_HOLD_MS = 10_000

let release: (() => void) | null = null
let served = false

/**
 * A página chegou pré-renderizada e a pessoa já está vendo o conteúdo final.
 * Animação de entrada, nesse caso, é o conteúdo sumindo e voltando na troca.
 */
export function servedPrerendered(): boolean {
  return served
}

export function holdPrerender(root: HTMLElement): void {
  if (!root.hasChildNodes()) return
  served = true

  const snapshot = document.createElement('div')
  snapshot.setAttribute('data-prerender-snapshot', '')
  while (root.firstChild) snapshot.appendChild(root.firstChild)
  root.before(snapshot)
  root.hidden = true

  const timeout = window.setTimeout(() => release?.(), MAX_HOLD_MS)
  release = () => {
    window.clearTimeout(timeout)
    snapshot.remove()
    root.hidden = false
    release = null
  }
}

export function releasePrerender(): void {
  release?.()
}

/** Montado dentro do Suspense das rotas: só roda quando a rota já saiu do fallback. */
export function PrerenderRelease() {
  useLayoutEffect(releasePrerender, [])
  return null
}
