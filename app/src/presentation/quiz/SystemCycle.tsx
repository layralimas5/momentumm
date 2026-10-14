import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { Card, Eyebrow } from '@/presentation/components/ds/Card'

/**
 * "Como seu sistema vai funcionar": o ciclo no lugar de uma curva projetada.
 * Sem histórico não há tendência pra desenhar; o que dá pra mostrar com
 * honestidade é o mecanismo. A projeção volta quando houver dados reais.
 *
 * Um ponto de luz percorre o anel sem parar. Cada etapa acende quando ele
 * passa, e o centro diz em poucas palavras o que acontece ali. O giro só
 * roda com o card na tela, e com movimento reduzido o ciclo fica parado e
 * inteiro aceso.
 */

const STEPS = [
  { name: 'Planejar', phrase: 'O passo do dia já vem escolhido' },
  { name: 'Executar', phrase: 'Você faz, nem que seja o mínimo' },
  { name: 'Registrar', phrase: 'Um toque e já conta' },
  { name: 'Ajustar', phrase: 'O plano encolhe ou cresce' },
  { name: 'Retomar', phrase: 'Volta de onde parou, sem zerar' },
] as const

/** Uma volta inteira. Tempo pra ler a frase de cada etapa. */
const LOOP_SECONDS = 9
const STEP_ANGLE = 360 / STEPS.length

const SIZE = 220
/** Folga lateral pros rótulos de fora do círculo não serem cortados. */
const GUTTER = 56
const CENTER = SIZE / 2
const RADIUS = 72
/** O rastro do ponto, em fração da volta. */
const TRAIL = 0.24

function pointAt(degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(radians), y: CENTER + RADIUS * Math.sin(radians) }
}

/** O rastro: um arco fixo que termina no topo do anel, onde o ponto mora. */
const TRAIL_START = pointAt(-TRAIL * 360)
const TRAIL_PATH = `M ${TRAIL_START.x} ${TRAIL_START.y} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER} ${CENTER - RADIUS}`

export function SystemCycle() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const baseId = useId().replace(/:/g, '')
  const glowId = `cycle-glow-${baseId}`
  const trailId = `cycle-trail-${baseId}`

  const angle = useMotionValue(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (reduced || !inView) return
    const from = angle.get() % 360
    const controls = animate(angle, from + 360, { duration: LOOP_SECONDS, ease: 'linear', repeat: Infinity })
    return () => controls.stop()
  }, [reduced, inView, angle])

  useMotionValueEvent(angle, 'change', (value) => {
    // Atributo do SVG, não CSS: o centro do giro fica exato no centro do anel.
    orbitRef.current?.setAttribute('transform', `rotate(${value % 360} ${CENTER} ${CENTER})`)
    const next = Math.floor((value % 360) / STEP_ANGLE) % STEPS.length
    setActive((current) => (current === next ? current : next))
  })

  /*
    Rastro e ponto giram juntos num grupo só: o rastro é um arco fixo que
    termina no topo e o ponto mora no topo. Calcular os dois separado deixava
    o rastro visivelmente atrás do ponto na tela.
  */
  const orbitRef = useRef<SVGGElement>(null)

  const animated = !reduced
  const current = STEPS[active] ?? STEPS[0]

  return (
    <Card aria-labelledby="quiz-ciclo">
      <Eyebrow icon="retomar">Como seu sistema vai funcionar</Eyebrow>
      <h2 id="quiz-ciclo" className="mt-3 text-base font-semibold tracking-tight text-ink">
        O plano muda conforme você executa.
      </h2>

      <ol className="sr-only">
        {STEPS.map((step) => (
          <li key={step.name}>
            {step.name}: {step.phrase}.
          </li>
        ))}
        <li>E de volta a planejar.</li>
      </ol>

      <div ref={ref} className="relative mx-auto mt-1 w-full max-w-[20rem]" aria-hidden="true">
        <svg viewBox={`${-GUTTER} 0 ${SIZE + GUTTER * 2} ${SIZE}`} className="block w-full">
          <defs>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* O rastro some na cauda e acende perto do ponto. */}
            <linearGradient
              id={trailId}
              gradientUnits="userSpaceOnUse"
              x1={TRAIL_START.x}
              y1={TRAIL_START.y}
              x2={CENTER}
              y2={CENTER - RADIUS}
            >
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-brand-hi)" stopOpacity="1" />
            </linearGradient>
          </defs>

          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            className="stroke-line-hi"
            strokeWidth={1.5}
            strokeDasharray="3 5"
          />

          {animated ? (
            <g ref={orbitRef}>
              <path
                d={TRAIL_PATH}
                fill="none"
                stroke={`url(#${trailId})`}
                strokeWidth={3}
                strokeLinecap="round"
                filter={`url(#${glowId})`}
              />
              <circle cx={CENTER} cy={CENTER - RADIUS} r={5} fill="white" filter={`url(#${glowId})`} />
            </g>
          ) : null}

          {STEPS.map((step, index) => {
            const { x, y } = pointAt(index * STEP_ANGLE)
            const lit = !animated || index === active
            const below = y > CENTER + 10
            const side = x < CENTER - 10 ? 'end' : x > CENTER + 10 ? 'start' : 'middle'
            const dx = side === 'end' ? -13 : side === 'start' ? 13 : 0
            const dy = side === 'middle' ? (below ? 25 : -15) : below ? 21 : 4
            return (
              <g key={step.name}>
                {animated && index === active ? (
                  <motion.circle
                    key={`ring-${active}`}
                    cx={x}
                    cy={y}
                    fill="none"
                    stroke="var(--color-brand-hi)"
                    strokeWidth={1.5}
                    initial={{ r: 7, opacity: 0.8 }}
                    animate={{ r: 19, opacity: 0 }}
                    transition={{ duration: 1.1, ease: 'easeOut' }}
                  />
                ) : null}
                <motion.circle
                  cx={x}
                  cy={y}
                  initial={false}
                  animate={{ r: lit ? 7.5 : 5, opacity: lit ? 1 : 0.45 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                  fill={lit ? 'var(--color-brand-hi)' : 'var(--color-brand)'}
                  filter={lit && animated ? `url(#${glowId})` : undefined}
                />
                <text
                  x={x + dx}
                  y={y + dy}
                  textAnchor={side}
                  className={
                    lit
                      ? 'fill-ink text-[11.5px] font-semibold transition-colors duration-300'
                      : 'fill-ink-faint text-[11px] font-medium transition-colors duration-300'
                  }
                >
                  {step.name}
                </text>
              </g>
            )
          })}

        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="w-[34%] text-center">
            {animated ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.name}
                  initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="eyebrow text-[0.62rem] text-brand-hi">{current.name}</p>
                  <p className="mt-1 text-[0.72rem] leading-snug text-balance text-ink-muted">{current.phrase}</p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <p className="text-[0.72rem] leading-snug text-balance text-ink-muted">
                Retomar faz parte do ciclo. Nada zera.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
