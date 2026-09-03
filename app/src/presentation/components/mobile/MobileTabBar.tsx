import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { AddSheet } from './AddSheet'

interface TabItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
}

/** Dois de cada lado do botão central. Mais que isso vira alvo pequeno demais. */
const LEFT: readonly TabItem[] = [
  { to: '/app', label: 'Hoje', icon: 'hoje', end: true },
  { to: '/app/jornada', label: 'Jornada', icon: 'jornada', end: false },
]

const RIGHT: readonly TabItem[] = [
  { to: '/app/foco', label: 'Foco', icon: 'foco', end: false },
  { to: '/app/configuracoes', label: 'Perfil', icon: 'config', end: false },
]

/**
 * Barra inferior do celular.
 *
 * Fica embaixo porque é onde o polegar chega sem trocar a mão de posição, e o
 * botão de adicionar fica no centro pelo mesmo motivo: é o alvo mais fácil da
 * tela inteira. A barra respeita a área segura do aparelho e o conteúdo reserva
 * a altura dela (`pb-tabbar`), então ela nunca cobre nada.
 */
export function MobileTabBar() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1.5 pb-safe">
          {LEFT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          <li className="flex items-start justify-center px-1">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                'grid size-14 -translate-y-3 place-items-center rounded-2xl bg-brand text-white',
                'shadow-[0_10px_30px_-10px_var(--color-brand)] transition-transform',
                'active:scale-95 active:bg-brand-hi',
              )}
            >
              <Icon name="mais" className="size-6" strokeWidth={2.25} />
              <span className="sr-only">Adicionar</span>
            </button>
          </li>

          {RIGHT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
        </ul>
      </nav>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

function TabLink({ item }: { item: TabItem }) {
  return (
    <li className="flex-1">
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            // 56px de alvo: o mínimo confortável pro polegar sem mirar.
            'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium',
            'transition-colors active:bg-surface',
            isActive ? 'text-brand-hi' : 'text-ink-faint',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon name={item.icon} className={cn('size-5', isActive && 'text-brand-hi')} />
            <span className="truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}
