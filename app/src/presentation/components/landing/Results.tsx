import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * "Resultados reais. Evolução visível."
 *
 * Os cards abaixo são o ESQUELETO da seção. Cada um vira um resultado de gente
 * de verdade conforme forem aparecendo: troque `pending: true` por
 * `{ metric, label, quote, author }` e o card assume o formato final sozinho.
 */

interface Result {
  readonly metric: string
  readonly label: string
  readonly quote: string
  readonly author: string
}

interface PendingSlot {
  readonly pending: true
  readonly hint: string
}

type Slot = Result | PendingSlot

const SLOTS: readonly Slot[] = [
  { pending: true, hint: 'Primeiro resultado de leitura' },
  { pending: true, hint: 'Primeiro resultado de constância' },
  { pending: true, hint: 'Primeiro resultado de treino' },
]

function isPending(slot: Slot): slot is PendingSlot {
  return 'pending' in slot
}

export function Results() {
  return (
    <Section id="resultados" className="border-t border-line">
      <SectionHeading
        eyebrow="Resultados"
        title="Resultados reais. Evolução visível."
        description="Não é antes e depois de foto. É o número que a pessoa não tinha antes de começar a registrar."
      />

      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {SLOTS.map((slot, index) => (
          <Reveal key={index} delay={index * 0.08}>
            <li className="h-full">
              {isPending(slot) ? <PendingCard hint={slot.hint} /> : <ResultCard result={slot} />}
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}

function ResultCard({ result }: { result: Result }) {
  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-surface p-6">
      <p className="text-4xl font-semibold tracking-tight text-ink">{result.metric}</p>
      <p className="mt-1 text-sm text-brand-hi">{result.label}</p>
      <blockquote className="mt-4 text-pretty text-sm text-ink-muted">“{result.quote}”</blockquote>
      <p className="mt-auto pt-4 text-xs text-ink-faint">{result.author}</p>
    </article>
  )
}

function PendingCard({ hint }: { hint: string }) {
  return (
    <article className="flex h-full min-h-52 flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full border border-line text-ink-faint"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 19V5m0 14h16M8 15l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="mt-3 text-sm font-medium text-ink">{hint}</p>
      <p className="mt-1 text-sm text-ink-faint">Chega aqui em breve.</p>
    </article>
  )
}
