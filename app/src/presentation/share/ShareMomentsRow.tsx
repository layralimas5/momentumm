import type { DashboardView } from '@/presentation/planner/use-dashboard'
import { ShareButton } from './ShareButton'
import { useShareMoments } from './use-share-moments'

/**
 * A fileira de "compartilhar" do dia.
 *
 * Ela aparece embaixo do que acabou de acontecer — dia cumprido, rotina
 * fechada, ritmo retomado — e some quando não há nada digno de card. Um botão
 * de compartilhar sempre visível vira mobília; um que aparece no momento certo
 * é convite.
 *
 * A ordem é a da relevância do dia: o que acabou de acontecer primeiro, o
 * momentum por último, porque ele está disponível todo dia.
 */
export function ShareMomentsRow({ view }: { readonly view: DashboardView }) {
  const moments = useShareMoments(view)
  if (moments.length === 0) return null

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {moments.map((moment, index) => (
        <ShareButton
          key={moment.id}
          label={moment.label}
          build={moment.build}
          className="shrink-0"
          variant={index === 0 ? 'secondary' : 'ghost'}
        />
      ))}
    </div>
  )
}
