import { useEffect } from 'react'

/**
 * Escreve a posição do mouse no card `.spotlight` que está embaixo dele, pra
 * o brilho do CSS seguir o ponteiro. Um ouvinte só pra página inteira, em vez
 * de um por card, e nada no celular: sem mouse não há o que seguir.
 */
export function useSpotlight() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.spotlight') : null
      if (!target) return
      const box = target.getBoundingClientRect()
      target.style.setProperty('--spot-x', `${event.clientX - box.left}px`)
      target.style.setProperty('--spot-y', `${event.clientY - box.top}px`)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => document.removeEventListener('pointermove', onMove)
  }, [])
}
