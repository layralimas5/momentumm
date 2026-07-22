import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  ArrowRight,
  Quote,
  Sunrise,
  Sun,
  Moon,
  PenLine,
  Sparkles,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { GoalRules } from '@/domain/entities/goal'
import { READING_STATUS_LABEL } from '@/domain/entities/book'
import { HabitRules, type Habit } from '@/domain/entities/habit'
import { dailyMission } from '@/domain/entities/mission'
import { identityReminder } from '@/domain/entities/identity'
import { useGoals } from '@/presentation/hooks/use-goals'
import { useBooks } from '@/presentation/hooks/use-books'
import { useHabits } from '@/presentation/hooks/use-habits'
import { useIdentity } from '@/presentation/hooks/use-identity'
import { useAuth } from '@/presentation/auth/use-auth'
import { Card } from '@/presentation/components/ui/Card'
import { Badge } from '@/presentation/components/ui/Badge'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'
import { Button } from '@/presentation/components/ui/Button'
import { cn } from '@/shared/lib/cn'

const PHRASES = [
  'A realização de nossos sonhos depende exclusivamente de nós.',
  'Um passo por dia ainda é movimento. Simbora.',
  'Você não precisa ser perfeita, só constante.',
  'A mulher que você quer ser começa nas escolhas de hoje.',
]

/** Saudação conforme a hora do dia. */
function greetingFor(date: Date): { text: string; icon: LucideIcon } {
  const hour = date.getHours()
  if (hour < 12) return { text: 'Bom dia', icon: Sunrise }
  if (hour < 18) return { text: 'Boa tarde', icon: Sun }
  return { text: 'Boa noite', icon: Moon }
}

