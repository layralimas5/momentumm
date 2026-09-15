import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A comparação é por CRITÉRIO, não por recurso. "Tem lembrete" toda
 * ferramenta tem; "percebe quando o plano parou" é a pergunta que decide.
 *
 * No desktop vira tabela. No celular, uma tabela de seis colunas fica
 * ilegível, então cada critério vira um card com a lista de quem cumpre.
 */
const TOOLS = ['Notion', 'Agenda', 'Lista de tarefas', 'Habit tracker', 'Momentumm'] as const
type Tool = (typeof TOOLS)[number]

interface Criterion {
  readonly label: string
  readonly note: string
  readonly covers: readonly Tool[]
}

/** Cinco critérios. Dia adaptável e constância já apareceram nas telas e no score. */
const CRITERIA: readonly Criterion[] = [
  {
    label: 'Liga cada ação a um objetivo com prazo',
    note: 'No Momentumm, ação sem objetivo vai pra caixa de entrada e não conta progresso até ganhar destino.',
    covers: ['Notion', 'Momentumm'],
  },
  {
    label: 'Sabe quanto do objetivo já andou',
    note: 'Etapas com peso que somam 100. A barra mede avanço real, não tarefas riscadas.',
    covers: ['Momentumm'],
  },
  {
    label: 'Percebe quando o plano parou de funcionar',
    note: 'Sinais combinados: execução baixa, objetivo sem avanço, adiamentos, queda de ritmo.',
    covers: ['Momentumm'],
  },
  {
    label: 'Sugere o próximo ajuste, com botão pra aplicar',
    note: 'Cada leitura do ritmo vem com a ação que a resolve: reduzir, reagendar, trazer pra hoje.',
    covers: ['Momentumm'],
  },
  {
    label: 'Marca o que foi feito no dia',
    note: 'Isso todo mundo faz. A diferença é o que acontece quando não foi feito.',
    covers: ['Notion', 'Agenda', 'Lista de tarefas', 'Habit tracker', 'Momentumm'],
  },
]

export function Comparison() {
  return (
    <Section id="comparacao" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Por que é diferente"
        title="Não é um Notion mais bonito. Nem mais um habit tracker."
        description="Essas ferramentas registram o que você planejou. A pergunta que separa o Momentumm delas é o que acontece no dia em que o plano não sai."
      />

      {/* Desktop: tabela. */}
      <Reveal className="mt-12 hidden md:block">
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Comparação de critérios entre Notion, agenda, lista de tarefas, habit tracker e
              Momentumm
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-4 text-left font-medium text-ink-muted">
                  O que importa
                </th>
                {TOOLS.map((tool) => (
                  <th
                    key={tool}
                    scope="col"
                    className={cn(
                      'px-3 py-4 text-center font-medium',
                      tool === 'Momentumm' ? 'bg-brand-dim/30 text-brand-ink' : 'text-ink-muted',
                    )}
                  >
                    {tool}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((criterion) => (
                <tr key={criterion.label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-5 py-4 text-left font-normal text-ink">
                    {criterion.label}
                  </th>
                  {TOOLS.map((tool) => {
                    const covered = criterion.covers.includes(tool)
                    return (
                      <td
                        key={tool}
                        className={cn(
                          'px-3 py-4 text-center',
                          tool === 'Momentumm' && 'bg-brand-dim/30',
                        )}
                      >
                        <Mark covered={covered} highlight={tool === 'Momentumm'} />
                        <span className="sr-only">{covered ? 'Sim' : 'Não'}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Celular: um card por critério. */}
      <ul className="mt-12 flex flex-col gap-3 md:hidden">
        {CRITERIA.map((criterion, index) => {
          const others = criterion.covers.filter((tool) => tool !== 'Momentumm')
          return (
            <Reveal key={criterion.label} delay={index * 0.04}>
              <li className="rounded-card border border-line bg-surface p-5">
                <p className="font-medium text-ink">{criterion.label}</p>
                <p className="mt-2 text-sm text-ink-muted">{criterion.note}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-dim/40 px-2.5 py-1 text-xs font-medium text-brand-ink">
                    <Mark covered highlight small />
                    Momentumm
                  </span>
                  {others.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted"
                    >
                      {tool}
                    </span>
                  ))}
                  {others.length === 0 ? (
                    <span className="self-center text-xs text-ink-faint">só aqui</span>
                  ) : null}
                </p>
              </li>
            </Reveal>
          )
        })}
      </ul>
    </Section>
  )
}

function Mark({
  covered,
  highlight = false,
  small = false,
}: {
  covered: boolean
  highlight?: boolean
  small?: boolean
}) {
  const size = small ? 'size-3.5' : 'size-5'
  if (!covered) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn(size, 'mx-auto text-ink-faint/60')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M7 12h10" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(size, 'mx-auto', highlight ? 'text-brand-hi' : 'text-ink-muted')}
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
