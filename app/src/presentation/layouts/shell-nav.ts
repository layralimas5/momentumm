import type { IconName } from '@/presentation/components/ui/Icon'
import { navItemFor } from './nav-items'

export interface ShellTab {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
  /** Rotas que acendem esta aba além da própria. */
  readonly also?: readonly string[]
}

/**
 * A navegação do 3S: o ciclo do produto em cinco paradas. O perfil não é aba,
 * mora no avatar do topo, que é onde todo app guarda a identidade da pessoa.
 */
export const SHELL_TABS: readonly ShellTab[] = [
  { to: '/app', label: 'Hoje', icon: 'calendarioGrade', end: true },
  { to: '/app/rotina', label: 'Rotina', icon: 'relogio', end: false, also: ['/app/habitos', '/app/foco'] },
  { to: '/app/objetivos', label: 'Objetivos', icon: 'bussola', end: false, also: ['/app/plano', '/app/metas'] },
  {
    to: '/app/progresso',
    label: 'Progresso',
    icon: 'tendencia',
    end: false,
    also: ['/app/insights', '/app/review', '/app/evolucao'],
  },
  {
    to: '/app/circulo',
    label: 'Círculo',
    icon: 'trofeu',
    end: false,
    also: ['/app/feed', '/app/clubes', '/app/desafios', '/app/publicacao', '/app/juntos'],
  },
]

export const PROFILE_PATH = '/app/perfil'

export function tabFor(pathname: string): ShellTab | undefined {
  return SHELL_TABS.find((tab) => {
    if (tab.end ? pathname === tab.to : pathname.startsWith(tab.to)) return true
    return (tab.also ?? []).some((route) => pathname.startsWith(route))
  })
}

/** Raiz de aba ou perfil: lugar sem "voltar". */
export function isShellRoot(pathname: string): boolean {
  return SHELL_TABS.some((tab) => tab.to === pathname) || pathname === PROFILE_PATH
}

/** O nome da seção no topo, em caixa alta: "HOJE", "PROGRESSO". */
export function sectionLabelFor(pathname: string): string {
  if (pathname.startsWith(PROFILE_PATH)) return 'Perfil'
  const exact = SHELL_TABS.find((tab) => tab.to === pathname)
  if (exact) return exact.label
  return navItemFor(pathname)?.label ?? tabFor(pathname)?.label ?? 'Momentumm'
}

/** Telas com título grande próprio igual ao nome da seção: o topo não repete. */
const OWN_TITLE: readonly string[] = ['/app/objetivos']

export function ownsTitle(pathname: string): boolean {
  return OWN_TITLE.includes(pathname)
}
