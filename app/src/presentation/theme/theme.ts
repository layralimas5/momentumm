export const THEMES = ['dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_KEY = 'momentumm.theme.v1'

/** O escuro é a identidade; o claro é escolha. Sem preferência salva, fica o escuro. */
export const DEFAULT_THEME: Theme = 'dark'

export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return raw === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Sem armazenamento o tema vale só nesta sessão.
  }
}

/** Aplica no `<html>`: todos os tokens de cor leem daqui. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset['theme'] = theme
  root.classList.toggle('dark', theme === 'dark')
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'light' ? '#f6f5fb' : '#0A0A0B'
}
