import { motion } from 'framer-motion'
import {
  ACTIVATION_PLAN_STEP,
  ACTIVATION_STEPS,
  areaLabelOf,
  selectedAreas,
  type ActivationController,
} from '@/presentation/planner/use-activation'
import {
  ACTIVATION_CTA,
  formatDuration,
  HORIZON_PRESETS,
  lifeArea,
  LIFE_AREAS,
  type BudgetMode,
  type LifeAreaKey,
} from '@/domain/entities/activation'
import { addDays, parseDayKey, type DayKey } from '@/domain/entities/day'
import { MAX_OBJECTIVE_DAYS, MIN_OBJECTIVE_DAYS } from '@/domain/entities/objective'
import { MAX_MINUTES_PER_DAY } from '@/domain/entities/plan-builder'
import { Button } from '@/presentation/components/ui/Button'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { ActivationPlanView } from './ActivationPlanView'

/**
 * O primeiro acesso, orientado a ativação.
 *
 * Quatro perguntas curtas e um plano. A ordem não é negociável: área da vida,
 * objetivo em palavras, prazo, tempo real. O tempo vem por último de propósito
 * — perguntado antes, ele vira uma promessa abstrata; perguntado depois do
 * objetivo, ele vira o filtro de realidade que decide o tamanho do plano.
 *
 * Dá pra sair no meio. "Deixar pra depois" guarda tudo e o dashboard oferece
 * retomar — um onboarding que prende a pessoa na primeira tela é um onboarding
 * que ela abandona antes de ver o produto.
 *
 * Uma coluna só, do celular ao monitor grande: o formulário tem um foco por
 * vez, e duas colunas só dariam à pessoa a chance de responder fora de ordem.
 */

interface ActivationProps {
  readonly firstName: string | null
  readonly today: DayKey
  readonly control: ActivationController
}

/**
 * O ícone de cada área da vida.
 *
 * Vive aqui e não no domínio porque o domínio não conhece SVG — ele carrega a
 * chave, a apresentação resolve o desenho. Laranja não aparece em nenhum: essa
 * cor é da sequência, e só dela.
 */
const AREA_ICONS: Readonly<Record<LifeAreaKey, IconName>> = {
  saude: 'raio',
  carreira: 'subir',
  estudos: 'insights',
  projeto: 'objetivo',
  financas: 'progresso',
  pessoal: 'jornada',
  outro: 'mais',
}

const DAY_MINUTES = [15, 30, 45, 60, 90] as const
const WEEK_MINUTES = [60, 120, 180, 300, 420] as const

