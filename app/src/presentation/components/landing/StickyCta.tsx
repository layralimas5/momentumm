import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useSiteCta } from './use-site-cta'

/**
 * Barra de conversão fixa no rodapé do celular. Aparece depois que o hero
 * sai da tela e some de novo quando a seção final (que já é um CTA) entra:
 * no celular a pessoa rola muito até os planos, e o botão do hero fica
 * milhares de pixels pra trás. No desktop o header já cumpre esse papel.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()
  const { primary, signedIn } = useSiteCta()

  useEffect(() => {
    const hero = document.getElementById('home')
    const finalCta = document.getElementById('comecar')
    if (!hero || !finalCta) return

    let heroOnScreen = true
    let finalOnScreen = false
    const update = () => setVisible(!heroOnScreen && !finalOnScreen)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) heroOnScreen = entry.isIntersecting
          if (entry.target === finalCta) finalOnScreen = entry.isIntersecting
        }
        update()
      },
      { threshold: 0.1 },
    )
    observer.observe(hero)
    observer.observe(finalCta)
    return () => observer.disconnect()
  }, [])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={reduced ? false : { y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 z-30 md:hidden"
          style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-line-hi bg-surface/95 p-2 pl-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <p className="min-w-0 flex-1 text-xs leading-tight text-ink-muted">
              {signedIn ? (
                <>
                  <span className="block font-medium text-ink">Você já tem conta.</span>O plano de
                  hoje te espera.
                </>
              ) : (
                <>
                  <span className="block font-medium text-ink">Grátis, sem cartão.</span>O plano
                  leva dois minutos.
                </>
              )}
            </p>
            <Link
              to={primary.to}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hi"
            >
              {primary.label}
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
