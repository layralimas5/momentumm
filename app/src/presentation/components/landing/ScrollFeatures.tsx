import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { BUILTIN_ACTIVITY_TYPES } from '@/domain/entities/activity-type'
import { cn } from '@/shared/lib/cn'
import { MockCard, MockHeader, PhoneMockup } from './PhoneMockup'

/**
 * Celular fixo enquanto o texto rola: cada passo que entra na tela troca o
 * conteúdo do aparelho. Um bloco só conta a história inteira do app.
 */

interface Step {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly screen: ReactNode
}

const STEPS: readonly Step[] = [
  {
    id: 'comunidade',
    eyebrow: 'Comunidade',
    title: 'Sua evolução no feed de quem te segue.',
    description:
      'Registra, aparece pra quem acompanha e recebe o incentivo na hora. Sem métrica de vaidade, sem cobrança.',
    screen: <FeedScreen />,
  },
  {
    id: 'leituras',
    eyebrow: 'Leituras',
    title: 'Cada página lida vira histórico.',
    description:
      'Marca a leitura do dia em dois toques e acompanha o livro avançar sem precisar de planilha.',
    screen: <ReadingScreen />,
  },
  {
    id: 'metas',
    eyebrow: 'Metas',
    title: 'A meta soma sozinha enquanto você vive.',
    description:
      'Define por dia, semana ou mês. O progresso se atualiza a cada registro, sem você abrir nada.',
    screen: <GoalsScreen />,
  },
  {
    id: 'treinos',
    eyebrow: 'Treinos',
    title: 'O treino entra na mesma linha do tempo.',
    description:
      'Corpo e mente no mesmo lugar: o treino de hoje soma com a leitura e o estudo na mesma sequência.',
    screen: <TrainingScreen />,
  },
]