/** Extrai um primeiro nome apresentável do e-mail; null quando genérico. */
function firstNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const local = email.split('@')[0] ?? ''
  const cleaned = local.replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim()
  const first = cleaned.split(' ')[0] ?? ''
  if (!first || /^(voce|you|demo|user|admin|contato|hello|oi)$/i.test(first)) return null
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function DashboardPage() {
  const reduce = useReducedMotion()
  const { user } = useAuth()
  const { goals, loading: loadingGoals } = useGoals()
  const { books, loading: loadingBooks } = useBooks()
  const { habits, loading: loadingHabits, doneToday, progress, toggle } = useHabits()
  const { identity, loading: loadingIdentity } = useIdentity()
  const [missionDone, setMissionDone] = useState(false)

  // Primeira vez: sem identidade definida, a jornada começa pelo onboarding.
  if (!loadingIdentity && !identity) {
    return <Navigate to="/app/identidade" replace />
  }

  const activeGoals = goals.filter((g) => !GoalRules.isComplete(g))
  const reading = books.find((b) => b.status === 'reading') ?? null

  const now = new Date()
  const greeting = greetingFor(now)
  const name = firstNameFromEmail(user?.email)
  const formattedDate = capitalize(dateFormatter.format(now))
  const phrase = PHRASES[now.getDate() % PHRASES.length] ?? PHRASES[0]
  const mission = dailyMission(now)

  const routineLine =
    habits.length === 0
      ? 'Vamos montar a sua rotina de hoje?'
      : `Hoje você está a ${progress}% da sua rotina.`

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay },
        }

  return (
    <div className="space-y-8">
      {/* 1. Saudação personalizada */}
      <motion.header {...rise(0)}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{formattedDate}</p>
        <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          <greeting.icon className="h-6 w-6 shrink-0 text-brand-400" aria-hidden />
          <span>
            {greeting.text}
            {name ? `, ${name}` : ''}
          </span>
        </h1>
        <p className="mt-1 text-pretty text-zinc-600 dark:text-zinc-400">{routineLine}</p>
      </motion.header>

      {/* Lembrete de identidade futura — a alma do Aura */}
      {identity && (
        <motion.section {...rise(0.03)} aria-label="Identidade futura">
          <Link
            to="/app/identidade"
            className="group flex items-center gap-3 rounded-2xl border border-brand-900/70 bg-brand-950/30 p-4 transition-colors hover:border-brand-800 hover:bg-brand-950/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-brand-300">
                Identidade futura
              </p>
              <p className="mt-0.5 text-pretty text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {identityReminder(identity, now)}
              </p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.section>
      )}

      {/* 2. Frase do dia */}
      <motion.section {...rise(0.06)} aria-label="Frase do dia">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-blush-500 p-6 text-white sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-3xl"
          />
          <Quote className="h-6 w-6 text-white/70" aria-hidden />
          <p className="mt-3 max-w-2xl text-pretty text-lg font-medium leading-snug sm:text-xl">
            {phrase}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-white/70">
            Frase do dia
          </p>
        </div>
      </motion.section>

      {/* 3 + 4. Progresso geral + Hábitos de hoje */}
      <motion.section {...rise(0.12)} aria-label="Sua rotina de hoje">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Progresso geral */}
            <div className="flex items-center gap-4 sm:flex-col sm:gap-2 sm:border-r sm:border-zinc-200 sm:pr-6 dark:sm:border-zinc-800">
              <ProgressRing value={progress} />
              <div className="sm:text-center">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Rotina de hoje</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {doneToday} de {habits.length} hábitos
                </p>
              </div>
            </div>

            {/* Hábitos de hoje */}
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Hábitos de hoje
                </h2>
                <Link
                  to="/app/habitos"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-400"
                >
                  Ver hábitos <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {loadingHabits ? (
                <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              ) : habits.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhum hábito ainda. Sua rotina começa com o primeiro. ✨
                </p>
              ) : (
                <ul className="grid gap-2">
                  {habits.map((habit) => (
                    <li key={habit.id}>
                      <HabitRow habit={habit} today={HabitRules.dayKey()} onToggle={() => toggle(habit)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </motion.section>

      {/* 5. Missão diária */}
      <motion.section {...rise(0.18)} aria-label="Missão do dia">
        <Card className="border-brand-900/70 bg-gradient-to-br from-brand-950/50 to-transparent p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-brand-300">
                  Missão do dia
                </p>
                <p className="mt-1 text-pretty font-medium text-zinc-900 dark:text-zinc-50">
                  {mission}
                </p>
              </div>
            </div>
            <Button
              variant={missionDone ? 'secondary' : 'primary'}
              onClick={() => setMissionDone((v) => !v)}
              aria-pressed={missionDone}
              className="shrink-0"
            >
              {missionDone ? (
                <>
                  <Check className="h-4 w-4" /> Missão concluída
                </>
              ) : (
                'Concluir missão'
              )}
            </Button>
          </div>
        </Card>
      </motion.section>

      {/* 6. Escrever no diário */}
      <motion.section {...rise(0.24)}>
        <Link
          to="/app/diario"
          className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300">
            <PenLine className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">Escrever no diário</p>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              Registre como você está se sentindo hoje.
            </p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.section>

      {/* Apoio: metas em andamento */}
      <motion.section {...rise(0.3)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Metas em andamento
          </h2>
          <Link
            to="/app/metas"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingGoals ? (
          <SkeletonList />
        ) : activeGoals.length === 0 ? (
          <EmptyState
            text="Nenhuma meta ativa ainda. Que passo você quer dar primeiro?"
            to="/app/metas"
            cta="Criar meta"
          />
        ) : (
          <div className="grid gap-4">
            {activeGoals.slice(0, 3).map((goal) => (
              <Card key={goal.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge tone="brand">{goal.progress}%</Badge>
                </div>
                <ProgressBar
                  value={goal.progress}
                  label={`Progresso de ${goal.title}`}
                  className="mt-4"
                />
              </Card>
            ))}
          </div>
        )}
      </motion.section>

      {/* Apoio: leitura atual */}
      <motion.section {...rise(0.36)}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Leitura atual</h2>
          <Link
            to="/app/leituras"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
          >
            Ver estante <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingBooks ? (
          <SkeletonList rows={1} />
        ) : reading ? (
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-blush-400 text-white">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {reading.title}
                </h3>
                <Badge tone="success">{READING_STATUS_LABEL[reading.status]}</Badge>
              </div>
              {reading.author && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{reading.author}</p>
              )}
              <ProgressBar
                value={reading.progress}
                label={`Progresso de ${reading.title}`}
                className="mt-3"
              />
            </div>
          </Card>
        ) : (
          <EmptyState
            text="Nenhuma leitura em andamento. Qual livro vai te acompanhar agora?"
            to="/app/leituras"
            cta="Adicionar livro"
          />
        )}
      </motion.section>
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function HabitRow({
  habit,
  today,
  onToggle,
}: {
  habit: Habit
  today: string
  onToggle: () => void
}) {
  const done = HabitRules.isDoneOn(habit, today)
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2.5 text-left transition-colors hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-800"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
        {habit.emoji}
      </span>
      <span
        className={cn(
          'flex-1 text-sm font-medium',
          done
            ? 'text-zinc-400 line-through dark:text-zinc-500'
            : 'text-zinc-900 dark:text-zinc-50',
        )}
      >
        {habit.title}
      </span>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          done ? 'border-brand-500 bg-brand-500 text-white' : 'border-zinc-300 dark:border-zinc-600',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}

function ProgressRing({ value, size = 92, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (clamped / 100) * circumference
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#ring-gradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-brand-500)" />
            <stop offset="1" stopColor="var(--color-blush-400)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {clamped}%
      </span>
    </div>
  )
}

function EmptyState({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed py-10 text-center">
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  )
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  )
}
