import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { achievementSpec } from '@/domain/entities/evolution'
import { Icon } from '@/presentation/components/ui/Icon'
import { useEvolution } from './use-evolution'

/** Quanto tempo o aviso fica antes de sair sozinho. */
const AUTO_HIDE_MS = 9000

/**
 * O aviso de nível e de conquista.
 *
 * Um cartão pequeno, embaixo, que diz o que mudou e sai sozinho. Sem confete,
 * sem som, sem tela cheia: subir de nível é consequência de semanas de
 * trabalho, e a celebração à altura disso é a informação bem escrita.
 *
 * Fica um degrau acima do aviso de conclusão, que é o frequente: nível novo é
 * raro demais pra ser coberto por um "feito" de cinco segundos.
 */
export function EvolutionNotice() {
  const { notice, dismissNotice } = useEvolution()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismissNotice, AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [notice, dismissNotice])

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={notice.id}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-44 z-40 mx-auto max-w-md lg:bottom-26 lg:right-6 lg:left-auto lg:mx-0"
        >
          <div className="surface-brand edge-light flex items-start gap-3 rounded-2xl p-4 shadow-xl">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-ink">
              <Icon name={notice.levelUp ? 'subir' : 'trofeu'} className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              {notice.levelUp ? (
                <>
                  <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                    Nível {notice.levelUp.level}
                  </p>
                  <p className="text-base font-semibold text-ink">{notice.levelUp.name}</p>
                </>
              ) : (
                <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  Conquista
                </p>
              )}

              {notice.achievements.map((key) => (
                <p key={key} className="mt-0.5 text-sm text-ink">
                  {achievementSpec(key).name}
                  <span className="text-ink-muted">: {achievementSpec(key).description}</span>
                </p>
              ))}

              {notice.unlocks.length > 0 ? (
                <p className="mt-1 text-sm text-ink-muted">
                  Liberado: {notice.unlocks.map((item) => item.label).join(', ')}.
                </p>
              ) : null}

              <Link
                to="/app/evolucao"
                onClick={dismissNotice}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-ink"
              >
                Ver evolução
                <Icon name="seta" className="size-3.5" />
              </Link>
            </div>

            <button
              type="button"
              onClick={dismissNotice}
              className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
            >
              <Icon name="fechar" className="size-4" />
              <span className="sr-only">Fechar aviso</span>
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
