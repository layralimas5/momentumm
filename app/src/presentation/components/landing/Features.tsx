import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { PhoneMockup } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O que o app faz, numa seção só.
 *
 * A tela Hoje no centro é uma captura real do app (`/telas/hoje.webp`), não
 * um desenho: quando o front mudar, basta trocar o arquivo. Os recursos ficam
 * três de cada lado no desktop e embaixo do celular no resto, sempre
 * centralizados.
 *
 * Cada recurso é uma frase sobre o que muda no dia da pessoa, não o nome da
 * função. Só entra aqui o que o app já faz.
 */
interface Feature {
  readonly title: string
  readonly description: string
  readonly icon: ReactNode
}

const LEFT: readonly Feature[] = [
  {
    title: 'Plano por etapas',
    description: 'Sua meta vira etapas com prazo, do tamanho do tempo que você tem.',
    icon: <path d="M4 6h16M4 12h10M4 18h6" />,
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
]

const RIGHT: readonly Feature[] = [
  {
    title: 'Momentumm Score',
    description: 'Um número que mostra a sua constância nos últimos 28 dias, não a sua perfeição.',
    icon: <path d="M4 18l5-6 4 3 7-9" />,
  },
  {
    title: 'Momentumm AI',
    description: 'Olha sua meta, seu plano e seu tempo antes de sugerir o próximo ajuste.',
    icon: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
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
        eyebrow="O app"
        title="Abra e saiba o que importa hoje."
        description="O Momentumm cuida do plano. Você só faz o passo do dia."
      />

      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
        <Reveal className="lg:order-2">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-1/2 h-64 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl"
            />
            <PhoneMockup className="relative" tall flush>
              <img
                src="/telas/hoje.webp"
                alt=""
                width={600}
                height={1298}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </PhoneMockup>
          </div>
        </Reveal>

        <FeatureList features={LEFT} className="lg:order-1" />
        <FeatureList features={RIGHT} className="lg:order-3" delay={0.1} />
      </div>
    </Section>
  )
}

function FeatureList({
  features,
  className,
  delay = 0,
}: {
  readonly features: readonly Feature[]
  readonly className?: string
  readonly delay?: number
}) {
  return (
    <ul className={cn('grid gap-8 sm:grid-cols-3 sm:gap-6 lg:grid-cols-1 lg:gap-10', className)}>
      {features.map((feature, index) => (
        <li key={feature.title}>
          <Reveal delay={delay + index * 0.06} className="flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-xl border border-brand/30 bg-brand-dim/40 text-brand-hi"
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
            <p className="mt-1.5 max-w-xs text-pretty text-sm text-ink-muted">{feature.description}</p>
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
