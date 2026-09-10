import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Os três movimentos do produto, na ordem em que a pessoa vive: registrar,
 * acumular, manter. Substitui as quatro seções que repetiam as mesmas ideias
 * com títulos diferentes.
 */
const STEPS = [
  {
    title: 'Registra em dois toques',
    description:
      'Escolhe a área, toca no valor, acabou. Nenhum formulário longo pra guardar dez minutos de leitura — se registrar custar caro, ninguém registra.',
  },
  {
    title: 'Tudo soma na mesma linha',
    description:
      'Leitura, estudo, treino e meditação entram no mesmo histórico, na mesma sequência, nas mesmas estatísticas. Não são quatro módulos: é uma unidade só, a atividade.',
  },
  {
    title: 'A sequência segura o resto',
    description:
      'Ela só quebra quando um dia inteiro passa em branco, e o app avisa antes de você perder. Seu recorde fica guardado de qualquer jeito.',
  },
] as const

export function HowItWorks() {
  return (
    <Section id="como-funciona">
      <SectionHeading
        eyebrow="Como funciona"
        title="Registrar, acumular, continuar."
        description="Constância não vem de motivação, vem de atrito baixo. O app inteiro foi desenhado em cima disso."
      />

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.08}>
            <li className="pulse-on-hover relative h-full rounded-card border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-dim font-medium text-brand-hi">
                {index + 1}
              </span>
              <h3 className="mt-4 font-medium text-ink">{step.title}</h3>
              <p className="mt-2 text-pretty text-sm text-ink-muted">{step.description}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
