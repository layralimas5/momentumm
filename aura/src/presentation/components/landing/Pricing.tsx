import { Check, Sparkles } from 'lucide-react'
import { Section, SectionHeading } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'
import { CtaButton } from '@/presentation/components/landing/CtaButton'
import { CtaLink } from '@/presentation/components/landing/CtaLink'
import { cn } from '@/shared/lib/cn'

const includes = [
  'Metas ilimitadas com progresso',
  'Estante de leituras completa',
  'Painel da sua jornada',
  'Acesso em qualquer dispositivo',
]

interface Plan {
  name: string
  price: string
  period: string
  note?: string
  highlight?: boolean
}

const plans: Plan[] = [
  { name: 'Mensal', price: 'R$ 29,90', period: '/mês' },
  { name: 'Trimestral', price: 'R$ 69,90', period: '/3 meses', note: 'Equivale a R$ 23,30/mês' },
  {
    name: 'Anual',
    price: 'R$ 179,90',
    period: '/ano',
    note: 'Equivale a R$ 14,99/mês · melhor valor',
    highlight: true,
  },
]

export function Pricing() {
  return (
    <Section id="planos" className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-[700px] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-600/15 to-blush-500/15 blur-[120px]"
      />
      <Reveal>
        <SectionHeading
          eyebrow="Planos"
          title="Garanta o preço de fundadora"
          subtitle="As 10 primeiras pessoas travam o menor preço do Aura — R$ 14,90/mês, pra sempre. Depois, o valor sobe."
        />
      </Reveal>

      {/* Plano fundadora — escassez real, sem contador falso */}
      <Reveal className="mx-auto mt-12 max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-brand-400/40 bg-gradient-to-br from-brand-500/10 to-blush-500/10 p-8 md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute right-[-10%] top-[-30%] h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-blush-500 px-3 py-1 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Só as 10 primeiras
          </span>

          <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-white">Fundadora</h3>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-semibold tracking-tight text-white">R$ 14,90</span>
                <span className="pb-1.5 text-zinc-400">/mês</span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                <span className="text-zinc-500 line-through">R$ 29,90/mês</span> · preço travado
                pra sempre
              </p>
            </div>
            <div className="shrink-0">
              <CtaButton label="Quero ser fundadora" />
            </div>
          </div>

          <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                <Check className="h-4 w-4 shrink-0 text-brand-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* Planos padrão */}
      <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
        {plans.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 0.06}>
            <div
              className={cn(
                'flex h-full flex-col rounded-2xl border p-6',
                plan.highlight
                  ? 'border-brand-400/40 bg-white/[0.05]'
                  : 'border-white/10 bg-white/[0.03]',
              )}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">{plan.name}</h4>
                {plan.highlight && (
                  <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                    Melhor valor
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-2xl font-semibold text-white">{plan.price}</span>
                <span className="pb-0.5 text-sm text-zinc-500">{plan.period}</span>
              </div>
              {plan.note && <p className="mt-1 text-xs text-zinc-500">{plan.note}</p>}
              <CtaLink className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-white/15 text-sm font-medium text-white transition-colors hover:border-brand-400/50 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                Assinar
              </CtaLink>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto mt-6 max-w-3xl">
        <p className="text-center text-sm text-zinc-500">
          Pagamento seguro. Você recebe o acesso por e-mail assim que a compra for confirmada.
        </p>
      </Reveal>
    </Section>
  )
}
