import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { AddSheet, type AddContext } from './AddSheet'

/**
 * Em que telas criar alguma coisa é o gesto natural, e o que ele cria.
 *
 * A lista é curta de propósito, e o que não está nela não ganha botão: um "+"
 * presente em toda tela por consistência vira mobília, e mobília não se lê. No
 * Progresso e no Perfil não existe nada pra criar ali, a tela é de leitura, e
 * um botão de adicionar só faria a pessoa tocar pra descobrir o que ele fazia.
 *
 * O Feed entra quando publicar existir de verdade. Um "Publicar momento" que
 * abre uma folha vazia é pior do que não ter botão: ele promete um recurso e
 * ensina que o botão não funciona.
 */
const FAB_BY_ROUTE: readonly { readonly match: (path: string) => boolean; readonly context: AddContext }[] = [
  { match: (path) => path === '/app', context: 'hoje' },
  { match: (path) => path.startsWith('/app/rotina'), context: 'rotina' },
]

/**
 * O "+" flutuante e contextual.
 *
 * Ele era o botão central da barra inferior, o único alvo de lá que não era
 * navegação, e abria a mesma lista de seis ações em qualquer tela. Saiu da
 * barra por isso: uma aba que não leva a lugar nenhum ocupa o lugar de uma que
 * levaria, e a barra passou a caber as cinco áreas do produto.
 *
 * Fica embaixo à direita, acima da barra e nunca em cima dela, com 56px de
 * alvo. À direita, e não no meio, porque o meio agora é o Hoje: dois círculos
 * disputando o mesmo ponto da tela é a leitura de que um deles é a aba.
 */
export function AddFab() {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)

  const context = FAB_BY_ROUTE.find((entry) => entry.match(pathname))?.context ?? null
  if (!context) return null

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...(reduceMotion ? {} : { whileTap: { scale: 0.93 } })}
        className="fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-brand text-white shadow-[0_12px_28px_-8px_var(--color-brand)] transition-colors bottom-above-tabbar active:bg-brand-hi lg:hidden"
      >
        <Icon name="mais" className="size-7" strokeWidth={2.25} />
        <span className="sr-only">
          {context === 'rotina' ? 'Adicionar à rotina' : 'Adicionar para hoje'}
        </span>
      </motion.button>

      <AddSheet open={open} context={context} onClose={() => setOpen(false)} />
    </>
  )
}
