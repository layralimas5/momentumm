import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O recorte, logo depois do problema.
 *
 * A coluna "é pra você" é escrita como o problema que a pessoa vive, não como
 * perfil demográfico: quem se reconhece numa linha já entendeu o que o app
 * resolve antes de ver qualquer tela. A coluna "não é" tira da conversa quem
 * ia se frustrar, e cada linha dela ainda diz uma coisa sobre o produto.
 */
const FOR: readonly string[] = [
  'Você começa com tudo e larga na segunda semana.',
  'Seu plano foi feito pro dia perfeito, e o seu dia quase nunca é.',
  'Você some uns dias, sente que perdeu tudo e recomeça do zero.',
]

const NOT_FOR: readonly string[] = [
  'Você procura uma agenda de tarefas pro trabalho ou pra equipe.',
  'Você quer um app que cobre e castigue: aqui dia ruim não zera nada.',
  'Você quer que alguém faça por você: o plano sai pronto, o passo é seu.',
]

export function ForWhom() {
  return (
    <Section id="pra-quem" className="border-t border-line bg-surface/30">
      <SectionHeading
        eyebrow="Pra quem é"
        title="Feito pra quem começa bem e trava no meio."
        description="Se uma linha da esquerda é a sua história, o Momentumm foi feito pro seu jeito de tropeçar."
      />

      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        <Reveal>
          <Column title="É pra você se" items={FOR} tone="for" />
        </Reveal>
        <Reveal delay={0.08}>
          <Column title="Não é pra você se" items={NOT_FOR} tone="not" />
        </Reveal>
      </div>
    </Section>
  )
}

interface ColumnProps {
  readonly title: string
  readonly items: readonly string[]
  readonly tone: 'for' | 'not'
}

function Column({ title, items, tone }: ColumnProps) {
  const isFor = tone === 'for'

  return (
    <div
      className={cn(
        'h-full rounded-card border p-6 sm:p-7',
        isFor ? 'surface-brand edge-light border-brand/50' : 'spotlight border-line bg-surface',
      )}
    >
      <h3 className={cn('font-semibold', isFor ? 'text-ink' : 'text-ink-muted')}>{title}</h3>
      <ul className="mt-5 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item} className={cn('flex gap-3 text-pretty', isFor ? 'text-ink' : 'text-ink-muted')}>
            {isFor ? (
              <Icon name="check" className="mt-0.5 size-5 shrink-0 text-positive" />
            ) : (
              <CrossIcon />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 size-5 shrink-0 text-ink-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  )
}
