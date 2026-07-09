import { Target, BookOpen, Compass, Quote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Section, SectionHeading } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'
import { DashboardPreview } from '@/presentation/components/landing/DashboardPreview'
import { CtaButton } from '@/presentation/components/landing/CtaButton'

interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

const features: Feature[] = [
  {
    icon: Target,
    title: 'Metas com progresso em %',
    text: 'Veja exatamente quanto falta pra cada objetivo. Nada de "acho que tô avançando".',
  },
  {
    icon: BookOpen,
    title: 'Estante de leituras',
    text: 'Quero ler, lendo, lido. Nunca mais esqueça onde parou em cada livro.',
  },
  {
    icon: Compass,
    title: 'Painel da sua jornada',
    text: 'Metas e leituras juntas, numa olhada só. O seu momento, sempre à vista.',
  },
  {
    icon: Quote,
    title: 'Um lembrete do seu porquê',
    text: 'Uma frase sua, todo dia, pra puxar você de volta quando a rotina apertar.',
  },
]

/** Prova do produto + recursos concretos + CTA no meio da página. */
export function ProductTour() {
  return (
    <Section id="produto" className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/4 top-1/3 -z-10 h-80 w-[500px] max-w-full rounded-full bg-brand-600/10 blur-[120px]"
      />
      <Reveal>
        <SectionHeading
          eyebrow="Veja por dentro"
          title="Simples de usar. Feito pra você não desistir."
          subtitle="Tudo o que você precisa pra transformar intenção em progresso — e nada além disso."
        />
      </Reveal>

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <Reveal>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/25 to-blush-500/20 blur-2xl"
            />
            <DashboardPreview />
          </div>
        </Reveal>

        <div className="space-y-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-blush-500/20 text-brand-300 ring-1 ring-white/10">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-1 text-zinc-400">{f.text}</p>
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.1}>
            <div className="pt-3">
              <CtaButton />
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
