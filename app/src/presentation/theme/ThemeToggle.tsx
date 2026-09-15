import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useTheme } from './use-theme'

/** Um botão só: sol no escuro, lua no claro. Diz o que vai acontecer, não o que é. */
export function ThemeToggle({ className }: { readonly className?: string }) {
  const { theme, toggle } = useTheme()
  const toLight = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toLight ? 'Mudar pro tema claro' : 'Mudar pro tema escuro'}
      title={toLight ? 'Tema claro' : 'Tema escuro'}
      className={cn(
        'grid shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink active:bg-surface-top',
        className ?? 'size-10',
      )}
    >
      <Icon name={toLight ? 'sol' : 'lua'} className="size-5" />
    </button>
  )
}
