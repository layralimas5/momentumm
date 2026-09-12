import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { FloatingCard, MinutesCard, ScoreCard, TodayCard, WeekCard } from './HeroCards'
import { CTA } from './site'
import { TESTIMONIALS_BOTTOM, TESTIMONIALS_TOP } from './testimonials-data'

/**
 * A promessa no centro, com recortes do app flutuando em volta: o score, a
 * semana, os minutos e o dia de hoje. Em vez de um celular de lado, a pessoa
 * vê de cara os quatro números que o produto entrega, cada um num card
 * inclinado como se tivesse sido tirado da tela. Abaixo de xl os cards descem
 * pra uma grade, porque flutuando por cima do texto eles não cabem.
 */
const LINES = ['Objetivo vira plano.', 'Plano vira o que você faz hoje.'] as const

const EASE = [0.22, 1, 0.36, 1] as const

const AVATARS = [...TESTIMONIALS_TOP.slice(0, 2), ...TESTIMONIALS_BOTTOM.slice(0, 2)]

const AREAS = [
  { label: 'Estudo', color: 'bg-axis-estudo' },
  { label: 'Leitura', color: 'bg-axis-leitura' },
  { label: 'Treino', color: 'bg-axis-treino' },
  { label: 'Meditação', color: 'bg-axis-meditacao' },
  { label: 'Concurso', color: 'bg-axis-custom-1' },
  { label: 'Projeto pessoal', color: 'bg-axis-custom-2' },
  { label: 'Idioma', color: 'bg-axis-custom-3' },
] as const

const CARDS = [
  {
    key: 'score',
    node: <ScoreCard />,
    tilt: -6,
    delay: 0.5,
    float: 'left-0 top-32 xl:left-2',
  },
  {
    key: 'week',
    node: <WeekCard />,
    tilt: 4,
    delay: 0.65,
    float: 'left-6 top-[23rem] xl:left-10',
  },
  {
    key: 'minutes',
    node: <MinutesCard />,
    tilt: 5,
    delay: 0.55,
    float: 'right-0 top-28 xl:right-2',
  },
  {
    key: 'today',
    node: <TodayCard />,
    tilt: -4,
    delay: 0.7,
    float: 'right-8 top-[22.5rem] xl:right-12',
  },
] as const

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[48rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-32 sm:pt-40 lg:pb-24 xl:pt-44">
        {CARDS.map((card) => (
          <FloatingCard
            key={card.key}
            tilt={card.tilt}
            delay={card.delay}
            className={cn('absolute hidden xl:block', card.float)}
          >
            {card.node}
          </FloatingCard>
        ))}

        <div className="mx-auto max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/80 py-1.5 pl-1.5 pr-4 text-sm text-ink-muted backdrop-blur"
          >
            <span className="flex -space-x-2">
              {AVATARS.map((person) => (
                <img
                  key={person.name}
                  src={person.photo}
                  alt=""
                  width={28}
                  height={28}
                  decoding="async"
                  className="size-7 rounded-full object-cover ring-2 ring-canvas"
                />
              ))}
            </span>
            <span>
              <span className="font-medium text-ink">{CTA.badge}</span>: as primeiras pessoas já
              estão dentro
            </span>
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
            className="mx-auto mt-6 max-w-xl text-pretty text-lg text-ink-muted"
          >
            O Momentumm transforma o que você quer alcançar em ações diárias, mede se o seu ritmo
            está de pé e ajusta o plano quando ele para de funcionar. Não é um app de hábitos: é um
            sistema de progresso pessoal.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to={CTA.primary.to}
              className="inline-flex h-13 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-hi sm:w-auto"
            >
              {CTA.primary.label}
              <ArrowIcon direction="up" />
            </Link>

            <Link
              to={CTA.secondary.to}
              className="inline-flex h-13 w-full max-w-xs items-center justify-center gap-2 rounded-full border border-line-hi bg-surface/80 px-7 font-medium text-ink backdrop-blur transition-colors hover:bg-surface-hi sm:w-auto"
            >
              Ver por dentro
              <ArrowIcon direction="down" />
            </Link>
          </motion.div>

          <p className="mt-6 text-sm text-ink-faint">{CTA.reassurance}</p>
        </div>

        {/* Abaixo de xl: fita rolável no celular, grade de quatro no tablet. */}
        <div className="-mx-4 mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 pt-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:justify-items-center lg:overflow-visible lg:px-0 xl:hidden">
          {CARDS.map((card) => (
            <FloatingCard
              key={card.key}
              tilt={card.tilt / 2}
              delay={card.delay}
              className="shrink-0 snap-center"
            >
              {card.node}
            </FloatingCard>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mx-auto mt-16 max-w-3xl text-center xl:mt-24"
        >
          <p className="text-sm text-ink-faint">Serve pra qualquer objetivo com prazo</p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {AREAS.map((area) => (
              <li
                key={area.label}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-sm text-ink-muted"
              >
                <span aria-hidden="true" className={cn('size-1.5 rounded-full', area.color)} />
                {area.label}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

function ArrowIcon({ direction }: { readonly direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-4 shrink-0', direction === 'down' && 'rotate-90')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}
