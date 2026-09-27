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

/** As rotas que a barra leva: o topo e os atalhos do perfil leem daqui. */
export const TAB_ROUTES: readonly string[] = [
  '/app',
  '/app/objetivos',
  '/app/progresso',
  '/app/perfil',
]

/** Dois de cada lado do botão central. Mais que isso vira alvo pequeno demais. */
const LEFT: readonly TabItem[] = [
  { to: '/app', label: 'Hoje', icon: 'casa', end: true },
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

const PROFILE: TabItem = { to: '/app/perfil', label: 'Perfil', icon: 'pessoa', end: false }

/**
 * Barra inferior do celular.
 *
 * Uma faixa de largura cheia, ancorada na borda de baixo, com uma linha
 * separando do conteúdo. Ela era uma pílula flutuante com margem dos dois
 * lados, bonita parada, e estreita justo onde o polegar erra: cada alvo
 * perdia 32px de largura pra margem, e o botão de adicionar ficava a meio
 * caminho do meio da tela.
 *
 * A aba ativa acende em cor de marca e ganha um traço embaixo. Cor sozinha
 * some no sol; o traço é o que sobrevive à luz forte e ao daltonismo.
 *
 * ## O nome embaixo do ícone
 *
 * Os ícones eram mudos, com o nome só pro leitor de tela. Funciona pra quem já
 * decorou a barra e falha exatamente com quem acabou de chegar, que é quem
 * mais precisa dela. Ícone sozinho é adivinhação: alvo, troféu e gráfico não
 * dizem "objetivos", "perfil" e "progresso" pra ninguém na primeira semana.
 *
 * O rótulo custa 12px de altura e devolve a tela inteira navegável sem tentar
 * e errar.
 *
 * O último item é o avatar da pessoa: é assim que ela reconhece "o meu" sem
 * ler nada. O adicionar fica no centro pelo mesmo motivo de sempre: é o alvo
 * mais fácil do polegar. A barra respeita a área segura do aparelho e o
 * conteúdo reserva a altura dela (`pb-tabbar`), então ela nunca cobre nada.
 */
export function MobileTabBar() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-xl lg:hidden',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        <ul className="mx-auto flex w-full max-w-md items-center justify-between px-2 pt-1.5">
          {LEFT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          <li>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                // Sobe acima da faixa: é o único alvo que não é navegação, e
                // ficar na mesma linha dos outros o fazia parecer mais uma aba.
                'grid size-14 -translate-y-3 place-items-center rounded-full bg-brand text-white',
                'shadow-[0_12px_28px_-8px_var(--color-brand)] transition-transform',
                'active:scale-95 active:bg-brand-hi',
              )}
            >
              <Icon name="mais" className="size-7" strokeWidth={2.25} />
              <span className="sr-only">Adicionar</span>
            </button>
          </li>

          {RIGHT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          <TabLink item={PROFILE} />
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
        aria-label={item.label}
        className={({ isActive }) =>
          cn(
            // 56px de altura: alvo confortável sem mirar, já contando o rótulo
            // embaixo do ícone e o traço de aba ativa.
            'relative flex h-14 w-full flex-col items-center justify-center gap-1 transition-colors',
            isActive ? 'text-brand-hi' : 'text-ink-faint active:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon name={item.icon} className="size-5" strokeWidth={isActive ? 2.25 : 1.75} />
            {/*
              `aria-hidden` porque o link já tem `aria-label`: sem isso o
              leitor de tela anuncia o nome da aba duas vezes.
            */}
            <span aria-hidden="true" className="text-[0.625rem] leading-none font-medium">
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
