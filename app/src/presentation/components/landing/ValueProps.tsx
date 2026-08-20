import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const ITEMS = [
  {
    title: 'Registro em dois toques',
    description:
      'Escolhe o eixo, toca no valor, acabou. Nada de formulário longo pra registrar dez minutos de leitura.',
    icon: 'M5 12h14M12 5v14',
  },
  {
    title: 'Sequência que não te pune',
    description:
      'A sequência só quebra quando você passa o dia inteiro sem registrar. Acordar sem ter feito nada ainda não zera nada.',
    icon: 'M12 3c.6 3.2-1.3 4.6-2.7 6.1S7 11.8 7 13.9a5 5 0 0 0 10 0c0-1.6-.6-2.8-1.4-3.9',
  },
  {
    title: 'Metas que cabem num dia ruim',
    description:
      'Uma meta ativa por eixo e período. Menos metas abertas, mais chance real de bater.',
    icon: 'M12 3v18M5 8l7-5 7 5',
  },
  {
    title: 'Tudo no mesmo lugar',
    description:
      'Leitura, estudo, treino e meditação somam na mesma linha do tempo, em vez de viver em quatro apps.',
    icon: 'M4 6h16M4 12h16M4 18h10',
  },
] as const

export function ValueProps() {
  return (
    <Section id="recursos">
      <SectionHeading
        eyebrow="Recursos"
        title="Tudo que te faz evoluir. Num lugar só."
        description="Constância não vem de motivação, vem de atrito baixo. O app inteiro foi desenhado em cima disso."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((item, index) => (
          <Reveal key={item.title} delay={index * 0.06}>
            <li className="pulse-on-hover h-full rounded-card border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d={item.icon} />
                </svg>
              </span>
              <h3 className="mt-4 font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-pretty text-sm text-ink-muted">{item.description}</p>
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
