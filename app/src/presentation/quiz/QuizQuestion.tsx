import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import {
  MAX_GOAL_LENGTH,
  QUIZ_AREA_LABELS,
  QUIZ_AREAS,
  QUIZ_HISTORIES,
  QUIZ_HISTORY_LABELS,
  QUIZ_HORIZON_LABELS,
  QUIZ_HORIZONS,
  QUIZ_OBSTACLE_LABELS,
  QUIZ_OBSTACLES,
  QUIZ_STYLE_LABELS,
  QUIZ_STYLES,
  QUIZ_TIME_LABELS,
  QUIZ_TIMES,
  areasInOrder,
  primaryObstacle,
  quizAreaContext,
  quizScreenAt,
  WEEKDAY_SHORT,
  type QuizAnswers,
  type QuizAreaContext,
  type QuizAreaKey,
  type QuizIntro,
  type QuizObstacleKey,
} from '@/domain/entities/quiz'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Uma tela por vez. Opção é botão grande de tocar com o polegar, e o grupo
 * é um radiogroup de verdade (setas do teclado funcionam). A troca de tela
 * desliza pro lado; com `prefers-reduced-motion` só troca.
 *
 * A ordem das telas mora no domínio (`QUIZ_SCREENS`); aqui só o desenho.
 */

interface QuizQuestionProps {
  readonly step: number
  readonly answers: QuizAnswers
  /** O título da campanha que trouxe a pessoa, em cima da primeira pergunta. */
  readonly intro: QuizIntro
  /** Pra qual lado a pergunta entrou: 1 avança, -1 volta. */
  readonly direction: 1 | -1
  readonly onChange: (changes: Partial<QuizAnswers>) => void
  readonly onToggleArea: (area: QuizAreaKey) => void
  readonly onToggleObstacle: (obstacle: QuizObstacleKey) => void
  readonly onToggleWeekday: (day: number) => void
  readonly onSubmit: () => void
}

