import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

interface TabItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
  /**
   * O centro da barra. Não é um botão diferente, é o mesmo alvo com um grau a
   * mais de contraste: Hoje é onde a pessoa entra todo dia, e a barra pode
   * dizer isso sem virar um círculo flutuante no meio da tela.
   */
  readonly central?: boolean
}

/** As rotas que a barra leva: o topo e os atalhos do perfil leem daqui. */
export const TAB_ROUTES: readonly string[] = [
  '/app/feed',
  '/app/rotina',
  '/app',
  '/app/progresso',
  '/app/perfil',
]

/**
 * As cinco, na ordem do dia da pessoa.
 *
 * Feed e Perfil nas pontas (a camada social, que se olha, não se opera),
 * Rotina e Progresso ao lado (o antes e o depois da execução), e Hoje no meio,
 * onde o polegar chega sem mirar.
 *
 * O "+" saiu daqui. Ele era a única coisa na barra que não era navegação, e
 * oferecia a mesma lista de seis ações em qualquer tela: "adicionar objetivo"
 * dentro da Rotina, "item da rotina" dentro do Progresso. Agora ele é
 * flutuante e contextual (`AddFab`), e aparece só onde criar alguma coisa é o
 * gesto natural daquela tela.
 */
const TABS: readonly TabItem[] = [
  { to: '/app/feed', label: 'Feed', icon: 'globo', end: false },
  { to: '/app/rotina', label: 'Rotina', icon: 'calendario', end: false },
  { to: '/app', label: 'Hoje', icon: 'casa', end: true, central: true },
  { to: '/app/progresso', label: 'Progresso', icon: 'progresso', end: false },
  { to: '/app/perfil', label: 'Perfil', icon: 'pessoa', end: false },
]

/**
 * Barra inferior do celular.
 *
 * Uma faixa de largura cheia, ancorada na borda de baixo, com uma linha
 * separando do conteúdo. Ela era uma pílula flutuante com margem dos dois
 * lados, bonita parada, e estreita justo onde o polegar erra: cada alvo
 * perdia 32px de largura pra margem.
 *
 * A aba ativa acende em cor de marca e ganha um traço embaixo. Cor sozinha
 * some no sol; o traço é o que sobrevive à luz forte e ao daltonismo.
 *
 * ## O nome embaixo do ícone
 *
 * Os ícones eram mudos, com o nome só pro leitor de tela. Funciona pra quem já
 * decorou a barra e falha exatamente com quem acabou de chegar, que é quem
 * mais precisa dela. Ícone sozinho é adivinhação.
 *
 * O rótulo custa 12px de altura e devolve a tela inteira navegável sem tentar
 * e errar. Com cinco itens ele continua cabendo inteiro em 320px: nada aqui é
 * cortado com reticências, um nome pela metade é pior que nenhum.
 *
 * ## O que saiu da barra não saiu do app
 *
 * Objetivos, Hábitos, Plano e Review semanal continuam inteiros, nas próprias
 * rotas, na barra lateral do desktop, na busca rápida e nos atalhos do Perfil,
 * que se montam sozinhos a partir de tudo que não está aqui (`MobileShortcuts`).
 *
 * A barra respeita a área segura do aparelho e o conteúdo reserva a altura
 * dela (`pb-tabbar`), então ela nunca cobre nada.
 */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-xl lg:hidden',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
      )}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch px-1 pt-1.5">
        {TABS.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
      </ul>
    </nav>
  )
}

function TabLink({ item }: { item: TabItem }) {
  return (
    <li className="min-w-0 flex-1">
      <NavLink
        to={item.to}
        end={item.end}
        aria-label={item.label}
        className={({ isActive }) =>
          cn(
            // 56px de altura: alvo confortável sem mirar, já contando o rótulo
            // embaixo do ícone e o traço de aba ativa.
            'relative flex h-14 w-full flex-col items-center justify-center gap-1 px-0.5 transition-colors',
            isActive
              ? 'text-brand-hi'
              : item.central
                ? 'text-ink-muted active:text-ink'
                : 'text-ink-faint active:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              name={item.icon}
              className={item.central ? 'size-[1.375rem]' : 'size-5'}
              strokeWidth={isActive ? 2.25 : item.central ? 2 : 1.75}
            />
            {/*
              `aria-hidden` porque o link já tem `aria-label`: sem isso o
              leitor de tela anuncia o nome da aba duas vezes.
            */}
            <span
              aria-hidden="true"
              className={cn(
                'text-[0.625rem] leading-none',
                item.central ? 'font-semibold' : 'font-medium',
              )}
            >
              {item.label}
            </span>
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-1.5 mx-auto h-0.5 w-8 rounded-full bg-brand-hi"
              />
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  )
}
