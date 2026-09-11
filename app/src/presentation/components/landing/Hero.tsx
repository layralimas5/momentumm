import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TodayScreen } from './AppScreens'
import { PhoneMockup } from './PhoneMockup'
import { CTA } from './site'

/**
 * A promessa em duas linhas: objetivo vira plano, plano vira o dia. É o
 * critério de aceite do produto ("percebe quando o plano deixou de funcionar")
 * dito do lado de quem usa. O mockup é a tela `Hoje`, porque é ela que a
 * pessoa vai abrir todo dia.
 */
const LINES = ['Objetivo vira plano.', 'Plano vira o que você faz hoje.'] as const

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-28 sm:pt-36 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-28 lg:pt-40">
        <div className="text-center lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" />
            {CTA.badge}
          </motion.p>

          <h1 className="mt-7 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
            {LINES.map((line, index) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
                className="block"
              >
                {index === LINES.length - 1 ? (
                  <span className="bg-gradient-to-r from-brand-hi to-brand-ink bg-clip-text text-transparent">
                    {line}
                  </span>
                ) : (
                  line
                )}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg text-ink-muted lg:mx-0"
          >
            O Momentumm transforma o que você quer alcançar em ações diárias, mede se o seu ritmo
            está de pé e ajusta o plano quando ele para de funcionar. Não é um app de hábitos: é
            um sistema de progresso pessoal.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-9 flex flex-col items-center gap-5 lg:items-start"
          >
            <Link
              to={CTA.primary.to}
              className="inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-brand px-8 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
            >
              <BoltIcon />
              {CTA.primary.label}
            </Link>

            <Link
              to={CTA.secondary.to}
              className="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {CTA.secondary.label}
            </Link>
          </motion.div>

          <p className="mt-6 text-sm text-ink-faint">{CTA.reassurance}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="relative"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-1/2 h-64 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl"
          />
          <PhoneMockup tall className="relative">
            <TodayScreen />
          </PhoneMockup>
        </motion.div>
      </div>
    </section>
  )
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  )
}
