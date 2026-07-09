import { Section, SectionHeading } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

const steps = [
  {
    n: '01',
    title: 'Diga aonde quer chegar.',
    lines: [
      'Escreva suas metas do jeito que elas existem na sua cabeça.',
      'Sem fórmula complicada.',
      'Sem precisar ter tudo resolvido.',
      'Só comece pelo que importa pra você.',
    ],
  },
  {
    n: '02',
    title: 'Caminhe no seu ritmo.',
    lines: [
      'Marque um progresso aqui.',
      'Leia um capítulo ali.',
      'Continue quando puder.',
      'Porque, nos dias difíceis, um passo pequeno ainda conta.',
    ],
  },
  {
    n: '03',
    title: 'Veja sua evolução acontecer.',
    lines: [
      'Abra o Aura e reencontre tudo o que já construiu.',
      'As metas que avançaram.',
      'Os livros que fizeram parte da sua história.',
      'Os pequenos passos que você teria esquecido.',
      'Sua evolução, visível, te lembrando por que continuar.',
    ],
  },
]

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="relative">
      <Reveal>
        <SectionHeading
          eyebrow="Como funciona"
          title="Simples de começar. Feito pra continuar."
          subtitle="Três passos entre quem você é hoje e quem decidiu se tornar."
        />
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <Reveal key={step.n} delay={i * 0.08}>
            <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7 hover:aura-pulse">
              <span className="text-4xl font-semibold text-transparent [-webkit-text-stroke:1px_rgba(167,139,250,0.5)]">
                {step.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
              <div className="mt-3 space-y-1.5">
                {step.lines.map((line) => (
                  <p key={line} className="leading-relaxed text-zinc-400">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
