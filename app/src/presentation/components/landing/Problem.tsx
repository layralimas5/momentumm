import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A dor antes de qualquer recurso. Não é "falta de disciplina": é que o plano
 * ideal não sobrevive ao dia real, e nenhuma ferramenta avisa quando isso
 * acontece. A linha do tempo mostra o padrão que todo mundo reconhece.
 */
const TIMELINE = [
  {
    day: 'Dia 1',
    title: 'A motivação monta o plano',
    description:
      'Objetivo novo, lista cheia, hábito pra todo dia. O plano é do tamanho da empolgação, não do tamanho da semana.',
  },
  {
    day: 'Dia 12',
    title: 'O dia real não cabe no plano',
    description:
      'Uma noite ruim, uma reunião a mais. A lista de hoje vira dívida de amanhã, e amanhã já tinha a lista dele.',
  },
  {
    day: 'Dia 30',
    title: 'O app é fechado, o objetivo fica',
    description:
      'Não por preguiça: porque a ferramenta só sabia cobrar o plano ideal. Ela nunca percebeu que ele tinha parado de funcionar.',
  },
] as const

export function Problem() {
  return (
    <Section id="problema" className="border-t border-line">
      <SectionHeading
        eyebrow="O problema"
        title="Você não tem um problema de motivação. Tem um problema de sistema."
        description="Começar é fácil. Todo mundo começa. O que quase ninguém tem é uma forma de continuar quando o dia não sai como o planejado."
      />

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {TIMELINE.map((step, index) => (
          <Reveal key={step.day} delay={index * 0.08}>
            <li className="pulse-on-hover relative h-full rounded-card border border-line bg-surface p-6">
              <span className="text-sm font-medium tabular text-brand-hi">{step.day}</span>
              <h3 className="mt-2 text-balance font-medium text-ink">{step.title}</h3>
              <p className="mt-2 text-pretty text-sm text-ink-muted">{step.description}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.24}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-lg text-ink-muted">
          Agenda, lista e habit tracker registram o que você planejou. Nenhum deles percebe quando o
          plano deixou de funcionar.{' '}
          <span className="text-ink">O Momentumm foi feito pra perceber isso no dia 12, não no dia 30.</span>
        </p>
      </Reveal>
    </Section>
  )
}
