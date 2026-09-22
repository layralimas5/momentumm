import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import {
  MAX_GOAL_LENGTH,
  QUIZ_AREA_LABELS,
  QUIZ_AREAS,
  QUIZ_GOAL_EXAMPLES,
  QUIZ_HORIZON_LABELS,
  QUIZ_HORIZONS,
  QUIZ_OBSTACLE_LABELS,
  QUIZ_OBSTACLES,
  QUIZ_STYLE_LABELS,
  QUIZ_STYLES,
  QUIZ_TIME_LABELS,
  QUIZ_TIMES,
  WEEKDAY_SHORT,
  type QuizAnswers,
} from '@/domain/entities/quiz'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Uma pergunta por tela. Opção é botão grande de tocar com o polegar, e
 * o grupo é um radiogroup de verdade (setas do teclado funcionam). A troca
 * de pergunta desliza pro lado; com `prefers-reduced-motion` só troca.
 */

interface QuizQuestionProps {
  readonly step: number
  readonly answers: QuizAnswers
  /** Pra qual lado a pergunta entrou: 1 avança, -1 volta. */
  readonly direction: 1 | -1
  readonly onChange: (changes: Partial<QuizAnswers>) => void
  readonly onToggleWeekday: (day: number) => void
  readonly onSubmit: () => void
}

