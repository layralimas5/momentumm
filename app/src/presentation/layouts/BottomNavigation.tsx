import { NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { SHELL_TABS, tabFor } from './shell-nav'

/** A barra fixa de baixo. Cinco paradas, a ativa em roxo com um traço que desliza. */
export function BottomNavigation() {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const active = tabFor(pathname)

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[30rem] sm:-translate-x-1/2 sm:rounded-3xl sm:border-0 sm:pb-1 sm:shadow-[var(--shadow-float)]"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch px-1 pt-1">
        {SHELL_TABS.map((tab) => {
          const isActive = active?.to === tab.to
          return (
            <li key={tab.to} className="min-w-0 flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-[3.2rem] w-full flex-col items-center justify-center gap-1 rounded-2xl transition-colors',
                  isActive ? 'text-brand-hi' : 'text-ink-faint hover:text-ink',
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="tab-glow"
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-brand"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon name={tab.icon} className="size-[1.25rem]" strokeWidth={isActive ? 2.1 : 1.7} />
                <span className="text-[0.68rem] leading-none font-medium">{tab.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
