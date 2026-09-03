import { useSyncExternalStore } from 'react'

/**
 * Consulta de media query como estado de React.
 *
 * O dashboard de celular não é o de desktop encolhido: são duas árvores de
 * componentes diferentes. Renderizar as duas e esconder uma com CSS custaria
 * DOM e trabalho duplicados em todo render, então a escolha é feita aqui.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    // Sem DOM (teste de nó), assume desktop: é o layout mais completo.
    () => true,
  )
}

/** O ponto em que a tela vira dashboard de verdade, igual ao `lg` do Tailwind. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
