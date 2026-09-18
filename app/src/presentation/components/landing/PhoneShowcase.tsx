import { motion } from 'framer-motion'
import { FloatingCard } from './HeroCards'
import { PhoneMockup } from './PhoneMockup'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * O app de verdade: a captura da tela Progresso, a mesma que a pessoa vai ver
 * ao entrar, com dois cards flutuantes lidos da própria captura. Nada de
 * número desenhado à mão. No celular os cards somem: ali eles só cobririam
 * a tela.
 */
export function PhoneShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative mx-auto w-full max-w-3xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-16 top-1/3 h-64 rounded-full bg-brand/25 blur-3xl"
      />
      <PhoneMockup className="relative" flush>
        <img
          src="/telas/progresso.webp"
          alt="Tela Progresso do Momentumm: o score, a classificação e a leitura da semana"
          width={780}
          height={1688}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover object-top"
        />
      </PhoneMockup>

      <FloatingCard tilt={-4} delay={0.2} className="absolute left-0 top-24 hidden w-44 lg:block xl:left-12">
        <p className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">Momentumm</p>
        <p className="tabular mt-1 text-3xl font-semibold text-ink">
          58<span className="text-base text-ink-faint">/100</span>
        </p>
        <p className="mt-1 inline-flex rounded-full border border-brand/40 bg-brand-dim/50 px-2 py-0.5 text-xs font-medium text-brand-ink">
          Constante
        </p>
      </FloatingCard>

      <FloatingCard tilt={3} delay={0.35} className="absolute right-0 top-56 hidden w-44 lg:block xl:right-12">
        <p className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">Esta semana</p>
        <p className="tabular mt-1 text-2xl font-semibold text-positive">+12</p>
        <p className="mt-1 text-xs text-ink-faint">5 de 7 dias com movimento</p>
      </FloatingCard>
    </motion.div>
  )
}
