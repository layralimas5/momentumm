import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

interface MobileSectionProps {
  readonly title: string
  readonly icon?: IconName
  readonly action?: { readonly label: string; readonly onClick: () => void } | undefined
  readonly children: ReactNode
}

/**
 * Cabeçalho de seção do celular.
 *
 * O título vive FORA do card. Com um card por seção, repetir a moldura do
 * desktop (card com título dentro) só empilharia bordas e faria a tela crescer
 * sem entregar informação nova.
 */
export function MobileSection({ title, icon, action, children }: MobileSectionProps) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {icon ? <Icon name={icon} className="size-4 shrink-0 text-ink-faint" /> : null}
          <span className="truncate">{title}</span>
        </h2>

        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium whitespace-nowrap text-brand-hi transition-colors active:bg-surface"
          >
            {action.label}
            <Icon name="seta" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {children}
    </section>
  )
}
