import { Card, Eyebrow } from '@/presentation/components/ds/Card'

/**
 * "Como seu sistema vai funcionar": o ciclo no lugar de uma curva projetada.
 * Sem histórico não há tendência pra desenhar; o que dá pra mostrar com
 * honestidade é o mecanismo. A projeção volta quando houver dados reais.
 */

const STEPS = ['Planejar', 'Executar', 'Registrar', 'Ajustar', 'Retomar'] as const

const SIZE = 220
/** Folga lateral pros rótulos de fora do círculo não serem cortados. */
const GUTTER = 56
const CENTER = SIZE / 2
const RADIUS = 70

function pointAt(index: number) {
  const angle = (-90 + (360 / STEPS.length) * index) * (Math.PI / 180)
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) }
}

export function SystemCycle() {
  return (
    <Card aria-labelledby="quiz-ciclo">
      <Eyebrow icon="retomar">Como seu sistema vai funcionar</Eyebrow>
      <h2 id="quiz-ciclo" className="mt-3 text-base font-semibold tracking-tight text-ink">
        O plano muda conforme você executa.
      </h2>

      <figure className="-mb-2">
        <svg
          viewBox={`${-GUTTER} 0 ${SIZE + GUTTER * 2} ${SIZE}`}
          role="img"
          aria-label={`Ciclo: ${STEPS.join(', ')}, e de volta a planejar`}
          className="mx-auto block w-full max-w-[20rem]"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            className="stroke-line-hi"
            strokeWidth={1.5}
            strokeDasharray="3 5"
          />
          {STEPS.map((step, index) => {
            const { x, y } = pointAt(index)
            const highlight = step === 'Retomar'
            const below = y > CENTER + 10
            const side = x < CENTER - 10 ? 'end' : x > CENTER + 10 ? 'start' : 'middle'
            const dx = side === 'end' ? -12 : side === 'start' ? 12 : 0
            const dy = side === 'middle' ? (below ? 24 : -14) : below ? 20 : 4
            return (
              <g key={step}>
                <circle cx={x} cy={y} r={highlight ? 7 : 5.5} className={highlight ? 'fill-brand-hi' : 'fill-brand'} />
                <text
                  x={x + dx}
                  y={y + dy}
                  textAnchor={side}
                  className={highlight ? 'fill-ink text-[11px] font-semibold' : 'fill-ink-muted text-[11px] font-medium'}
                >
                  {step}
                </text>
              </g>
            )
          })}
        </svg>
      </figure>
    </Card>
  )
}
