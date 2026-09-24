import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A dor, em linguagem de gente.
 *
 * Não é "problema de sistema" nem "arquitetura de hábitos": é o ciclo que
 * todo mundo já viveu, desenhado como ciclo mesmo, porque a palavra que
 * fecha a volta ("recomeça") é a que faz a pessoa se reconhecer. Cinco
 * palavras e uma seta que volta pro começo dizem mais que três cards de
 * explicação.
 */
const CYCLE = [
  { label: 'Planeja', note: 'domingo à noite' },
  { label: 'Começa', note: 'a primeira semana sai' },
  { label: 'Perde um dia', note: 'reunião, cansaço, imprevisto' },
  { label: 'Abandona', note: 'a lista virou dívida' },
  { label: 'Recomeça', note: 'na próxima segunda' },
] as const

export function Problem() {
  return (
    <Section id="problema" className="border-t border-line">
      <SectionHeading
        eyebrow="O problema"
        title={
          <>
            <span className="block">Você sabe começar.{' '}</span>
            <span className="block text-brand-hi">O difícil é continuar.</span>
          </>
        }
        description="Quando a semana está tranquila, qualquer plano funciona. O problema começa quando você perde um dia, tem menos tempo do que esperava ou simplesmente não consegue fazer tudo."
      />

      <Cycle />

      <Reveal delay={0.24}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-lg text-ink-muted">
          O Momentumm foi criado para{' '}
          <span className="font-medium text-ink">quebrar esse ciclo</span>.
        </p>
      </Reveal>
    </Section>
  )
}

/**
 * O ciclo: cinco passos numa fileira, ligados por uma linha que atravessa
 * por trás e termina na volta escrita embaixo. No celular vira coluna, que
 * cinco caixas lado a lado numa tela de 360px viram texto de 9 pixels.
 *
 * O passo do abandono é o único em tom de alerta: é onde a pessoa está
 * quando chega aqui, e é o ponto que o produto ataca na seção seguinte.
 */
function Cycle() {
  const reduced = useReducedMotion()

  return (
    <div className="relative mt-10">
      {/* A linha que liga os passos, só onde eles ficam lado a lado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[10%] right-[10%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-line-hi to-transparent sm:block"
      />

      <ol className="relative grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {CYCLE.map((step, index) => {
          const abandono = step.label === 'Abandona'
          return (
            <motion.li
              key={step.label}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className={cn(
                'pulse-on-hover rounded-card border bg-surface px-3 py-3 text-center',
                // "Recomeça" fecha a volta: ocupa a linha inteira no celular.
                index === CYCLE.length - 1 && 'col-span-2 sm:col-span-1',
                abandono ? 'border-flame/40' : 'border-line',
              )}
            >
              <p className={cn('text-sm font-medium', abandono ? 'text-flame' : 'text-ink')}>
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">{step.note}</p>
            </motion.li>
          )
        })}
      </ol>

      {/* A volta: a seta que ninguém desenha, e que é o produto inteiro. */}
      <Reveal delay={0.45}>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-ink-faint">
          <LoopIcon className="size-4 shrink-0 text-brand-hi" />
          e na segunda seguinte tudo começa de novo, do zero
        </p>
      </Reveal>
    </div>
  )
}

function LoopIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
    </svg>
  )
}