export function QuizQuestion({
  step,
  answers,
  direction,
  onChange,
  onToggleWeekday,
  onSubmit,
}: QuizQuestionProps) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        initial={reduced ? false : { opacity: 0, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col"
      >
        {step === 0 ? <GoalQuestion answers={answers} onChange={onChange} onSubmit={onSubmit} /> : null}
        {step === 1 ? <AreaQuestion answers={answers} onChange={onChange} /> : null}
        {step === 2 ? (
          <OptionQuestion
            title="O que mais dificulta sua constância hoje?"
            hint="Escolhe a que mais acontece com você."
            options={QUIZ_OBSTACLES.map((key) => ({ value: key, label: QUIZ_OBSTACLE_LABELS[key] }))}
            value={answers.obstacle}
            onChange={(obstacle) => onChange({ obstacle })}
          />
        ) : null}
        {step === 3 ? (
          <OptionQuestion
            title="Quanto tempo você realmente consegue dedicar por dia?"
            hint="O plano nunca vai pedir mais que isso."
            options={QUIZ_TIMES.map((key) => ({ value: key, label: QUIZ_TIME_LABELS[key] }))}
            value={answers.time}
            onChange={(time) => onChange({ time })}
            columns
          />
        ) : null}
        {step === 4 ? (
          <OptionQuestion
            title="Em quanto tempo você gostaria de alcançar esse objetivo?"
            hint="Pode ser aproximado. Dá pra mudar depois."
            options={QUIZ_HORIZONS.map((key) => ({ value: key, label: QUIZ_HORIZON_LABELS[key] }))}
            value={answers.horizon}
            onChange={(horizon) => onChange({ horizon })}
            columns
          />
        ) : null}
        {step === 5 ? <WeekdaysQuestion answers={answers} onToggle={onToggleWeekday} /> : null}
        {step === 6 ? (
          <OptionQuestion
            title="Como você prefere começar?"
            hint="Isso muda o formato do plano, não o objetivo."
            options={QUIZ_STYLES.map((key) => ({ value: key, label: QUIZ_STYLE_LABELS[key] }))}
            value={answers.style}
            onChange={(style) => onChange({ style })}
          />
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}

function Title({ children, hint }: { readonly children: string; readonly hint: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
        {children}
      </h1>
      <p className="mt-2 text-sm text-pretty text-ink-muted">{hint}</p>
    </header>
  )
}

// ---------------------------------------------------------------------------
// 1. o objetivo, em texto
// ---------------------------------------------------------------------------

function GoalQuestion({
  answers,
  onChange,
  onSubmit,
}: {
  readonly answers: QuizAnswers
  readonly onChange: (changes: Partial<QuizAnswers>) => void
  readonly onSubmit: () => void
}) {
  const id = useId()

  return (
    <div>
      <Title hint="Com as suas palavras. Um exemplo abaixo serve pra começar.">
        O que você mais quer conquistar agora?
      </Title>

      <label htmlFor={id} className="sr-only">
        Seu objetivo
      </label>
      <TextInput
        id={id}
        value={answers.goal}
        onChange={(event) => onChange({ goal: event.target.value.slice(0, MAX_GOAL_LENGTH) })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Ex.: lançar meu projeto"
        autoComplete="off"
        enterKeyHint="next"
        autoFocus
        className="min-h-14 text-base"
      />

      <p className="mt-5 text-xs font-medium tracking-wide text-ink-faint uppercase">Exemplos</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Exemplos de objetivo">
        {QUIZ_GOAL_EXAMPLES.map((example) => {
          const selected = answers.goal.trim() === example
          return (
            <li key={example}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ goal: example })}
                className={cn(
                  'min-h-10 rounded-full border px-3.5 text-sm transition-colors',
                  selected
                    ? 'border-brand bg-brand-dim/60 text-ink'
                    : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink',
                )}
              >
                {example}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. a área, com campo pra "Outra"
// ---------------------------------------------------------------------------

function AreaQuestion({
  answers,
  onChange,
}: {
  readonly answers: QuizAnswers
  readonly onChange: (changes: Partial<QuizAnswers>) => void
}) {
  const id = useId()

  return (
    <div>
      <OptionQuestion
        title="Em qual área da sua vida esse objetivo se encaixa?"
        hint="A área vira um eixo no seu app, com cor própria."
        options={QUIZ_AREAS.map((key) => ({ value: key, label: QUIZ_AREA_LABELS[key] }))}
        value={answers.area}
        onChange={(area) => onChange({ area })}
        columns
      />
      {answers.area === 'outra' ? (
        <div className="mt-4">
          <label htmlFor={id} className="text-sm font-medium text-ink">
            Qual área? <span className="font-normal text-ink-faint">(opcional)</span>
          </label>
          <TextInput
            id={id}
            value={answers.customArea}
            onChange={(event) => onChange({ customArea: event.target.value.slice(0, 24) })}
            placeholder="Ex.: Música"
            autoComplete="off"
            className="mt-1.5 min-h-12"
          />
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// escolha única
// ---------------------------------------------------------------------------

interface Option<T extends string> {
  readonly value: T
  readonly label: string
}

function OptionQuestion<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
  columns = false,
}: {
  readonly title: string
  readonly hint: string
  readonly options: readonly Option<T>[]
  readonly value: T | null
  readonly onChange: (value: T) => void
  /** Duas colunas pra opções curtas (tempo, prazo). */
  readonly columns?: boolean
}) {
  const move = (from: T | null, delta: 1 | -1) => {
    const index = options.findIndex((option) => option.value === from)
    const next = options[(index + delta + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div>
      <Title hint={hint}>{title}</Title>

      <div
        role="radiogroup"
        aria-label={title}
        className={cn('grid gap-2', columns ? 'grid-cols-2' : 'grid-cols-1')}
      >
        {options.map((option, index) => {
          const selected = option.value === value
          const focusable = selected || (value === null && index === 0)
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={focusable ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  move(value, 1)
                } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                  event.preventDefault()
                  move(value, -1)
                }
              }}
              className={cn(
                'flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-medium transition-colors sm:text-base',
                selected
                  ? 'border-brand bg-brand-dim/60 text-ink shadow-[0_0_0_1px_var(--color-brand)]'
                  : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-top',
              )}
            >
              <span className="text-pretty">{option.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                  selected ? 'border-brand bg-brand text-white' : 'border-line-hi',
                )}
              >
                {selected ? <Icon name="check" className="size-3" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. os dias (escolha múltipla)
// ---------------------------------------------------------------------------

function WeekdaysQuestion({
  answers,
  onToggle,
}: {
  readonly answers: QuizAnswers
  readonly onToggle: (day: number) => void
}) {
  return (
    <div>
      <Title hint="Marca quantos quiser. O plano só usa esses dias.">
        Em quais dias você consegue se dedicar?
      </Title>

      <div role="group" aria-label="Dias da semana" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {WEEKDAY_SHORT.map((day) => {
          const selected = answers.weekdays.includes(day.value)
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(day.value)}
              className={cn(
                'min-h-14 rounded-2xl border text-sm font-medium transition-colors',
                selected
                  ? 'border-brand bg-brand-dim/60 text-ink shadow-[0_0_0_1px_var(--color-brand)]'
                  : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-top',
              )}
            >
              {day.label}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-sm text-ink-faint" aria-live="polite">
        {answers.weekdays.length === 0
          ? 'Nenhum dia marcado ainda.'
          : `${answers.weekdays.length} ${answers.weekdays.length === 1 ? 'dia' : 'dias'} por semana.`}
      </p>
    </div>
  )
}