export function ScrollFeatures() {
  const container = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)

  /*
    Deep link vindo do menu (#passo-leituras, #passo-metas...). Como a seção é
    controlada por scroll, ir pro passo é rolar até a fatia dele em vez de
    apenas mudar o estado, senão o próximo scroll jogaria a pessoa de volta.
  */
  useEffect(() => {
    const goToStep = () => {
      const match = /^#passo-(.+)$/.exec(window.location.hash)
      if (!match) return

      const index = STEPS.findIndex((step) => step.id === match[1])
      const element = container.current
      if (index < 0 || !element) return

      const stepHeight = element.offsetHeight / STEPS.length
      window.scrollTo({
        top: element.offsetTop + stepHeight * index + stepHeight / 2,
        behavior: 'smooth',
      })
    }

    goToStep()
    window.addEventListener('hashchange', goToStep)
    return () => window.removeEventListener('hashchange', goToStep)
  }, [])

  // A seção é alta e o conteúdo fica preso no meio dela: o scroll não desce a
  // tela, ele troca o passo. Texto e celular mudam juntos, no mesmo lugar.
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const index = Math.min(STEPS.length - 1, Math.max(0, Math.floor(progress * STEPS.length)))
    setActive((current) => (current === index ? current : index))
  })

  const current = STEPS[active] ?? STEPS[0]

  return (
    <section
      ref={container}
      className="relative border-t border-line"
      style={{ height: `${STEPS.length * 100}vh` }}
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-1/3 size-[32rem] translate-x-1/3 rounded-full bg-brand/10 blur-[120px]"
        />

        <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-center gap-8 px-4 py-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={current?.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-sm font-medium text-flame">{current?.eyebrow}</p>
                <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
                  {current?.title}
                </h2>
                <p className="mt-4 max-w-md text-pretty text-sm text-ink-muted sm:text-base">
                  {current?.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Progresso dos passos. Quem controla é o scroll. */}
            <ol className="mt-8 flex gap-2" aria-label="Progresso da seção">
              {STEPS.map((step, index) => (
                <li
                  key={step.id}
                  aria-current={active === index ? 'step' : undefined}
                  className={cn(
                    'h-1 w-10 rounded-full transition-colors duration-300',
                    active === index ? 'bg-brand' : 'bg-line',
                  )}
                >
                  <span className="sr-only">{step.eyebrow}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <PhoneMockup>
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {current?.screen}
                </motion.div>
              </AnimatePresence>
            </PhoneMockup>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeedScreen() {
  const posts = [
    { name: 'ana', axis: 'leitura', text: 'leu 32 páginas', note: 'Hábitos Atômicos', kudos: 12 },
    { name: 'rafa', axis: 'treino', text: 'treinou 45 minutos', note: 'Perna, sem vontade', kudos: 8 },
    { name: 'ju', axis: 'meditacao', text: 'meditou 10 minutos', note: 'Antes do celular', kudos: 5 },
  ] as const

  return (
    <>
      <MockHeader title="Feed" subtitle="Quem você segue, hoje." />
      {posts.map((post) => {
        const type = BUILTIN_ACTIVITY_TYPES[post.axis]
        return (
          <MockCard key={post.name} className="mt-2.5 first:mt-0">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-surface-hi text-[9px] font-medium text-ink-muted">
                {post.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-xs font-medium text-ink">@{post.name}</span>
              <span
                aria-hidden="true"
                className="ml-auto size-2 rounded-full"
                style={{ backgroundColor: type.colorToken }}
              />
            </div>
            <p className="mt-2 text-xs text-ink">{post.text}</p>
            <p className="text-[10px] text-ink-faint">{post.note}</p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-flame">
              <span aria-hidden="true">▲</span> {post.kudos}
            </p>
          </MockCard>
        )
      })}
    </>
  )
}

function ReadingScreen() {
  return (
    <>
      <MockHeader title="Leitura" subtitle="Sequência de 18 dias." />
      <MockCard>
        <p className="text-xs font-medium text-ink">Hábitos Atômicos</p>
        <p className="text-[10px] text-ink-faint">James Clear</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hi">
          <span className="block h-full w-3/4 rounded-full bg-axis-leitura" />
        </div>
        <p className="tabular mt-2 text-[10px] text-ink-muted">218 de 288 páginas</p>
      </MockCard>
      <p className="mt-4 text-[10px] uppercase tracking-wide text-ink-muted">Últimos registros</p>
      {['Hoje · 32 páginas', 'Ontem · 18 páginas', 'Terça · 26 páginas'].map((row) => (
        <p key={row} className="border-b border-line py-2.5 text-xs text-ink last:border-0">
          {row}
        </p>
      ))}
    </>
  )
}

function GoalsScreen() {
  const goals = [
    { label: 'Leitura', value: '26 de 20 páginas', percent: 100, done: true },
    { label: 'Estudo', value: '180 de 300 min', percent: 60, done: false },
    { label: 'Treino', value: '90 de 150 min', percent: 60, done: false },
  ] as const

  return (
    <>
      <MockHeader title="Metas" subtitle="Três ativas nesta semana." />
      {goals.map((goal) => (
        <MockCard key={goal.label} className="mt-2.5 first:mt-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{goal.label}</span>
            <span className={cn('tabular', goal.done ? 'text-positive' : 'text-ink-muted')}>
              {goal.value}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hi">
            <span
              className={cn('block h-full rounded-full', goal.done ? 'bg-positive' : 'bg-brand')}
              style={{ width: `${goal.percent}%` }}
            />
          </div>
        </MockCard>
      ))}
    </>
  )
}

function TrainingScreen() {
  return (
    <>
      <MockHeader title="Hoje" subtitle="85 minutos de evolução." />
      <MockCard>
        <p className="text-[10px] uppercase tracking-wide text-ink-muted">Sequência</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-3xl font-semibold text-ink">18</span>
          <span className="text-xs text-ink-muted">dias</span>
        </div>
        <div className="mt-3 flex gap-1">
          {[1, 1, 1, 1, 0, 1, 1].map((done, index) => (
            <span
              key={index}
              className={cn(
                'h-6 flex-1 rounded',
                done ? 'bg-brand' : 'border border-line bg-surface-hi',
              )}
            />
          ))}
        </div>
      </MockCard>
      <p className="mt-4 text-[10px] uppercase tracking-wide text-ink-muted">Registros de hoje</p>
      {[
        { axis: 'treino', text: 'treinou 45 minutos' },
        { axis: 'leitura', text: 'leu 26 páginas' },
        { axis: 'meditacao', text: 'meditou 10 minutos' },
      ].map((row) => {
        const type = BUILTIN_ACTIVITY_TYPES[row.axis as keyof typeof BUILTIN_ACTIVITY_TYPES]
        return (
          <p key={row.axis} className="flex items-center gap-2 border-b border-line py-2.5 text-xs text-ink last:border-0">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: type.colorToken }}
            />
            {row.text}
          </p>
        )
      })}
    </>
  )
}
