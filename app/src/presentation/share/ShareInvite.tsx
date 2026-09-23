import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import type { DashboardView } from '@/presentation/planner/use-dashboard'
import { useShareStudio } from './ShareStudioProvider'
import { useShareMoments } from './use-share-moments'

/**
 * O convite pra mostrar o que acabou de sair.
 *
 * Ele mora ENTRE os cards do dia, logo abaixo da lista onde a pessoa acabou
 * de marcar alguma coisa, e não no rodapé da tela. O lugar é a mensagem: um
 * botão de compartilhar no fim da página é encontrado por quem já tinha
 * decidido compartilhar; no meio do caminho, dois segundos depois de riscar
 * uma ação, ele chega enquanto a vontade existe.
 *
 * Aparece só depois que alguma coisa saiu do dia, porque é aí que existe o
 * que mostrar. Antes disso não há convite nenhum a fazer, e um "compartilhe
 * seu progresso" às oito da manhã com o dia inteiro em aberto é cobrança
 * disfarçada de convite.
 *
 * Um momento por vez, o mais relevante: a fileira com todos eles continua no
 * fim da tela pra quem quiser escolher.
 */
export function ShareInvite({ view }: { readonly view: DashboardView }) {
  const moments = useShareMoments(view)
  const share = useShareStudio()
  const reduceMotion = useReducedMotion()

  const moment = moments[0]
  if (!moment || view.dayProgress.done === 0) return null

  const done = view.dayProgress.done

  return (
    <motion.button
      type="button"
      onClick={() => share.open(moment.build())}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full items-center gap-3.5 rounded-card border border-brand/30 bg-brand-dim/25 px-4 py-3.5 text-left transition-colors hover:bg-brand-dim/40"
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/20 text-brand-ink"
      >
        <Icon name="jornada" className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          {done === 1 ? 'Você fechou a primeira de hoje.' : `Já são ${done} fechadas hoje.`}
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted">
          Mostra isso nos stories: o app monta a imagem pra você.
        </span>
      </span>

      <Icon name="seta" aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />
    </motion.button>
  )
}
