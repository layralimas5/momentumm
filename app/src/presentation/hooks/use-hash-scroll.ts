import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Rola até o `#id` da URL depois que a tela monta: o roteador não faz isso sozinho. */
export function useHashScroll(ready = true): void {
  const { hash } = useLocation()

  useEffect(() => {
    if (!ready || !hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, ready])
}
