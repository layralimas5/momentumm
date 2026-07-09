import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { CtaButton } from '@/presentation/components/landing/CtaButton'

const EASE = [0.16, 1, 0.3, 1] as const

const highlights = ['Suas metas', 'Suas leituras', 'Sua evolução', 'Sua vida', 'Seu eu']

export function Hero() {
  const reduce = useReducedMotion()

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  }

  return (
    <section className="relative overflow-hidden">
      {/* Glows "aura" no fundo preto */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18%] -z-10 h-[560px] w-[900px] max-w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-600/30 via-brand-500/15 to-blush-500/20 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-[30%] -z-10 h-[320px] w-[320px] rounded-full bg-blush-500/12 blur-[100px]"
      />

      <div className="mx-auto max-w-3xl px-5 pb-20 pt-24 text-center sm:px-6 md:pb-28 md:pt-32">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.h1
            variants={item}
            className="text-balance text-[2.75rem] font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            A sua{' '}
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-blush-400 bg-clip-text text-transparent">
              próxima versão
            </span>{' '}
            começa aqui.
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-7 max-w-xl text-pretty text-lg leading-relaxed text-zinc-300"
          >
            Você sabe onde quer chegar. O difícil é continuar quando a rotina acontece.
          </motion.p>

          <motion.p
            variants={item}
            className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400"
          >
            O Aura transforma seus sonhos em uma jornada que você consegue acompanhar — com
            suas metas, leituras e evolução em um só lugar.
          </motion.p>

          <motion.ul
            variants={item}
            className="mx-auto mt-7 flex flex-nowrap items-center justify-center gap-x-2.5 text-xs text-zinc-300 sm:gap-x-4 sm:text-sm"
          >
            {highlights.map((h, i) => (
              <li key={h} className="flex items-center gap-x-2.5 whitespace-nowrap sm:gap-x-4">
                {i > 0 && (
                  <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-brand-400/60" />
                )}
                {h}
              </li>
            ))}
          </motion.ul>

          <motion.div variants={item} className="mt-10 flex flex-col items-center gap-3">
            <CtaButton className="w-full sm:w-auto" />
            <p className="text-sm text-zinc-500">
              <span className="font-medium text-brand-300">Vagas de fundadora:</span> as 10
              primeiras por R$ 14,90/mês — metade do preço, pra sempre.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
