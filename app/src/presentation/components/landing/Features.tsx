import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O que o gratuito já faz no dia a dia, em seis cards.
 *
 * A seção anterior mostra as três telas; esta nomeia o que muda no dia de
 * quem usa, uma frase por recurso. Só entra o que roda pra qualquer conta: o
 * que é do PRO fica na seção seguinte, pra as duas não repetirem item.
 *
 * Em bento: os três recursos que mais mudam o dia ocupam duas colunas e
 * mostram um pedaço da interface (desenhado aqui, decorativo), o resto fica
 * só com ícone e frase.
 */
interface Feature {
  readonly title: string
  readonly description: string
  readonly icon: ReactNode
  readonly visual?: ReactNode
}

const FEATURES: readonly Feature[] = [
  {
    title: 'Plano por etapas',
    description: 'Sua meta vira etapas com prazo, do tamanho do tempo que você tem.',
    icon: <path d="M4 6h16M4 12h10M4 18h6" />,
    visual: <StagesVisual />,
  },
  {
    title: 'Dia adaptável',
    description: 'Sobraram 20 minutos? O passo encolhe pra versão mínima e o dia ainda conta.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </>
    ),
  },
  {
    title: 'Retomada sem culpa',
    description: 'Sumiu uns dias? Você volta de onde parou, sem zerar nada.',
    icon: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
  },
  {
    title: 'Momentumm Score',
    description: 'Um número que mostra a sua constância nos últimos 28 dias, não a sua perfeição.',
    icon: <path d="M4 18l5-6 4 3 7-9" />,
    visual: <ScoreVisual />,
  },
  {
    title: 'Rotina do dia',
    description: 'Ações, hábitos e rotina numa linha do tempo só, com o check na própria linha.',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ),
    visual: <TimelineVisual />,
  },
  {
    title: 'Juntos',
    description: 'Chame alguém pra acompanhar o dia um do outro.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15 14.5c3 0 6 1.5 6 4.5" />
      </>
    ),
  },
]

export function Features() {
  return (
    <Section id="funcionalidades" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="No dia a dia"
        title="Abra e saiba o que importa hoje."
        description="O Momentumm cuida do plano. Você só faz o passo do dia, e tudo isso já vem no gratuito."
      />

      <ul className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} className={cn(feature.visual !== undefined && 'md:col-span-2')}>
            <Reveal delay={(index % 3) * 0.06} className="h-full">
              <div
                className={cn(
                  'spotlight h-full rounded-card border border-line bg-surface p-5 sm:p-6',
                  feature.visual !== undefined && 'grid items-center gap-6 sm:grid-cols-[1fr_1.1fr]',
                )}
              >
                <div>
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-xl border border-brand/30 bg-brand-dim/40 text-brand-hi"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {feature.icon}
                    </svg>
                  </span>
                  <h3 className="mt-4 font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-pretty text-sm text-ink-muted">{feature.description}</p>
                </div>
                {feature.visual ? <div aria-hidden="true">{feature.visual}</div> : null}
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* Os pedaços de interface dos cards largos. Mesmos números do modo demo. */

function MiniPanel({ children }: { readonly children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-canvas/60 p-4">{children}</div>
}

const STAGES = [
  { name: 'Achar a brecha do dia', done: 100 },
  { name: 'Manter o ritmo', done: 45 },
  { name: 'Fechar a lista', done: 0 },
] as const

function StagesVisual() {
  return (
    <MiniPanel>
      <p className="text-xs font-medium text-ink">Ler 12 livros até dezembro</p>
      <ul className="mt-3 flex flex-col gap-3">
        {STAGES.map((stage, index) => (
          <li key={stage.name}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">
                {index + 1}. {stage.name}
              </span>
              <span className="tabular text-ink-faint">{stage.done}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hi">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand-hi"
                style={{ width: `${stage.done}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </MiniPanel>
  )
}

function ScoreVisual() {
  return (
    <MiniPanel>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Momentum Score</p>
          <p className="tabular mt-1 text-3xl font-semibold leading-none text-ink">
            58<span className="text-sm font-normal text-ink-faint">/100</span>
          </p>
        </div>
        <span className="rounded-full bg-brand-dim/60 px-2 py-0.5 text-xs font-medium text-brand-ink">
          +12 esta semana
        </span>
      </div>
      <svg viewBox="0 0 240 60" className="mt-3 h-14 w-full" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="feature-score" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-hi)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-brand-hi)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 52 L60 51 L110 50 L130 22 L150 28 L170 16 L195 8 L215 10 L240 14 L240 60 L0 60Z"
          fill="url(#feature-score)"
        />
        <path
          d="M0 52 L60 51 L110 50 L130 22 L150 28 L170 16 L195 8 L215 10 L240 14"
          stroke="var(--color-brand-hi)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </MiniPanel>
  )
}

const DAY = [
  { time: '07:00', label: 'Acordar e água', done: true },
  { time: '12:30', label: 'Ler 20 páginas', done: true },
  { time: '19:00', label: 'Treino de 30 min', done: false },
] as const

function TimelineVisual() {
  return (
    <MiniPanel>
      <ul className="flex flex-col gap-2.5">
        {DAY.map((item) => (
          <li key={item.time} className="flex items-center gap-3 text-xs">
            <span className="tabular w-10 text-ink-faint">{item.time}</span>
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border',
                item.done ? 'border-brand bg-brand text-white' : 'border-line-hi',
              )}
            >
              {item.done ? (
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : null}
            </span>
            <span className={cn(item.done ? 'text-ink-faint line-through' : 'text-ink')}>{item.label}</span>
          </li>
        ))}
      </ul>
    </MiniPanel>
  )
}
