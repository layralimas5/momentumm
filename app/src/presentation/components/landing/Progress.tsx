import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O número, sem a fórmula.
 *
 * A conta do Momentumm Score tem quatro fatores, pesos e uma janela com a
 * semana atual valendo o triplo. Nada disso convence alguém que ainda está
 * decidindo se o app resolve o problema dela: o que convence é ver que uma
 * terça vazia não apaga o mês. A explicação completa é assunto de uma página
 * própria ("Como funciona o Momentumm Score"), não do primeiro contato.
 *
 * A grade de 28 dias existe justamente pra não precisar explicar: o dia
 * vazio está lá, marcado, e o número continua de pé ao lado dele.
 */
const WINDOW_DAYS = 28
const EMPTY_DAYS = new Set([6, 16])
const MINIMAL_DAYS = new Set([3, 9, 14, 22])

export function Progress() {
  return (
    <Section id="progresso" className="border-t border-line">
      <SectionHeading
        eyebrow="Progresso"
        title="Um número para entender seu momento."
        description="O Momentumm Score mostra a sua constância agora. Ele não zera porque um dia não saiu como planejado."
      />

      <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <div className="pulse-on-hover surface-brand edge-light flex h-full flex-col justify-center rounded-card p-6 text-center sm:p-8">
            <p className="text-sm text-ink-faint">Momentumm</p>
            <CountUp
              value={72}
              className="text-gradient-brand tabular mt-1 block text-6xl font-semibold leading-none tracking-tight sm:text-7xl"
            />
            <p className="mt-4">
              <span className="inline-flex rounded-full border border-brand/40 bg-brand-dim/40 px-3 py-1 text-sm font-medium text-brand-ink">
                Constante
              </span>
            </p>
            <p className="tabular mt-3 text-sm text-positive">+4 esta semana</p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <DayGrid />
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-xl font-medium text-ink sm:text-2xl">
          Uma terça ruim não apaga um mês de progresso.
        </p>
      </Reveal>

    </Section>
  )
}

/** Os 28 dias da janela: cheios, mínimos e os dois vazios que não derrubam nada. */
function DayGrid() {
  const reduced = useReducedMotion()
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => index)

  return (
    <div className="pulse-on-hover h-full rounded-card border border-line bg-surface p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Seus últimos 28 dias</p>
        <p className="tabular text-xs text-ink-faint">{WINDOW_DAYS - EMPTY_DAYS.size} com movimento</p>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-2" aria-hidden="true">
        {days.map((day) => {
          const empty = EMPTY_DAYS.has(day)
          const minimal = MINIMAL_DAYS.has(day)
          return (
            <motion.li
              key={day}
              initial={reduced ? false : { opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.3, delay: 0.1 + day * 0.015 }}
              className={cn(
                'mx-auto size-4 rounded-full sm:size-4.5',
                empty && 'border border-dashed border-line-hi',
                !empty && minimal && 'bg-brand/40',
                !empty && !minimal && 'bg-brand-hi',
              )}
            />
          )
        })}
      </ol>

      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-faint">
        <Legend className="bg-brand-hi">dia cheio</Legend>
        <Legend className="bg-brand/40">versão mínima, que conta</Legend>
        <Legend className="border border-dashed border-line-hi">dia vazio</Legend>
      </dl>
    </div>
  )
}

function Legend({
  className,
  children,
}: {
  readonly className: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className={cn('size-3 shrink-0 rounded-full', className)} />
      <dd>{children}</dd>
    </div>
  )
}

/** O número sobe de zero até o valor quando entra na tela: ritmo se vê andando, não parado. */
function CountUp({ value, className }: { readonly value: number; readonly className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()
  const [current, setCurrent] = useState(reduced ? value : 0)

  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setCurrent(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, reduced, value])

  return (
    <span ref={ref} className={className}>
      {current}
    </span>
  )
}
