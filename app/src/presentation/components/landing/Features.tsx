import type { ReactNode } from 'react'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O que o gratuito já faz no dia a dia, em seis cards.
 *
 * A seção anterior mostra as três telas; esta nomeia o que muda no dia de
 * quem usa, uma frase por recurso. Só entra o que roda pra qualquer conta: o
 * que é do PRO fica na seção seguinte, pra as duas não repetirem item.
 */
interface Feature {
  readonly title: string
  readonly description: string
  readonly icon: ReactNode
}

const FEATURES: readonly Feature[] = [
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
  {
    title: 'Momentumm Score',
    description: 'Um número que mostra a sua constância nos últimos 28 dias, não a sua perfeição.',
    icon: <path d="M4 18l5-6 4 3 7-9" />,
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

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature, index) => (
          <li key={feature.title}>
            <Reveal delay={index * 0.06} className="h-full">
              <div className="pulse-on-hover h-full rounded-card border border-line bg-surface p-5">
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
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
