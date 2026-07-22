import { useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, Trash2, Clock, Flame, TrendingUp, Check } from 'lucide-react'
import { HabitRules, type Habit } from '@/domain/entities/habit'
import { useHabits } from '@/presentation/hooks/use-habits'
import { Card } from '@/presentation/components/ui/Card'
import { Button } from '@/presentation/components/ui/Button'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'
import { cn } from '@/shared/lib/cn'

const EMOJI_SUGGESTIONS = ['💧', '🧴', '🏋️', '📖', '🧘', '🥗', '☀️', '🌙', '✍️', '🚶', '💊', '💤']

const inputClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50'

export function HabitsPage() {
  const reduce = useReducedMotion()
  const { habits, loading, error, today, doneToday, progress, toggle, create, remove } = useHabits()
  const [emoji, setEmoji] = useState('💧')
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!HabitRules.isValidTitle(title)) {
      setFormError('Dê um nome com pelo menos 2 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      await create({ emoji, title, time: time || null })
      setTitle('')
      setTime('')
      setEmoji('💧')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não consegui salvar o hábito.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
            Hábitos
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            A rotina que constrói a mulher que você decidiu ser.
          </p>
        </div>
        {!loading && habits.length > 0 && (
          <span className="rounded-full bg-brand-950 px-3 py-1 text-sm font-medium text-brand-300">
            {doneToday}/{habits.length} hoje · {progress}%
          </span>
        )}
      </header>

      {/* Novo hábito */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={`Usar emoji ${e}`}
                aria-pressed={emoji === e}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-lg text-xl transition-colors',
                  emoji === e
                    ? 'bg-brand-600 ring-2 ring-brand-400'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                )}
              >
                {e}
              </button>
            ))}
            <input
              value={emoji}
              onChange={(ev) => setEmoji(ev.target.value)}
              maxLength={2}
              aria-label="Emoji personalizado"
              className="h-10 w-14 rounded-lg border border-zinc-200 bg-white text-center text-xl focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="habit-title" className="sr-only">
                Nome do hábito
              </label>
              <input
                id="habit-title"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="Nome do hábito (ex.: Academia)"
                maxLength={HabitRules.maxTitleLength}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="habit-time" className="sr-only">
                Horário
              </label>
              <input
                id="habit-time"
                type="time"
                value={time}
                onChange={(ev) => setTime(ev.target.value)}
                className={cn(inputClass, 'sm:w-36')}
              />
            </div>
            <Button type="submit" disabled={submitting} className="shrink-0">
              <Plus className="h-4 w-4" />
              {submitting ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        </form>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Lista */}
      {loading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sua rotina começa aqui. Adicione o primeiro hábito acima. ✨
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {habits.map((habit, i) => (
            <motion.div
              key={habit.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : i * 0.05 }}
            >
              <HabitCard
                habit={habit}
                today={today}
                onToggle={() => toggle(habit)}
                onRemove={() => remove(habit.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function HabitCard({
  habit,
  today,
  onToggle,
  onRemove,
}: {
  habit: Habit
  today: string
  onToggle: () => void
  onRemove: () => void
}) {
  const done = HabitRules.isDoneOn(habit, today)
  const streak = HabitRules.streak(habit, today)
  const rate = HabitRules.completionRate(habit, today)

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-3xl dark:bg-zinc-800">
          {habit.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {habit.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            {habit.time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {habit.time}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-brand-400" /> {streak} {streak === 1 ? 'dia' : 'dias'}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> {rate}%
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Desmarcar ${habit.title} hoje` : `Marcar ${habit.title} hoje`}
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-colors',
            done
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-zinc-300 text-transparent hover:border-brand-400 hover:text-brand-400 dark:border-zinc-600',
          )}
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      <ProgressBar value={rate} label={`Aderência de ${habit.title}`} className="mt-4" />

      <div className="mt-5 flex-1">
        <HabitCalendar completedDates={habit.completedDates} />
      </div>

      <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${habit.title}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" /> Remover
        </button>
      </div>
    </Card>
  )
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function HabitCalendar({ completedDates }: { completedDates: string[] }) {
  const done = new Set(completedDates)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const todayNum = now.getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = capitalize(now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {monthLabel}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} aria-hidden />
          const key = `${year}-${pad(month + 1)}-${pad(day)}`
          const isDone = done.has(key)
          const isToday = day === todayNum
          const isFuture = day > todayNum
          return (
            <span
              key={key}
              className={cn(
                'grid h-7 place-items-center rounded-md text-xs tabular-nums',
                isDone
                  ? 'bg-brand-500 font-medium text-white'
                  : isFuture
                    ? 'text-zinc-300 dark:text-zinc-700'
                    : 'text-zinc-500 dark:text-zinc-400',
                isToday && !isDone && 'ring-1 ring-inset ring-brand-400',
              )}
            >
              {day}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
