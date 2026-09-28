import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { CreateSheet } from './CreateSheet'

interface TabItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
}

/** As rotas que a barra leva: o topo e os atalhos do perfil leem daqui. */
export const TAB_ROUTES: readonly string[] = [
  '/app/feed',
  '/app',
  '/app/progresso',
  '/app/perfil',
]

/**
 * Quatro destinos e um gesto, na ordem do dia da pessoa.
 *
 * Feed e Perfil nas pontas (a camada social, que se olha), Hoje e Progresso
 * por dentro (o que se executa e o que resultou), e o "+" no meio, onde o
 * polegar chega sem mirar.
 *
 * Rotina saiu da barra pra o "+" entrar. Ela não desapareceu: continua na rota
 * própria, na barra lateral do desktop, na busca rápida e nos atalhos do
 * Perfil, que se montam sozinhos a partir de tudo que não está em
 * `TAB_ROUTES`. O que ela perdeu foi a posição de destaque, e a razão é que
 * abrir a rotina é uma decisão de vez em quando; publicar e registrar é o
 * gesto de todo dia.
 *
 * Configurações nunca esteve aqui e continua não estando: ela mora atrás da
 * engrenagem no topo do Perfil, que é onde qualquer pessoa procura por ela
 * sem ler.
 */
const LEFT: readonly TabItem[] = [
  { to: '/app/feed', label: 'Feed', icon: 'globo', end: false },
  { to: '/app', label: 'Hoje', icon: 'casa', end: true },
]

const RIGHT: readonly TabItem[] = [
  { to: '/app/progresso', label: 'Progresso', icon: 'progresso', end: false },
  { to: '/app/perfil', label: 'Perfil', icon: 'pessoa', end: false },
]

/**
 * Barra inferior do celular.
 *
 * Uma faixa de largura cheia, ancorada na borda de baixo, com uma linha
 * separando do conteúdo. A aba ativa acende em cor de marca e ganha um traço
 * embaixo: cor sozinha some no sol, e o traço é o que sobrevive à luz forte e
 * ao daltonismo.
 *
 * ## O "+" no meio
 *
 * Ele é o único alvo da barra que não é navegação, e por isso é desenhado
 * como outra coisa: um quadrado arredondado em cor de marca, do tamanho do
 * alvo confortável, sem rótulo embaixo. Um "+" que parecesse aba ensinaria que
 * abas às vezes abrem folha, e aí nenhuma das cinco seria previsível.
 *
 * Ele não flutua sobre o conteúdo (era assim, como `AddFab`, à direita): um
 * círculo flutuante cobre o canto da tela em toda rolagem, e o canto inferior
 * direito é justo onde o último card do feed termina.
 *
 * ## O nome embaixo do ícone
 *
 * Ícone sozinho é adivinhação. O rótulo custa 12px de altura e devolve a tela
 * inteira navegável sem tentar e errar. Com quatro nomes e o "+" no meio,
 * nada aqui é cortado com reticências em 320px.
 *
 * A barra respeita a área segura do aparelho e o conteúdo reserva a altura
 * dela (`pb-tabbar`), então ela nunca cobre nada.
 */
export function MobileTabBar() {
  const [creating, setCreating] = useState(false)

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-xl lg:hidden',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        <ul className="mx-auto flex w-full max-w-md items-stretch px-1 pt-1.5">
          {LEFT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}

          <li className="flex min-w-0 flex-1 items-center justify-center">
            <CreateButton open={creating} onOpen={() => setCreating(true)} />
          </li>

          {RIGHT.map((item) => (
            <TabLink key={item.to} item={item} />
          ))}
        </ul>
      </nav>

      <CreateSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function CreateButton({ open, onOpen }: { readonly open: boolean; readonly onOpen: () => void }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      {...(reduceMotion ? {} : { whileTap: { scale: 0.92 } })}
      className={cn(
        'grid size-12 place-items-center rounded-2xl bg-brand text-white transition-colors',
        'shadow-[0_8px_20px_-8px_var(--color-brand)] active:bg-brand-hi',
      )}
    >
      <Icon name="mais" className="size-6" strokeWidth={2.5} />
      <span className="sr-only">Criar</span>
    </motion.button>
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
            <span aria-hidden="true" className="text-[0.625rem] font-medium leading-none">
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
