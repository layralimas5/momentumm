import { Link } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { Icon } from '@/presentation/components/ui/Icon'
import { APP_NAV, visibleNav } from '@/presentation/layouts/nav-items'
import { useFeature } from '@/presentation/plan/use-feature'
import { TAB_ROUTES } from './MobileTabBar'

/**
 * As telas que não cabem na barra inferior.
 *
 * A barra leva Hoje, Objetivos, Plano e Perfil. Todo o resto — Círculo,
 * Hábitos, Foco, Metas, Review, Configurações — chega por aqui, e a lista se
 * deriva da navegação em vez de ser escrita à mão: tela nova aparece no atalho
 * sem ninguém lembrar de vir editar este arquivo.
 *
 * Ela vive no Perfil porque o Perfil é uma das quatro abas. Quando morava em
 * Configurações, e Configurações só era alcançável por ela mesma, o caminho se
 * fechava num círculo — dava pra sair, mas não pra voltar.
 */

const SHORTCUTS = APP_NAV.filter((item) => !TAB_ROUTES.includes(item.to))

export function MobileShortcuts() {
  const { session } = useAuth()
  const juntos = useFeature('juntos')
  const shortcuts = visibleNav(SHORTCUTS, { juntos: juntos.enabled })

  return (
    <nav aria-label="Outras telas" className="lg:hidden">
      <ul className="surface-card divide-y divide-line overflow-hidden">
        {/* Painel admin: só pra quem tem papel. O /admin cobra o segundo fator. */}
        {session?.adminRole ? (
          <li>
            <Link
              to="/admin"
              className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors active:bg-surface-hi"
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand-dim/40 text-brand-ink"
              >
                <Icon name="cadeado" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">Painel admin</span>
                <span className="mt-0.5 block truncate text-sm text-ink-faint">
                  Operação, saúde e crescimento do produto
                </span>
              </span>
              <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ) : null}
        {shortcuts.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors active:bg-surface-hi"
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-hi text-ink-muted"
              >
                <Icon name={item.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="mt-0.5 block truncate text-sm text-ink-faint">
                  {item.description}
                </span>
              </span>
              <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
