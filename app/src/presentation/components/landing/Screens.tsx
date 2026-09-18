import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import {
  HabitsScreen,
  ObjectivesScreen,
  PlanScreen,
  ProgressScreen,
  ReviewScreen,
  TodayScreen,
} from './AppScreens'
import { PhoneMockup } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * As seis telas do ciclo, uma por vez. As abas são botões de verdade com
 * padrão tablist: o mockup é `aria-hidden`, então a descrição ao lado precisa
 * dizer sozinha o que a tela faz.
 */
interface Screen {
  readonly id: string
  readonly icon: IconName
  readonly label: string
  readonly title: string
  readonly description: string
  readonly points: readonly string[]
  readonly render: () => ReactNode
}

const SCREENS: readonly Screen[] = [
  {
    id: 'hoje',
    icon: 'hoje',
    label: 'Hoje',
    title: 'O que fazer agora, e o que muda quando o dia não sai como planejado.',
    description:
      'A tela que você abre todo dia responde quatro perguntas, nessa ordem: como estou hoje, o que importa agora, qual é a próxima ação, estou avançando de verdade.',
    points: [
      'Check-in de dez segundos que define a capacidade do dia',
      'Uma prioridade principal, sempre com versão mínima',
      'Dia Adaptável: você diz quanto tempo tem e o plano encolhe, sem empilhar tudo em amanhã',
      'Modo Retomada: depois de uma pausa, até três passos pequenos pra voltar, sem encerrar nenhuma sequência',
    ],
    render: () => <TodayScreen />,
  },
  {
    id: 'objetivos',
    icon: 'objetivo',
    label: 'Objetivos',
    title: 'Onde você quer chegar, com prazo e o quanto já andou de verdade.',
    description:
      'Cada objetivo mostra o avanço real, a próxima ação e a previsão de quando fecha no ritmo atual. Objetivo parado é dito em voz alta, junto com a saída.',
    points: [
      'Progresso calculado pelas etapas, não por tarefas riscadas',
      'Previsão condicional: "mantendo esse ritmo, fecha em..."',
      '"Trazer pra hoje" na próxima ação de qualquer objetivo',
    ],
    render: () => <ObjectivesScreen />,
  },
  {
    id: 'habitos',
    icon: 'habitos',
    label: 'Hábitos',
    title: 'A repetição que segura o plano quando a motivação cai.',
    description:
      'Hábito tem frequência, versão mínima e sequência própria. Pular e adiar são estados legítimos: perder um dia não é punido, e a versão mínima preserva a sequência.',
    points: [
      'Versão mínima pra dia ruim, sem quebrar a sequência',
      'Vinculado ao objetivo e, se quiser, à etapa do plano',
      'Sequência conta dias cumpridos, não dias perfeitos',
    ],
    render: () => <HabitsScreen />,
  },
  {
    id: 'plano',
    icon: 'plano',
    label: 'Plano',
    title: 'O caminho até cada objetivo, e onde ele está travando.',
    description:
      'Etapas com peso que somam 100, cada uma com data e ações. O app aponta o gargalo, a etapa que está segurando o objetivo, e a ação que destrava a próxima.',
    points: [
      'Pesos redistribuídos sozinhos ao criar ou apagar etapa',
      'Gargalo detectado só onde alguma etapa já andou',
      'Caixa de entrada pra ação que ainda não tem objetivo',
    ],
    render: () => <PlanScreen />,
  },
  {
    id: 'progresso',
    icon: 'progresso',
    label: 'Progresso',
    title: 'Se o seu ritmo está de pé, o que caiu e qual é o próximo ajuste.',
    description:
      'O Momentumm Score com os quatro fatores, a curva dos últimos 14 dias e a leitura em uma frase do que mais mexeu. Em vez de gráfico bonito, uma resposta.',
    points: [
      'Número, classificação e variação contra a semana anterior',
      'Onde você avançou e o que precisa de atenção',
      'O próximo ajuste, com o botão que executa',
    ],
    render: () => <ProgressScreen />,
  },
  {
    id: 'review',
    icon: 'calendario',
    label: 'Review semanal',
    title: 'O que a semana mostrou e o que muda na próxima.',
    description:
      'Execução em porcentagem, onde evoluiu, onde o ritmo caiu e uma recomendação concreta. Regras determinísticas sobre os seus dados: sem padrão, o bloco fica vazio.',
    points: [
      'Não cobra dias anteriores à criação do hábito',
      'Prioridades da semana seguinte saem do review',
      'Fica separado do dia: relatório dentro do dia vira contabilidade',
    ],
    render: () => <ReviewScreen />,
  },
]

const EASE = [0.22, 1, 0.36, 1] as const

export function Screens() {
  const [activeId, setActiveId] = useState<string>(SCREENS[0]?.id ?? 'hoje')
  const baseId = useId()
  const active = SCREENS.find((screen) => screen.id === activeId) ?? SCREENS[0]

  if (!active) return null

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = SCREENS.findIndex((screen) => screen.id === activeId)
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = SCREENS[(index + delta + SCREENS.length) % SCREENS.length]
    if (!next) return
    setActiveId(next.id)
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus()
  }

  return (
    <Section id="telas" className="bg-gradient-to-b from-brand-deep via-brand to-brand-hi">
      <SectionHeading
        tone="brand"
        eyebrow="Por dentro"
        title="Seis telas. Um exemplo só atravessa todas."
        description="O mesmo objetivo visto do dia, do plano, do progresso e do review. Nenhum número aparece diferente em duas telas."
      />

      <div
        role="tablist"
        aria-label="Telas do Momentumm"
        onKeyDown={onKeyDown}
        className="mt-10 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:justify-center [&::-webkit-scrollbar]:hidden"
      >
        {SCREENS.map((screen) => {
          const selected = screen.id === activeId
          return (
            <button
              key={screen.id}
              id={`${baseId}-tab-${screen.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(screen.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                selected
                  ? 'border-white/70 bg-white text-brand-deep'
                  : 'border-white/30 text-white/85 hover:border-white/60 hover:text-white',
              )}
            >
              <Icon
                name={screen.icon}
                className={cn('size-4', selected ? 'text-brand' : 'text-white/70')}
              />
              {screen.label}
            </button>
          )
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className="mt-10 grid items-center gap-10 md:grid-cols-2 md:gap-14"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="order-2 md:order-1"
          >
            <p className="text-sm font-medium uppercase tracking-wide text-white/80">
              {active.label}
            </p>
            <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white">
              {active.title}
            </h3>
            <p className="mt-4 text-pretty text-white/85">{active.description}</p>
            <ul className="mt-6 space-y-3">
              {active.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-white/85">
                  <CheckIcon />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <Reveal className="order-1 md:order-2">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-1/2 h-56 -translate-y-1/2 rounded-full bg-black/30 blur-3xl"
            />
            <PhoneMockup className="relative">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  {active.render()}
                </motion.div>
              </AnimatePresence>
            </PhoneMockup>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}
