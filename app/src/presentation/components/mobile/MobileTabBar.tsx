import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { AddSheet } from './AddSheet'

interface TabItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
}

/** As rotas que a barra leva: o topo e os atalhos do perfil leem daqui. */
export const TAB_ROUTES: readonly string[] = [
  '/app',
  '/app/objetivos',
  '/app/progresso',
  '/app/perfil',
]

/** Dois de cada lado do botão central. Mais que isso vira alvo pequeno demais. */
const LEFT: readonly TabItem[] = [
  { to: '/app', label: 'Hoje', icon: 'hoje', end: true },
  { to: '/app/objetivos', label: 'Objetivos', icon: 'objetivo', end: false },
]

/*
  Progresso no lugar do Plano.

  A barra responde as três perguntas do app: como estou (Hoje), pra onde vou
  (Objetivos) e estou avançando (Progresso). O Plano é a lista do dia inteiro,
  e chega por dentro do Hoje ("Ver tudo do dia") e pelos atalhos do perfil, que
  montam sozinhos tudo que não está aqui. Progresso, antes, só existia em dois
  links soltos e no fim do Review.
*/
const RIGHT: readonly TabItem[] = [
  { to: '/app/progresso', label: 'Progresso', icon: 'progresso', end: false },
]

const PROFILE: TabItem = { to: '/app/perfil', label: 'Perfil', icon: 'trofeu', end: false }

/**
 * Barra inferior do celular.
 *
 * É uma pílula solta sobre o conteúdo, não uma faixa colada na borda: o
 * conteúdo passa por baixo dela e a barra continua parecendo um controle, não
 * uma parede. Só ícones; o nome da aba vai pro leitor de tela. A aba ativa
 * ganha um fundo arredondado em vez de só trocar de cor, porque cor sozinha
 * some no sol.
 *
 * O último item é o avatar da pessoa: é assim que ela reconhece "o meu" sem
 * ler nada. O adicionar fica no centro pelo mesmo motivo de sempre: é o alvo
 * mais fácil do polegar. A barra respeita a área segura do aparelho e o
 * conteúdo reserva a altura dela (`pb-tabbar`), então ela nunca cobre nada.
 */
export function MobileTabBar() {
  const [addOpen, setAddOpen] = useState(false)
  const { profile } = useAuth()

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full p-1.5',
            'border border-line bg-surface/90 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)] backdrop-blur-xl',
          )}
        >
          {LEFT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          <li>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                'grid size-12 place-items-center rounded-full bg-brand text-white',
                'shadow-[0_10px_24px_-10px_var(--color-brand)] transition-transform',
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

          <TabLink item={PROFILE}>
            {(isActive) =>
              profile ? (
                <Avatar
                  name={profile.name}
                  src={profile.avatarUrl}
                  className={cn('size-8', isActive && 'ring-2 ring-brand ring-offset-2 ring-offset-surface-hi')}
                  textClassName="text-xs"
                />
              ) : (
                <Icon name={PROFILE.icon} className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
              )
            }
          </TabLink>
        </ul>
      </nav>

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

function TabLink({
  item,
  children,
}: {
  item: TabItem
  /** Substitui o ícone; recebe se a aba está ativa. */
  children?: (isActive: boolean) => ReactNode
}) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        aria-label={item.label}
        className={({ isActive }) =>
          cn(
            // 48px de altura e 56 de largura: alvo confortável sem mirar.
            'grid h-12 w-14 place-items-center rounded-full transition-colors',
            isActive ? 'bg-surface-hi text-ink' : 'text-ink-faint active:bg-surface-hi',
          )
        }
      >
        {({ isActive }) => (
          <>
            {children ? (
              children(isActive)
            ) : (
              <Icon name={item.icon} className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
            )}
            <span className="sr-only">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}
