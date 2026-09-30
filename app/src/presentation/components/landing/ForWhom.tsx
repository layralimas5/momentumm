import { useId, useState, type PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O problema e o recorte, antes do produto.
 *
 * A coluna "é pra você" é escrita como o problema que a pessoa vive, não como
 * perfil demográfico: quem se reconhece numa linha já entendeu o que o app
 * resolve antes de ver qualquer tela. A coluna "não é" tira da conversa quem
 * ia se frustrar.
 *
 * Cada card é um botão: tocar abre a resposta, o que o Momentumm faz com
 * aquele problema. A frase curta prende; a resposta só aparece pra quem se
 * reconheceu nela, então a seção não vira um muro de texto.
 */
interface Item {
  readonly title: string
  readonly answer: string
}

const FOR: readonly Item[] = [
  {
    title: 'Você começa com tudo e larga na segunda semana.',
    answer: 'O plano nasce do tamanho do tempo que você tem, não da empolgação do primeiro dia.',
  },
  {
    title: 'Seu plano foi feito pro dia perfeito, e o seu dia quase nunca é.',
    answer: 'Sobraram 20 minutos? O passo encolhe pra versão mínima e o dia ainda conta.',
  },
  {
    title: 'Você some uns dias, sente que perdeu tudo e recomeça do zero.',
    answer: 'O Modo Retomada pega de onde você parou. Nada zera, nem o plano nem o progresso.',
  },
]

const NOT_FOR: readonly Item[] = [
  {
    title: 'Você procura uma agenda de tarefas pro trabalho ou pra equipe.',
    answer: 'O Momentumm é pra metas pessoais: leitura, estudo, treino, um projeto seu.',
  },
  {
    title: 'Você quer um app que cobre e castigue.',
    answer: 'Aqui um dia ruim faz a constância cair devagar, nunca zerar. Culpa não entra no plano.',
  },
  {
    title: 'Você quer que alguém faça por você.',
    answer: 'O plano sai pronto em menos de 2 minutos. O passo de cada dia continua sendo seu.',
  },
]

export function ForWhom() {
  return (
    <Section id="pra-quem">
      <SectionHeading
        eyebrow="Pra quem é"
        title="O problema não é você. É o plano."
        description="Plano grande demais pro tempo que sobra, e nenhum jeito de voltar depois de uma semana ruim. É isso que o Momentumm resolve."
      />

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-6">
        <Column title="É pra você se" items={FOR} tone="for" />
        <Column title="Não é pra você se" items={NOT_FOR} tone="not" delay={0.1} />
      </div>

      <p className="mt-8 text-center text-sm text-ink-faint">Toque num card pra ver a resposta.</p>
    </Section>
  )
}

interface ColumnProps {
  readonly title: string
  readonly items: readonly Item[]
  readonly tone: 'for' | 'not'
  readonly delay?: number
}

function Column({ title, items, tone, delay = 0 }: ColumnProps) {
  return (
    <div>
      <Reveal delay={delay}>
        <h3 className={cn('mb-4 font-semibold', tone === 'for' ? 'text-ink' : 'text-ink-muted')}>{title}</h3>
      </Reveal>
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.title}>
            <Reveal delay={delay + 0.08 * (index + 1)}>
              <ItemCard item={item} tone={tone} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ItemCard({ item, tone }: { readonly item: Item; readonly tone: 'for' | 'not' }) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const answerId = useId()
  const isFor = tone === 'for'

  // O brilho segue o ponteiro por variável CSS: nenhum re-render por movimento.
  const followPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - box.left}px`)
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - box.top}px`)
  }

  return (
    <motion.button
      type="button"
      aria-expanded={open}
      aria-controls={answerId}
      onClick={() => setOpen((value) => !value)}
      onPointerMove={followPointer}
      whileHover={reduced ? {} : { y: -4 }}
      whileTap={reduced ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'group relative w-full overflow-hidden rounded-card border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        isFor
          ? 'surface-brand border-brand/40 hover:border-brand/80'
          : 'border-line bg-surface hover:border-line-hi',
        open && (isFor ? 'border-brand/80' : 'border-line-hi'),
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          isFor
            ? 'bg-[radial-gradient(220px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_oklab,var(--color-brand)_28%,transparent),transparent_70%)]'
            : 'bg-[radial-gradient(220px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),rgb(255_255_255/0.06),transparent_70%)]',
        )}
      />

      <span className="relative flex items-start gap-3">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:scale-110',
            isFor ? 'bg-positive/15 text-positive' : 'bg-white/5 text-ink-faint',
          )}
        >
          {isFor ? <Icon name="check" className="size-4" /> : <CrossIcon />}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn('block text-pretty font-medium', isFor ? 'text-ink' : 'text-ink-muted')}>
            {item.title}
          </span>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.span
                key="answer"
                id={answerId}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="block overflow-hidden"
              >
                <span className={cn('block pt-2 text-pretty text-sm', isFor ? 'text-brand-ink' : 'text-ink-muted')}>
                  {item.answer}
                </span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>

        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-colors group-hover:border-line-hi group-hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.span>
      </span>
    </motion.button>
  )
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  )
}