export function QuizQuestion({
  step,
  answers,
  intro,
  direction,
  onChange,
  onToggleArea,
  onToggleObstacle,
  onToggleWeekday,
  onSubmit,
}: QuizQuestionProps) {
  const reduced = useReducedMotion()
  const screen = quizScreenAt(step)
  // A primeira área marcada guia a frase de todas as perguntas seguintes.
  const area = quizAreaContext(answers)
  const goal = answers.goal.trim()

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
        {screen === 'area' ? (
          <>
            <Opening intro={intro} />
            <AreaQuestion answers={answers} onChange={onChange} onToggle={onToggleArea} />
          </>
        ) : null}
        {screen === 'goal' ? (
          <GoalQuestion answers={answers} area={area} onChange={onChange} onSubmit={onSubmit} />
        ) : null}
        {screen === 'trust' ? <TrustScreen area={area} /> : null}
        {screen === 'history' ? (
          <OptionQuestion
            title={`Quantas vezes você já começou a ${area.practice} e parou?`}
            hint="Não existe resposta errada. É só pra entender de onde você está partindo."
            options={QUIZ_HISTORIES.map((key) => ({ value: key, label: QUIZ_HISTORY_LABELS[key] }))}
            value={answers.history}
            onChange={(history) => onChange({ history })}
          />
        ) : null}
        {screen === 'recap' ? <RecapScreen answers={answers} /> : null}
        {screen === 'obstacles' ? (
          <MultiQuestion
            title={`O que mais atrapalha ${area.subject} hoje?`}
            hint="Marca todas que acontecem. A primeira que você tocar é a principal."
            options={QUIZ_OBSTACLES.map((key) => ({ value: key, label: QUIZ_OBSTACLE_LABELS[key] }))}
            values={answers.obstacles}
            onToggle={onToggleObstacle}
          />
        ) : null}
        {screen === 'time' ? (
          <OptionQuestion
            title={`Quanto tempo por dia você consegue reservar pra ${area.practice}?`}
            hint="O plano nunca vai pedir mais que isso."
            options={QUIZ_TIMES.map((key) => ({ value: key, label: QUIZ_TIME_LABELS[key] }))}
            value={answers.time}
            onChange={(time) => onChange({ time })}
            columns
          />
        ) : null}
        {screen === 'horizon' ? (
          <OptionQuestion
            title={goal ? `Em quanto tempo você quer chegar em “${goal}”?` : 'Em quanto tempo você gostaria de alcançar esse objetivo?'}
            hint="Pode ser aproximado. Dá pra mudar depois."
            options={QUIZ_HORIZONS.map((key) => ({ value: key, label: QUIZ_HORIZON_LABELS[key] }))}
            value={answers.horizon}
            onChange={(horizon) => onChange({ horizon })}
            columns
          />
        ) : null}
        {screen === 'weekdays' ? (
          <WeekdaysQuestion answers={answers} area={area} onToggle={onToggleWeekday} />
        ) : null}
        {screen === 'style' ? (
          <OptionQuestion
            title="Como você prefere começar?"
            hint={`Isso muda o formato do seu plano de ${area.label.toLowerCase()}, não o objetivo.`}
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
    <header className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl">
        {children}
      </h1>
      <p className="mt-2 text-sm text-pretty text-ink-muted">{hint}</p>
    </header>
  )
}

// ---------------------------------------------------------------------------
// a abertura: a frase da campanha em cima da primeira pergunta
// ---------------------------------------------------------------------------

/**
 * O que era a tela de intro virou o topo da primeira pergunta. Quem chegou
 * de um anúncio reconhece a frase que clicou e já responde, sem um botão de
 * "começar" no meio: o primeiro clique é a primeira resposta.
 */
function Opening({ intro }: { readonly intro: QuizIntro }) {
  return (
    <div className="mb-6 border-b border-line pb-5">
      <p className="text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">{intro.title}</p>
      <p className="mt-2 text-sm text-ink-muted">Grátis, sem cartão e em menos de 2 minutos.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// o objetivo, em texto
// ---------------------------------------------------------------------------

function GoalQuestion({
  answers,
  area,
  onChange,
  onSubmit,
}: {
  readonly answers: QuizAnswers
  readonly area: QuizAreaContext
  readonly onChange: (changes: Partial<QuizAnswers>) => void
  readonly onSubmit: () => void
}) {
  const id = useId()

  return (
    <div>
      <Title hint="Com as suas palavras. Um exemplo abaixo serve pra começar.">
        {area.goalQuestion}
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
        placeholder={area.goalPlaceholder}
        autoComplete="off"
        enterKeyHint="next"
        autoFocus
        className="min-h-12 text-base"
      />

      <p className="mt-5 text-xs font-medium tracking-wide text-ink-faint uppercase">Exemplos</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Exemplos de objetivo">
        {area.goalExamples.map((example) => {
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
// a área, com campo pra "Outra"
// ---------------------------------------------------------------------------

function AreaQuestion({
  answers,
  onChange,
  onToggle,
}: {
  readonly answers: QuizAnswers
  readonly onChange: (changes: Partial<QuizAnswers>) => void
  readonly onToggle: (area: QuizAreaKey) => void
}) {
  const id = useId()

  return (
    <div>
      <MultiQuestion
        title="Em qual área você quer avançar primeiro?"
        hint="Toque em uma ou mais. A primeira vira o seu plano; as outras viram eixos no app."
        options={QUIZ_AREAS.map((key) => ({ value: key, label: QUIZ_AREA_LABELS[key] }))}
        values={answers.areas}
        onToggle={onToggle}
      />
      {answers.areas.includes('outra') ? (
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
// escolha múltipla (chips)
// ---------------------------------------------------------------------------

interface Option<T extends string> {
  readonly value: T
  readonly label: string
}

/**
 * Chips que quebram linha: cada opção ocupa só a largura do próprio texto,
 * então "Desenvolvimento pessoal" não espreme o ícone nem vaza da coluna.
 * A ordem do toque vira a ordem de importância, e o número no chip diz isso.
 */
function MultiQuestion<T extends string>({
  title,
  hint,
  options,
  values,
  onToggle,
}: {
  readonly title: string
  readonly hint: string
  readonly options: readonly Option<T>[]
  readonly values: readonly T[]
  readonly onToggle: (value: T) => void
}) {
  return (
    <div>
      <Title hint={hint}>{title}</Title>

      <div role="group" aria-label={title} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const position = values.indexOf(option.value)
          const selected = position >= 0
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(option.value)}
              className={cn(
                'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3.5 text-left text-sm font-medium transition-colors',
                selected
                  ? 'border-brand bg-brand-dim/60 text-ink shadow-[0_0_0_1px_var(--color-brand)]'
                  : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-top',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
                  selected ? 'border-brand bg-brand text-white' : 'border-line-hi',
                )}
              >
                {selected ? position + 1 : null}
              </span>
              <span className="min-w-0 text-pretty">{option.label}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-ink-faint" aria-live="polite">
        {values.length === 0
          ? 'Nada marcado ainda.'
          : values.length === 1
            ? '1 marcada.'
            : `${values.length} marcadas, nessa ordem.`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// escolha única
// ---------------------------------------------------------------------------

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
                'flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 text-left text-sm font-medium transition-colors',
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
// confiança: como o plano é feito
// ---------------------------------------------------------------------------

/**
 * A pausa no meio das perguntas, antes das mais pesadas. A estrutura pede
 * prova aqui; enquanto não houver número real de usuários nem depoimento,
 * a prova é o MECANISMO: três regras que o gerador cumpre de verdade
 * (`buildQuizPlan`, versão mínima, Modo Retomada). Nada de contador
 * inventado. Quando houver número real, ele entra em cima dessas regras.
 */
interface PlanRule {
  readonly icon: IconName
  readonly title: string
  readonly text: string
}

function planRules(area: QuizAreaContext): readonly PlanRule[] {
  return [
    {
      icon: 'relogio',
      title: 'Do tamanho do seu tempo',
      text: `O plano nunca pede mais minutos pra ${area.practice} do que você disser que tem. Se não couber, ele se ajusta e te avisa.`,
    },
    {
      icon: 'minimo',
      title: 'Versão mínima em todo passo',
      text: `No dia apertado, o passo encolhe (algo como ${area.minimalExample}) e o dia ainda conta.`,
    },
    {
      icon: 'desfazer',
      title: 'Nada zera',
      text: 'Se você sumir uns dias, volta de onde parou, sem compensar o que passou.',
    },
  ]
}

function TrustScreen({ area }: { readonly area: QuizAreaContext }) {
  const rules = planRules(area)
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">Antes de continuar</p>
      <Title hint="Plano feito pro dia perfeito não sobrevive à segunda semana. O seu segue três regras:">
        Como o seu plano é montado
      </Title>
      <ul className="flex flex-col gap-2.5">
        {rules.map((rule) => (
          <li key={rule.title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand-dim/50 text-brand-ink">
              <Icon name={rule.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{rule.title}</p>
              <p className="mt-0.5 text-sm text-pretty text-ink-muted">{rule.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// devolutiva: o que ela já respondeu, antes da última pergunta
// ---------------------------------------------------------------------------

/**
 * Devolve as respostas com as palavras dela: a pessoa vê que o quiz prestou
 * atenção e chega na última pergunta sabendo que o plano é dela.
 */
function RecapScreen({ answers }: { readonly answers: QuizAnswers }) {
  const days = answers.weekdays.length
  const time = answers.time ? QUIZ_TIME_LABELS[answers.time].toLowerCase() : null
  const rows = [
    { label: answers.areas.length > 1 ? 'Suas áreas, nessa ordem' : 'Sua área', value: areasInOrder(answers) },
    { label: 'Seu objetivo', value: answers.goal.trim() },
    { label: 'O que mais trava', value: QUIZ_OBSTACLE_LABELS[primaryObstacle(answers)] },
    {
      label: 'Tempo disponível',
      value: time ? `${time} por dia, ${days} ${days === 1 ? 'dia' : 'dias'} por semana` : '',
    },
  ]

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-brand-ink uppercase">O que já sabemos</p>
      <Title hint="Com o que você respondeu até aqui, o seu plano já tem forma.">
        Dá pra montar algo que cabe no seu dia
      </Title>
      <dl className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface/60">
        {rows.map((row) => (
          <div key={row.label} className="px-3.5 py-3">
            <dt className="text-xs text-ink-faint">{row.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-pretty text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-ink-muted">Falta uma pergunta pra montar o seu plano.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// os dias (escolha múltipla)
// ---------------------------------------------------------------------------

function WeekdaysQuestion({
  answers,
  area,
  onToggle,
}: {
  readonly answers: QuizAnswers
  readonly area: QuizAreaContext
  readonly onToggle: (day: number) => void
}) {
  return (
    <div>
      <Title hint="Marca quantos quiser. O plano só usa esses dias.">
        {`Em quais dias você consegue ${area.practice}?`}
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
                'min-h-12 rounded-xl border text-sm font-medium transition-colors',
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