/** Segunda primeiro: é como as pessoas montam a semana. */
const WEEKDAY_ORDER: readonly { readonly value: number; readonly label: string }[] = [
  { value: 1, label: 'S' },
  { value: 2, label: 'T' },
  { value: 3, label: 'Q' },
  { value: 4, label: 'Q' },
  { value: 5, label: 'S' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
]

export function Activation({ firstName, today, control }: ActivationProps) {
  const { step, plan } = control

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4 sm:py-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl">
          {firstName ? `Que bom te ver, ${firstName}.` : 'Que bom te ver por aqui.'} Vamos tirar isso da
          intenção.
        </h2>
        <p className="mt-2 text-pretty text-ink-muted">
          Quatro perguntas. No fim você sai com um plano, os marcos dele e o primeiro passo pra
          hoje.
        </p>
      </header>

      <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Etapas do onboarding">
        {ACTIVATION_STEPS.map((label, index) => (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index <= step ? 'bg-brand' : 'bg-surface-top',
              )}
            />
            <span
              className={cn(
                'hidden text-xs whitespace-nowrap sm:inline',
                index === step ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {label}
            </span>
          </li>
        ))}
        <li className="text-xs whitespace-nowrap text-ink-faint sm:hidden">
          {step + 1}/{ACTIVATION_STEPS.length}
        </li>
      </ol>

      <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Panel tone="brand">
          {step === 0 ? <AreaStep control={control} /> : null}
          {step === 1 ? <GoalStep control={control} /> : null}
          {step === 2 ? <HorizonStep control={control} today={today} /> : null}
          {step === 3 ? <BudgetStep control={control} /> : null}

          {step === ACTIVATION_PLAN_STEP && plan ? (
            <Step
              title="Seu plano"
              hint="Montado com as tuas respostas. Dá pra mudar tudo depois, sem perder nada."
            >
              <div className="mt-4">
                <ActivationPlanView
                  plan={plan}
                  today={today}
                  saving={control.saving}
                  error={control.error}
                  onApplyRemedy={control.applyRemedy}
                  onReview={() => control.goTo(2)}
                  /*
                    Gravou, acabou: `applyPlan` escreve no estado único e a
                    conta deixa de ser nova, então o dashboard toma a tela
                    sozinho. Um callback aqui seria uma segunda fonte de
                    verdade sobre "o onboarding terminou".
                  */
                  onSave={() => void control.save()}
                />
              </div>
            </Step>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="min-h-12"
              onClick={control.back}
              disabled={step === 0}
            >
              <Icon name="setaEsq" className="size-4" />
              Voltar
            </Button>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" className="min-h-12" onClick={control.skip}>
                Deixar pra depois
              </Button>

              {step < ACTIVATION_PLAN_STEP ? (
                <Button
                  size="lg"
                  className="min-h-12"
                  onClick={control.next}
                  disabled={!control.canAdvance}
                >
                  Continuar
                  <Icon name="seta" className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div aria-live="polite" className="min-h-5">
            {control.blocker && step < ACTIVATION_PLAN_STEP ? (
              <p className="mt-1 text-sm text-ink-faint">{control.blocker}</p>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-ink-faint">
            Nada é salvo até você tocar em “{ACTIVATION_CTA}”. Se sair antes, o app guarda as
            respostas e retoma daqui.
          </p>
        </Panel>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. o que você quer mudar
// ---------------------------------------------------------------------------

function AreaStep({ control }: { readonly control: ActivationController }) {
  const { draft, set, toggleArea } = control
  const selected = selectedAreas(draft)
  const primary = selected[0] ?? null

  return (
    <Step
      title="O que você quer mudar?"
      hint="Marca quantas quiser. A primeira vira o plano de hoje; as outras já ficam criadas como eixo, com histórico e gráfico, pra você adicionar objetivos depois."
    >
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {LIFE_AREAS.map((area) => {
          const isSelected = selected.includes(area.key)
          const isPrimary = primary === area.key
          return (
            <button
              key={area.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleArea(area.key)}
              className={cn(
                'flex min-h-16 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                isSelected
                  ? 'border-brand bg-brand-dim/50 shadow-[0_0_0_1px_var(--color-brand)]'
                  : 'border-line bg-surface-hi/50 hover:border-line-hi hover:bg-surface active:bg-surface-top',
              )}
            >
              <Icon
                name={AREA_ICONS[area.key]}
                className={cn('mt-0.5 size-5 shrink-0', isSelected ? 'text-brand-ink' : 'text-ink-faint')}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  {area.label}
                  {isPrimary && selected.length > 1 ? (
                    <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink">
                      Plano de hoje
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">{area.hint}</span>
              </span>
              {isSelected ? (
                <Icon name="check" className="size-4 shrink-0 text-brand-ink" strokeWidth={2.5} />
              ) : null}
            </button>
          )
        })}
      </div>

      {selected.includes('outro') ? (
        <div className="mt-3">
          <label htmlFor="area-livre" className="text-sm font-medium text-ink">
            Qual é a área?
          </label>
          <TextInput
            id="area-livre"
            className="mt-1.5"
            value={draft.customArea}
            maxLength={24}
            placeholder="Escrita, terapia, violão…"
            onChange={(event) => set({ customArea: event.target.value })}
          />
        </div>
      ) : null}
    </Step>
  )
}

// ---------------------------------------------------------------------------
// 2. o que você quer alcançar
// ---------------------------------------------------------------------------

function GoalStep({ control }: { readonly control: ActivationController }) {
  const { draft, set } = control
  const area = draft.area ? lifeArea(draft.area) : null

  return (
    <Step
      title="O que você quer alcançar?"
      hint="Escreve como você contaria pra alguém. Se tiver um número na cabeça, coloca ele — o plano usa."
    >
      <div className="mt-4">
        <label htmlFor="objetivo-livre" className="sr-only">
          O que você quer alcançar
        </label>
        <textarea
          id="objetivo-livre"
          rows={3}
          maxLength={80}
          value={draft.goal}
          onChange={(event) => set({ goal: event.target.value })}
          placeholder={area?.example ?? 'O que você quer alcançar'}
          className="w-full resize-none rounded-xl border border-line bg-surface-hi px-3.5 py-3 text-base text-ink transition-colors placeholder:text-ink-faint focus:border-brand"
        />

        <p className="mt-2 text-xs text-ink-faint">
          {areaLabelOf(draft)} · {draft.goal.trim().length}/80 caracteres. Exemplos que viram plano
          melhor: “Estudar 40 horas do curso”, “Ler 20 páginas por dia”.
        </p>
      </div>
    </Step>
  )
}

// ---------------------------------------------------------------------------
// 3. quando
// ---------------------------------------------------------------------------

function HorizonStep({
  control,
  today,
}: {
  readonly control: ActivationController
  readonly today: DayKey
}) {
  const { draft, set } = control
  const horizon = draft.horizon

  return (
    <Step
      title="Quando gostaria de alcançar isso?"
      hint="Prazo é o que separa objetivo de desejo. Se ainda não sabe, tudo bem: o app assume três meses e diz isso."
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {HORIZON_PRESETS.map((preset) => {
            const selected = horizon.kind === 'preset' && horizon.days === preset.days
            return (
              <Choice
                key={preset.key}
                selected={selected}
                onClick={() => set({ horizon: { kind: 'preset', days: preset.days } })}
              >
                {preset.label}
              </Choice>
            )
          })}

          <Choice
            selected={horizon.kind === 'flexivel'}
            onClick={() => set({ horizon: { kind: 'flexivel' } })}
          >
            Ainda não sei
          </Choice>

          <Choice
            selected={horizon.kind === 'data'}
            onClick={() =>
              set({ horizon: { kind: 'data', date: addDays(today, 59) } })
            }
          >
            Data definida
          </Choice>
        </div>

        {horizon.kind === 'data' ? (
          <div>
            <label htmlFor="prazo-data" className="text-sm font-medium text-ink">
              Escolhe o dia
            </label>
            <TextInput
              id="prazo-data"
              type="date"
              className="mt-1.5"
              value={horizon.date}
              min={addDays(today, MIN_OBJECTIVE_DAYS - 1)}
              max={addDays(today, MAX_OBJECTIVE_DAYS - 1)}
              onChange={(event) => {
                const value = event.target.value
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
                set({ horizon: { kind: 'data', date: parseDayKey(value) } })
              }}
            />
          </div>
        ) : null}
      </div>
    </Step>
  )
}

// ---------------------------------------------------------------------------
// 4. quanto tempo, de verdade
// ---------------------------------------------------------------------------

function BudgetStep({ control }: { readonly control: ActivationController }) {
  const { draft, set } = control
  const { budget } = draft
  const presets = budget.mode === 'dia' ? DAY_MINUTES : WEEK_MINUTES

  const setMode = (mode: BudgetMode) => {
    if (mode === budget.mode) return
    const days = Math.max(1, budget.weekdays.length)
    // Converte em vez de zerar: a pessoa já respondeu, só mudou a régua.
    const minutes =
      mode === 'semana' ? budget.minutes * days : Math.max(5, Math.round(budget.minutes / days))
    set({ budget: { ...budget, mode, minutes } })
  }

  const toggleDay = (day: number) => {
    const has = budget.weekdays.includes(day)
    const weekdays = has
      ? budget.weekdays.filter((value) => value !== day)
      : [...budget.weekdays, day].sort((a, b) => a - b)
    set({ budget: { ...budget, weekdays } })
  }

  const perDay =
    budget.mode === 'dia'
      ? budget.minutes
      : Math.round(budget.minutes / Math.max(1, budget.weekdays.length))

  return (
    <Step
      title="Quanto tempo consegue dedicar realisticamente?"
      hint="O tempo de uma semana ruim, não o da semana perfeita. Nenhuma sessão do plano vai passar disso."
    >
      <div className="mt-4 flex flex-col gap-5">
        <div>
          <div className="flex gap-2" role="group" aria-label="Como contar o tempo">
            <Choice selected={budget.mode === 'dia'} onClick={() => setMode('dia')}>
              Por dia
            </Choice>
            <Choice selected={budget.mode === 'semana'} onClick={() => setMode('semana')}>
              Por semana
            </Choice>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((value) => (
              <Choice
                key={value}
                selected={budget.minutes === value}
                onClick={() => set({ budget: { ...budget, minutes: value } })}
              >
                {formatDuration(value)}
              </Choice>
            ))}

            <div className="flex items-center gap-2">
              <label htmlFor="tempo-livre" className="sr-only">
                Outro tempo, em minutos
              </label>
              <TextInput
                id="tempo-livre"
                type="number"
                inputMode="numeric"
                min={5}
                max={MAX_MINUTES_PER_DAY * 7}
                className="w-24"
                placeholder="min"
                value={(presets as readonly number[]).includes(budget.minutes) ? '' : String(budget.minutes)}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isFinite(value) && value > 0) {
                    set({ budget: { ...budget, minutes: value } })
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Dias disponíveis</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana disponíveis">
            {WEEKDAY_ORDER.map((day, index) => {
              const selected = budget.weekdays.includes(day.value)
              return (
                <button
                  key={`${day.value}-${index}`}
                  type="button"
                  aria-pressed={selected}
                  aria-label={WEEKDAY_NAMES[day.value] ?? ''}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'size-11 rounded-xl border text-sm font-medium transition-colors',
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
        </div>

        <p role="status" className="rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-sm text-ink-muted">
          {budget.weekdays.length === 0 ? (
            'Marca os dias em que você consegue aparecer.'
          ) : (
            <>
              {budget.weekdays.length} {budget.weekdays.length === 1 ? 'dia' : 'dias'} por semana ·{' '}
              <strong className="font-semibold text-ink">{formatDuration(perDay)} por dia</strong> ·{' '}
              {formatDuration(perDay * budget.weekdays.length)} por semana
            </>
          )}
        </p>
      </div>
    </Step>
  )
}

const WEEKDAY_NAMES: Readonly<Record<number, string>> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

// ---------------------------------------------------------------------------
// blocos
// ---------------------------------------------------------------------------

function Choice({
  selected,
  onClick,
  children,
}: {
  readonly selected: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-xl border px-3.5 text-sm font-medium transition-colors',
        selected
          ? 'border-brand bg-brand-dim/60 text-ink shadow-[0_0_0_1px_var(--color-brand)]'
          : 'border-line bg-surface-hi/60 text-ink-muted hover:border-line-hi hover:text-ink active:bg-surface-top',
      )}
    >
      {children}
    </button>
  )
}

function Step({
  title,
  hint,
  children,
}: {
  readonly title: string
  readonly hint: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-balance text-ink">{title}</h3>
      <p className="mt-1 text-sm text-pretty text-ink-muted">{hint}</p>
      {children}
    </div>
  )
}
