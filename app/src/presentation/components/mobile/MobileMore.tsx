import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * O resto do dia, atrás de um toque.
 *
 * A tela Hoje responde três perguntas: como estou, o que importa hoje e se
 * estou avançando. Tudo que não responde nenhuma delas continua existindo, mas
 * deixa de disputar a rolagem com o que decide o dia: próxima do plano,
 * objetivos, insight, sessões, metas e as vitórias escritas.
 *
 * Recolher, e não remover: quem usa esses blocos continua a um toque deles, na
 * mesma tela, sem ter que aprender onde cada coisa foi parar. Fechado por
 * padrão porque a maioria das aberturas do app é pra decidir e começar.
 */
export function MobileMore({ children }: { readonly children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <section aria-labelledby="mais-do-dia" className="border-t border-line pt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mais-do-dia-conteudo"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-ink-muted transition-colors active:bg-surface"
      >
        <span id="mais-do-dia">{open ? 'Mostrar menos' : 'Ver mais do meu dia'}</span>
        <Icon
          name="seta"
          aria-hidden="true"
          className={cn('size-4 transition-transform duration-200', open ? '-rotate-90' : 'rotate-90')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mais-do-dia-conteudo"
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 pt-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
