import { useEffect, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

interface ContextualFabProps {
  readonly label: string
  readonly icon: IconName
  readonly onClick: () => void
  /**
   * O card que já oferece essa mesma ação. Enquanto ele estiver visível o botão
   * some — repetir na tela uma ação que a pessoa está vendo só compete com a
   * navegação de baixo.
   */
  readonly anchor: RefObject<HTMLElement | null>
}

/**
 * Botão flutuante da ação pendente mais importante.
 *
 * Ele existe pra quando a pessoa rolou pra longe do que precisa fazer. Aparece
 * acima da barra inferior, nunca em cima dela.
 */
export function ContextualFab({ label, icon, onClick, anchor }: ContextualFabProps) {
  const visible = useIsOutOfView(anchor)

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 z-30 flex justify-center px-4 bottom-above-tabbar lg:hidden"
        >
          <button
            type="button"
            onClick={onClick}
            className="inline-flex min-h-13 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-[0_12px_34px_-12px_var(--color-brand)] transition-transform active:scale-95"
          >
            <Icon name={icon} className="size-4.5" />
            {label}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Verdadeiro quando o elemento âncora saiu da tela. */
function useIsOutOfView(anchor: RefObject<HTMLElement | null>): boolean {
  const [out, setOut] = useState(false)

  useEffect(() => {
    const element = anchor.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => setOut(entry ? !entry.isIntersecting : false),
      { threshold: 0.35 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [anchor])

  return out
}
