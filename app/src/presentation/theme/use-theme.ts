import { useCallback, useEffect, useState } from 'react'
import { applyTheme, persistTheme, readStoredTheme, type Theme } from './theme'

/**
 * O tema como estado, sincronizado entre abas pelo `storage`.
 *
 * O `main.tsx` já aplicou o tema salvo antes do primeiro render (senão o app
 * piscaria escuro antes de ficar claro); aqui só se lê o que está no `<html>`
 * e se troca quando a pessoa pede.
 */
export function useTheme(): { readonly theme: Theme; toggle(): void; set(theme: Theme): void } {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  const set = useCallback((next: Theme) => {
    setTheme(next)
    applyTheme(next)
    persistTheme(next)
  }, [])

  const toggle = useCallback(() => set(theme === 'dark' ? 'light' : 'dark'), [theme, set])

  useEffect(() => {
    const onStorage = () => {
      const next = readStoredTheme()
      setTheme(next)
      applyTheme(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { theme, toggle, set }
}
