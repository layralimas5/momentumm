import type { ReactNode } from 'react'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O que existe além do básico, pra quem já entendeu o app e quer saber até
 * onde ele vai. Quatro itens, uma frase cada, sem print: a seção prepara a
 * comparação dos planos e não repete o que a anterior já mostrou.
 *
 * Tudo aqui é do PRO e está na lista inteira do plano (`PRO_ALL_FEATURES`).
 * O review semanal fica de fora de propósito: ele é o diferencial e tem
 * seção própria.
 */
interface Feature {
  readonly title: string
  readonly description: string
  readonly icon: ReactNode
}

const FEATURES: readonly Feature[] = [
  {
    title: 'Momentumm AI',
    description: `Transforma um objetivo em plano por etapas e sugere o próximo ajuste olhando o seu tempo real. ${PLAN_LIMITS.pro.aiCallsPerMonth} leituras por mês.`,
    icon: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
  },
  {
    title: 'Histórico e métricas',
    description: 'Tudo desde o primeiro dia, com a evolução do Score e as métricas da semana e do mês.',
    icon: <path d="M4 18l5-6 4 3 7-9" />,
  },
  {
    title: 'Avisos de rota',
    description: 'Você fica sabendo quando uma etapa trava, a constância cai ou o dia passa da sua capacidade.',
    icon: (
      <>
        <path d="M12 4 2.5 20h19z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
  },
  {
    title: 'Juntos sem limite',
    description: 'Duplas ilimitadas, a semana inteira da dupla e todos os incentivos, todo dia.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15 14.5c3 0 6 1.5 6 4.5" />
      </>
    ),
  },
]

export function AdvancedFeatures() {
  return (
    <Section id="recursos" className="border-t border-line">
      <SectionHeading
        eyebrow="Recursos do PRO"
        title="Quando o básico já funciona, o PRO vai além."
        description="O gratuito roda o ciclo inteiro. O PRO tira os limites e traz o que ajuda a enxergar o caminho."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {FEATURES.map((feature, index) => (
          <li key={feature.title}>
            <Reveal delay={index * 0.06} className="h-full">
              <div className="h-full rounded-card border border-line bg-surface p-5">
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
