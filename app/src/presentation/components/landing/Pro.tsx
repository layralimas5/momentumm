import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/** Resumo da comparação: as linhas que realmente decidem a escolha. */
interface SpecRow {
  readonly label: string
  readonly value: string
}

interface Plan {
  readonly badge: string
  readonly headline: string
  readonly price: string
  readonly period: string
  readonly strikePrice?: string
  readonly monthlyEquivalent?: string
  readonly savings?: string
  readonly description: string
  readonly specs: readonly SpecRow[]
  readonly features: readonly string[]
  readonly cta: string
  readonly highlight?: boolean
}

const PLANS: readonly Plan[] = [
  {
    badge: 'Grátis',
    headline: 'Comece seu Momentum',
    price: 'R$ 0',
    period: 'para sempre',
    description: 'Registre seu progresso e construa consistência nas quatro áreas.',
    specs: [
      { label: 'Metas', value: '1 ativa' },
      { label: 'Histórico', value: 'Últimos 7 dias' },
      { label: 'Comunidade', value: 'Não incluída' },
    ],
    features: [
      '4 áreas da vida',
      'Registro diário sem limite',
      'Streak e recorde pessoal',
      '1 meta ativa',
      'Histórico de 7 dias',
    ],
    cta: 'Começar grátis',
  },
  {
    badge: '⚡ PRO',
    headline: 'Transforme progresso em evolução',
    price: 'R$ 29,90',
    period: '/mês',
    strikePrice: 'R$ 79,90',
    description: 'Tudo que você precisa para entender seus padrões e evoluir mais rápido.',
    specs: [
      { label: 'Metas', value: 'Ilimitadas' },
      { label: 'Histórico', value: 'Completo' },
      { label: 'Comunidade', value: 'Incluída' },
    ],
    features: [
      'Tudo do gratuito',
      'Comunidade, feed e perfil público',
      'Metas ilimitadas',
      'Histórico completo',
      'Momentum Score',
      'Analytics avançado',
      'Eixos personalizados',
      'Timer de foco',
      'Recap semanal e mensal',
      'Exportação dos dados',
      'Integrações',
      'Momentum Intelligence',
      'Insights personalizados com IA',
      'Suporte por e-mail',
    ],
    cta: 'Começar com PRO',
    highlight: true,
  },
  {
    badge: '🏆 PRO Anual',
    headline: 'Construa seu melhor ano',
    price: 'R$ 179,90',
    period: '/ano',
    strikePrice: 'R$ 278,90',
    monthlyEquivalent: 'R$ 14,99/mês',
    savings: 'Economize R$ 99,00',
    description: 'O ano inteiro pelo preço de seis meses, com vantagens de quem chegou cedo.',
    specs: [
      { label: 'Metas', value: 'Ilimitadas' },
      { label: 'Suporte', value: 'Prioritário' },
      { label: 'Selo Fundador', value: 'Incluído' },
    ],
    features: [
      'Tudo do PRO',
      'Suporte prioritário',
      'Preço protegido na renovação*',
      '⚡ Founder Badge para membros elegíveis',
      'Benefícios exclusivos de fundador',
      'Acesso antecipado a novidades',
    ],
    cta: 'Quero o PRO anual',
  },
]

export function Pro() {
  return (
    <Section id="pro" className="border-t border-line">
      <SectionHeading
        eyebrow="Momentumm PRO"
        title="Constância vira conquista"
        description="O essencial é grátis e continua grátis. O PRO é pra quem quer enxergar a própria evolução com lupa."
      />

      <ul className="mt-12 grid items-center gap-4 lg:grid-cols-3">
        {PLANS.map((plan, index) => (
          /*
            A escala do destaque fica NESTE li, não no card e não no Reveal:
            o Reveal escreve transform inline pra animação de entrada e
            engoliria a classe de escala; o card usa transform no hover.
          */
          <li
            key={plan.badge}
            className={cn('h-full', plan.highlight && 'relative z-10 lg:scale-[1.06]')}
          >
            <Reveal delay={index * 0.08} className="h-full">
              <article
                className={cn(
                  'pulse-on-hover flex h-full flex-col rounded-card border p-6',
                  plan.highlight
                    ? 'border-brand bg-brand-dim/30 shadow-xl shadow-brand/10'
                    : 'border-line bg-surface',
                )}
              >
                <p
                  className={cn(
                    'inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
                    plan.highlight ? 'bg-brand text-white' : 'border border-line text-ink-muted',
                  )}
                >
                  {plan.badge}
                </p>

                <h3 className="mt-4 text-balance text-lg font-semibold text-ink">{plan.headline}</h3>

                <div className="mt-4">
                  {/* O de-por fica na mesma linha: riscado em cima do preço lia
                      como preço antigo do plano, não como desconto. */}
                  <p className="flex flex-wrap items-baseline gap-x-1">
                    <span className="tabular text-3xl font-semibold text-ink">{plan.price}</span>
                    <span className="text-sm text-ink-muted">{plan.period}</span>
                    {plan.strikePrice ? (
                      <>
                        <span className="sr-only">, de</span>
                        <s className="tabular ml-2 text-sm text-ink-faint decoration-danger/70">
                          {plan.strikePrice}
                        </s>
                      </>
                    ) : null}
                  </p>
                  {plan.monthlyEquivalent ? (
                    <p className="tabular mt-1 text-sm text-ink-muted">{plan.monthlyEquivalent}</p>
                  ) : null}
                  {plan.savings ? (
                    <p className="mt-2 inline-flex rounded-full bg-positive/15 px-2.5 py-1 text-xs font-medium text-positive">
                      {plan.savings}
                    </p>
                  ) : null}
                </div>

                <p className="mt-4 text-pretty text-sm text-ink-muted">{plan.description}</p>

                {/* Comparação resumida: só o que muda de um plano pro outro. */}
                <dl
                  className={cn(
                    'mt-5 rounded-xl border px-4 py-3',
                    plan.highlight ? 'border-brand/40 bg-canvas/40' : 'border-line bg-surface-hi/60',
                  )}
                >
                  {plan.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0"
                    >
                      <dt className="text-xs text-ink-faint">{spec.label}</dt>
                      <dd
                        className={cn(
                          'text-right text-xs font-medium',
                          plan.highlight ? 'text-brand-hi' : 'text-ink',
                        )}
                      >
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-ink-muted">
                      <CheckIcon />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/entrar"
                  className={cn(
                    'mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors',
                    plan.highlight
                      ? 'bg-brand text-white hover:bg-brand-hi'
                      : 'border border-line text-ink hover:border-line-hi',
                  )}
                >
                  {plan.cta}
                </Link>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm text-ink-faint">
        * O preço protegido vale enquanto a assinatura anual não for cancelada. Os recursos do PRO
        entram conforme forem ficando prontos.
      </p>

    </Section>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 inline size-4 shrink-0 text-positive"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
