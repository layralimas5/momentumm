import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

/**
 * O app embaixo do hero, em abas: o plano, o dia, o progresso e a dupla.
 *
 * As abas trocam sozinhas, e a barra que enche na aba ativa avisa quando a
 * próxima vem. Tem o efeito de um vídeo curto sem o peso de um: são quatro
 * capturas reais do app em modo demo, e só a primeira disputa o LCP.
 *
 * A troca para quando o mouse ou o foco estão no mockup, quando ele sai da
 * tela e de vez quando a pessoa escolhe uma aba (a partir daí quem manda é
 * ela). Quem pediu menos movimento vê as abas paradas, sem barra.
 */
interface Screen {
  readonly label: string
  readonly src: string
  readonly alt: string
}

const SCREENS: readonly Screen[] = [
  {
    label: 'Seu plano',
    src: '/telas/plano-3s.webp',
    alt: 'Plano gerado pelo Momentumm: a meta "ler 12 livros até dezembro" dividida em três marcos com prazo e uma rotina de 3 dias por semana, 20 minutos por vez.',
  },
  {
    label: 'Hoje',
    src: '/telas/hoje-3s.webp',
    alt: 'Tela Hoje do Momentumm: o Momentum Score da semana, a prioridade de agora com o botão Iniciar Foco e a lista do dia.',
  },
  {
    label: 'Progresso',
    src: '/telas/progresso-3s.webp',
    alt: 'Tela Progresso do Momentumm: o Momentum Score subindo nos últimos 30 dias e a semana com os dias consistentes.',
  },
  {
    label: 'Juntos',
    src: '/telas/juntos-3s.webp',
    alt: 'Tela Juntos do Momentumm: a dupla com a sequência em comum, a semana de cada um e os incentivos de um toque.',
  },
]

const ROTATE_MS = 4000

export function HeroScreens() {
  const baseId = useId()
  const reduced = useReducedMotion() === true
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [chosen, setChosen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true))
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const rotating = !reduced && !chosen
  const paused = hovered || !visible

  const choose = (index: number) => {
    setChosen(true)
    setActive(index)
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + SCREENS.length) % SCREENS.length
    choose(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        role="tablist"
        aria-label="Telas do Momentumm"
        className="mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/70 p-1 backdrop-blur"
      >
        {SCREENS.map((screen, index) => {
          const selected = index === active
          return (
            <button
              key={screen.label}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-4',
                selected ? 'bg-brand-dim/60 text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {screen.label}
              {selected && rotating ? (
                <span
                  key={active}
                  aria-hidden="true"
                  onAnimationEnd={() => setActive((current) => (current + 1) % SCREENS.length)}
                  style={{ ['--tab-fill-duration' as string]: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                  className="absolute inset-x-3 bottom-0.5 h-0.5 origin-left animate-tab-fill rounded-full bg-brand-hi"
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <figure className="relative mx-auto mt-6 max-w-[340px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-10 h-72 rounded-full bg-brand/25 blur-3xl"
        />
        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          className="relative h-[420px] overflow-hidden rounded-t-[2.5rem] border border-b-0 border-line-hi bg-surface p-2.5 pb-0 shadow-2xl shadow-black/40 sm:h-[480px]"
        >
          <div className="relative">
            {SCREENS.map((screen, index) => (
              <img
                key={screen.src}
                src={screen.src}
                alt={index === active ? screen.alt : ''}
                aria-hidden={index === active ? undefined : true}
                width={780}
                height={1688}
                decoding="async"
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'low'}
                className={cn(
                  'block w-full rounded-t-[2rem]',
                  index > 0 && 'absolute inset-0',
                  /*
                    A nova entra por cima e a anterior só some depois, por
                    baixo: duas telas meio transparentes juntas viram borrão.
                  */
                  index === active ? 'z-10 opacity-100' : 'z-0 opacity-0',
                  !reduced &&
                    (index === active
                      ? 'transition-opacity duration-500'
                      : 'transition-opacity delay-500 duration-0'),
                )}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-canvas to-transparent"
          />
        </div>
      </figure>
    </div>
  )
}
