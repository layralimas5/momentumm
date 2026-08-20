import { motion } from 'framer-motion'
import { Reveal } from './Reveal'

/**
 * Bloco "Por que escolher": destaque numérico com ondas à esquerda, três razões
 * empilhadas à direita e o gráfico de evolução ocupando a base.
 */

/**
 * Slot do número grande. Enquanto não existe base de usuários, mostra um dado
 * verdadeiro do produto. Troque por { value: '2.400+', ... } quando houver gente.
 */
const HIGHLIGHT = {
  label: 'Tudo que te faz evoluir',
  value: '4 eixos',
  note: 'leitura, estudo, treino e meditação inclusos',
} as const

const REASONS = [
  {
    kicker: 'sem abrir e assinar vários apps',
    title: 'Tudo em um',
    icon: 'M4 7 12 3l8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4',
  },
  {
    kicker: 'evolução não é só academia',
    title: 'Mente e corpo',
    icon: 'M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z',
  },
  {
    kicker: 'a sequência que segura a constância',
    title: 'Streak e metas',
    icon: 'M12 3c.6 3.2-1.3 4.6-2.7 6.1S7 11.8 7 13.9a5 5 0 0 0 10 0c0-1.6-.6-2.8-1.4-3.9',
  },
] as const

export function WhyMomentumm() {
  return (
    <section className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <Reveal>
          <div className="overflow-hidden rounded-card border border-line bg-surface/40">
            <header className="border-b border-line px-6 py-6 sm:px-8">
              <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Por que escolher o <span className="text-brand-hi">Momentumm</span>?
              </h2>
            </header>

            <div className="grid lg:grid-cols-2">
              <Highlight />

              <ul className="border-t border-line lg:border-l lg:border-t-0">
                {REASONS.map((reason) => (
                  <li
                    key={reason.title}
                    className="flex items-center justify-between gap-6 border-b border-line px-6 py-6 last:border-b-0 sm:px-8"
                  >
                    <div>
                      <p className="text-sm text-ink-faint">{reason.kicker}</p>
                      <p className="mt-1 text-xl font-medium text-ink sm:text-2xl">{reason.title}</p>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-6 shrink-0 text-brand-hi"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={reason.icon} />
                    </svg>
                  </li>
                ))}
              </ul>
            </div>

            <EvolutionChart />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Highlight() {
  return (
    <div className="relative flex min-h-72 flex-col justify-end overflow-hidden px-6 py-8 sm:px-8">
      {/* Ondas concêntricas saindo do ponto: o movimento que se propaga. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute right-[18%] top-[26%] -translate-y-1/2 translate-x-1/2">
          {/* Anéis fixos dão a estrutura; os que pulsam saem do centro em ondas. */}
          {[1, 2, 3, 4].map((ring) => (
            <span
              key={`base-${ring}`}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15"
              style={{ width: `${ring * 7}rem`, height: `${ring * 7}rem` }}
            />
          ))}

          {[0, 1.75, 3.5, 5.25].map((delay) => (
            <span
              key={`ripple-${delay}`}
              className="ripple-ring absolute left-1/2 top-1/2 rounded-full border border-brand/60"
              style={{ width: '28rem', height: '28rem', animationDelay: `${delay}s` }}
            />
          ))}

          <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2">
            <span className="orbit-dot block size-4 rounded-full bg-brand shadow-[0_0_28px_var(--color-brand)]" />
          </span>
        </div>
      </div>

      <div className="relative">
        <p className="text-sm text-ink-faint">{HIGHLIGHT.label}</p>
        <p className="mt-1 text-6xl font-semibold tracking-tight text-ink sm:text-7xl">
          {HIGHLIGHT.value}
        </p>
        <p className="mt-2 text-sm text-ink-faint">{HIGHLIGHT.note}</p>
      </div>
    </div>
  )
}

/** Pontos da curva em coordenadas do viewBox, do primeiro dia ao histórico. */
const POINTS = [
  [20, 150],
  [180, 132],
  [340, 112],
  [520, 96],
  [700, 70],
  [860, 44],
] as const

function EvolutionChart() {
  const path = POINTS.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')

  return (
    <div className="relative border-t border-line px-6 pb-6 pt-6 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-ink-faint">Da rotina à evolução</p>
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink uppercase">
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          Constância registrada
        </p>
      </div>

      <svg
        viewBox="0 0 880 170"
        preserveAspectRatio="none"
        role="img"
        aria-label="Curva de evolução subindo do primeiro registro até o histórico acumulado"
        className="mt-4 h-32 w-full sm:h-40"
      >
        <defs>
          <linearGradient id="curva-momentumm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand)" />
            <stop offset="100%" stopColor="var(--color-flame)" />
          </linearGradient>
        </defs>

        {/* Guias verticais marcando a passagem do tempo. */}
        {POINTS.slice(1, -1).map(([x]) => (
          <line
            key={x}
            x1={x}
            y1="0"
            x2={x}
            y2="170"
            stroke="var(--color-line)"
            strokeDasharray="4 6"
          />
        ))}

        {/* Rastro largo e difuso embaixo da linha, pra curva parecer acesa. */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#curva-momentumm)"
          strokeWidth="10"
          strokeLinecap="round"
          className="glow-pulse"
          style={{ filter: 'blur(10px)' }}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.path
          d={path}
          fill="none"
          stroke="url(#curva-momentumm)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />

        {POINTS.map(([x, y], index) => {
          const isLast = index === POINTS.length - 1
          return (
            <motion.circle
              key={x}
              cx={x}
              cy={y}
              r={isLast ? 6 : 4}
              fill="var(--color-canvas)"
              stroke={isLast ? 'var(--color-flame)' : 'var(--color-brand-hi)'}
              strokeWidth="2.5"
              initial={{ opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.35, delay: 0.35 + index * 0.22 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          )
        })}

        {/* Halo no último ponto: é onde a sequência está agora. */}
        <motion.circle
          cx={POINTS[POINTS.length - 1]?.[0]}
          cy={POINTS[POINTS.length - 1]?.[1]}
          r="6"
          fill="none"
          stroke="var(--color-flame)"
          strokeWidth="2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: [0.7, 0, 0.7], scale: [1, 2.6, 1] }}
          viewport={{ once: false }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut', delay: 1.4 }}
          style={{
            transformOrigin: `${POINTS[POINTS.length - 1]?.[0]}px ${POINTS[POINTS.length - 1]?.[1]}px`,
          }}
        />
      </svg>

      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-medium text-ink sm:text-3xl">Hoje</p>
          <p className="text-sm text-ink-faint">comece</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-medium text-ink sm:text-3xl">Histórico</p>
          <p className="text-sm text-ink-faint">acompanhe sua evolução</p>
        </div>
      </div>
    </div>
  )
}
