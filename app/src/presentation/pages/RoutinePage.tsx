import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addDays, dayKeyToDate, formatDayLong, startOfWeek, type DayKey } from '@/domain/entities/day'
import {
  isRoutineDone,
  isRoutineResolved,
  routineDayStates,
  ROUTINE_RECURRENCE_LABELS,
  type RoutineDayState,
  type RoutineItem,
} from '@/domain/entities/routine-item'
import { Button } from '@/presentation/components/ui/Button'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { IconButton, Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { RoutineItemDialog } from '@/presentation/routine/RoutineItemDialog'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * Rotina: como os seus dias normalmente funcionam.
 *
 * A separação que sustenta a tela inteira:
 *
 *   HOJE    responde "o que eu preciso fazer agora". É execução, e mistura
 *           ação, hábito e rotina porque é assim que o dia é vivido.
 *   ROTINA  responde "como eu organizei meus dias". É desenho, e é aqui que se
 *           cria, edita, pausa e apaga.
 *
 * Por isso esta tela mostra SÓ os itens de rotina, e não a agenda inteira: se
 * ela repetisse o Hoje, seriam duas telas com a mesma lista e nenhuma das duas
 * com um papel claro. O que ela compartilha com o Hoje é o ESTADO: marcar aqui
 * marca lá, porque é a mesma ocorrência, não uma cópia.
 *
 * A visão semanal existe pra uma pergunta que o dia não responde: "como está a
 * minha semana?". Ela não é um calendário: são sete dias, um toque abre o dia.
 */
export function RoutinePage() {
  const planner = usePlanner()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [picked, setPicked] = useState<DayKey>(planner.today)
  const [view, setView] = useState<'dia' | 'semana' | 'todos'>('dia')
  const [editing, setEditing] = useState<RoutineItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [removing, setRemoving] = useState<RoutineItem | null>(null)

  /*
    O "+" da barra de baixo abre esta tela já com o formulário aberto
    (`/app/rotina?novo=1`). O parâmetro é consumido na hora: sem isso, voltar
    pra cá pelo histórico do navegador reabriria o diálogo do nada.
  */
  useEffect(() => {
    if (params.get('novo') === '1') {
      setEditing(null)
      setDialogOpen(true)
      setParams({}, { replace: true })
      return
    }

    // "Editar" no menu de uma linha do Hoje: a tela abre já no item certo.
    const alvo = params.get('editar')
    if (!alvo) return
    const item = planner.routineItems.find((entry) => entry.id === alvo)
    if (item) {
      setEditing(item)
      setDialogOpen(true)
    }
    setParams({}, { replace: true })
  }, [params, setParams, planner.routineItems])

  const week = useMemo(() => {
    const first = startOfWeek(planner.today)
    return Array.from({ length: 7 }, (_, index) => addDays(first, index))
  }, [planner.today])

  const states = useMemo(
    () => routineDayStates(planner.routineItems, planner.routineOccurrences, picked),
    [planner.routineItems, planner.routineOccurrences, picked],
  )

  const done = states.filter((state) => isRoutineDone(state.status)).length
  const vazia = planner.routineItems.length === 0

  const abrirNovo = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rotina"
        description="Como os seus dias normalmente funcionam. O que estiver programado pra hoje aparece sozinho na tela Hoje."
        action={
          <Button onClick={abrirNovo}>
            <Icon name="mais" className="size-4" />
            Adicionar
          </Button>
        }
      />

      {vazia ? (
        <EmptyState
          title="Vamos organizar seu dia?"
          description="Adiciona as coisas que fazem parte da sua rotina e o Momentumm mostra o que importa a cada dia, sem você precisar procurar."
          action={
            <Button onClick={abrirNovo}>
              <Icon name="mais" className="size-4" />
              Criar minha rotina
            </Button>
          }
        />
      ) : (
        <>
          {/* Duas visões, um seletor. "Semana" é leitura; "dia" é onde se mexe. */}
          <div role="tablist" aria-label="Visão da rotina" className="flex gap-1.5">
            {(['dia', 'semana', 'todos'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={cn(
                  'min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors',
                  view === option
                    ? 'border-brand bg-brand-dim/70 text-brand-ink'
                    : 'border-line text-ink-muted active:bg-surface-hi',
                )}
              >
                {TAB_LABELS[option]}
              </button>
            ))}
          </div>

          {view === 'semana' ? (
            <WeekStrip
              week={week}
              today={planner.today}
              picked={picked}
              onPick={(day) => {
                setPicked(day)
                setView('dia')
              }}
              countOf={(day) =>
                routineDayStates(planner.routineItems, planner.routineOccurrences, day).length
              }
            />
          ) : null}

          {view === 'dia' ? (
            <Panel tone="raised" aria-labelledby="rotina-dia">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="rotina-dia" className="text-lg font-semibold tracking-tight text-ink">
                    {picked === planner.today ? 'Hoje' : nomeDoDia(picked)}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {formatDayLong(picked, planner.today)}
                  </p>
                </div>

                {states.length > 0 ? (
                  <div className="w-full sm:w-40">
                    <div className="flex items-baseline justify-between gap-2 text-xs text-ink-faint">
                      <span>Concluído</span>
                      <span className="tabular text-ink-muted">
                        {done} de {states.length}
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      value={states.length === 0 ? 0 : done / states.length}
                      label={`Rotina do dia: ${done} de ${states.length}`}
                    />
                  </div>
                ) : null}
              </div>

              {states.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-line-hi px-4 py-6 text-center text-sm text-ink-muted">
                  Nada na rotina desse dia. Descanso também é organização.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col">
                  {states.map((state) => (
                    <RoutineRow
                      key={state.item.id}
                      state={state}
                      day={picked}
                      editable={picked >= planner.today}
                      onEdit={() => {
                        setEditing(state.item)
                        setDialogOpen(true)
                      }}
                      onRemove={() => setRemoving(state.item)}
                    />
                  ))}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Button size="sm" variant="secondary" onClick={abrirNovo}>
                  <Icon name="mais" className="size-4" />
                  Adicionar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate('/app')}>
                  Ver o dia inteiro
                  <Icon name="seta" className="size-3.5" />
                </Button>
              </div>
            </Panel>
          ) : null}
        </>
      )}

      {/* Com a rotina vazia o convite já ocupa a tela: "0 itens" embaixo dele
          seria a mesma notícia duas vezes, e a segunda em tom de relatório. */}
      {!vazia && view === 'todos' ? (
        <Panel tone="raised" aria-labelledby="rotina-todos">
          <h2 id="rotina-todos" className="text-lg font-semibold tracking-tight text-ink">
            Tudo que está na sua rotina
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {planner.routineItems.length}{' '}
            {planner.routineItems.length === 1 ? 'item' : 'itens'}, em todos os dias da semana.
          </p>

          <ul className="mt-4 flex flex-col">
            {[...planner.routineItems]
              .sort(byTimeThenTitle)
              .map((item) => (
                <RoutineItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditing(item)
                    setDialogOpen(true)
                  }}
                  onRemove={() => setRemoving(item)}
                />
              ))}
          </ul>
        </Panel>
      ) : null}

      <RoutineItemDialog
        open={dialogOpen}
        editing={editing}
        presetDay={picked}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Tirar da rotina?"
        description={
          removing
            ? `"${removing.title}" sai dos próximos dias. O que já foi marcado continua no histórico.`
            : ''
        }
        confirmLabel="Tirar da rotina"
        onConfirm={async () => {
          if (removing) await planner.archiveRoutineItem(removing.id)
          setRemoving(null)
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}

/**
 * A semana em sete colunas.
 *
 * Não é calendário: não tem mês, não tem navegação, não tem evento arrastável.
 * Ela responde uma pergunta só, "como está a minha semana", e o toque leva pro
 * dia. Um calendário completo aqui seria o produto virando agenda profissional,
 * que é exatamente o que a Rotina não é.
 */
function WeekStrip({
  week,
  today,
  picked,
  onPick,
  countOf,
}: {
  readonly week: readonly DayKey[]
  readonly today: DayKey
  readonly picked: DayKey
  readonly onPick: (day: DayKey) => void
  readonly countOf: (day: DayKey) => number
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {week.map((day) => {
        const total = countOf(day)
        const isToday = day === today
        return (
          <button
            key={day}
            type="button"
            onClick={() => onPick(day)}
            aria-current={day === picked ? 'date' : undefined}
            className={cn(
              'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-colors',
              day === picked
                ? 'border-brand bg-brand-dim/70'
                : 'border-line active:bg-surface-hi',
            )}
          >
            <span
              className={cn(
                'text-[0.625rem] font-medium tracking-[0.1em] uppercase',
                isToday ? 'text-brand-ink' : 'text-ink-faint',
              )}
            >
              {nomeCurto(day)}
            </span>
            <span className={cn('tabular text-sm font-semibold', isToday ? 'text-ink' : 'text-ink-muted')}>
              {dayKeyToDate(day).getDate()}
            </span>
            <span className="text-[0.625rem] text-ink-faint">
              {total === 0 ? 'livre' : `${total} ${total === 1 ? 'item' : 'itens'}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function RoutineRow({
  state,
  day,
  editable,
  onEdit,
  onRemove,
}: {
  readonly state: RoutineDayState
  readonly day: DayKey
  /** Dia passado é leitura: reescrever ontem é como o histórico deixa de valer. */
  readonly editable: boolean
  readonly onEdit: () => void
  readonly onRemove: () => void
}) {
  const planner = usePlanner()
  const { item } = state
  const done = isRoutineDone(state.status)
  const resolved = isRoutineResolved(state.status)

  const objective = planner.objectives.find((entry) => entry.id === item.objectiveId)

  const toggle = () => {
    void planner.setRoutineStatus(
      item.id,
      { status: done ? 'pendente' : 'feito', plannedTime: state.time },
      day,
    )
  }

  return (
    <li className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0">
      <span
        className={cn(
          'tabular mt-0.5 w-10 shrink-0 text-right text-[0.6875rem] leading-5',
          done ? 'text-ink-faint' : 'text-ink-muted',
        )}
      >
        {state.time ?? <span aria-hidden="true">·</span>}
        {state.time ? null : <span className="sr-only">Sem horário definido</span>}
      </span>

      <button
        type="button"
        disabled={!editable}
        onClick={toggle}
        aria-label={done ? `Desfazer ${item.title}` : `Concluir ${item.title}`}
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors',
          done
            ? 'border-positive bg-positive/20 text-positive'
            : 'border-line-hi text-transparent hover:border-brand',
          !editable && 'opacity-40',
        )}
      >
        <Icon name="check" className="size-4" strokeWidth={2.5} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[0.95rem] font-medium text-pretty',
            resolved ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {item.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span>{ROUTINE_RECURRENCE_LABELS[item.recurrence]}</span>
          {item.durationMin ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.durationMin} min</span>
            </>
          ) : null}
          {item.category ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.category}</span>
            </>
          ) : null}
          {objective ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-brand-ink">{objective.title}</span>
            </>
          ) : null}
          {state.status === 'pulado' ? (
            <>
              <span aria-hidden="true">·</span>
              {/* Pular é decisão, não falha, e a palavra na tela precisa dizer isso. */}
              <span>Pulado hoje</span>
            </>
          ) : null}
          {state.movedFrom ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Veio de {formatDayLong(state.movedFrom, day)}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.pausedAt ? <Tag>Pausado</Tag> : null}
        <IconButton icon="editar" label={`Editar ${item.title}`} onClick={onEdit} />
        <IconButton icon="lixeira" label={`Tirar ${item.title} da rotina`} onClick={onRemove} />
      </div>
    </li>
  )
}

const TAB_LABELS: Readonly<Record<'dia' | 'semana' | 'todos', string>> = {
  dia: 'Dia',
  semana: 'Semana',
  todos: 'Todos',
}

/**
 * A lista completa.
 *
 * Ela existe porque a visão de dia não alcança o que não cai hoje: um item de
 * "dias úteis" é invisível num domingo, e um item que ninguém consegue ver é um
 * item que ninguém consegue editar nem tirar. Gerenciar é o papel desta tela, e
 * não dá pra gerenciar o que a tela esconde.
 *
 * Aqui não há check: marcar acontece no dia, e um check numa lista sem data
 * responderia "marquei em qual dia?" com silêncio.
 */
function RoutineItemRow({
  item,
  onEdit,
  onRemove,
}: {
  readonly item: RoutineItem
  readonly onEdit: () => void
  readonly onRemove: () => void
}) {
  return (
    <li className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="tabular mt-0.5 w-10 shrink-0 text-right text-[0.6875rem] leading-5 text-ink-muted">
        {item.timeOfDay ?? <span aria-hidden="true">·</span>}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] font-medium text-pretty text-ink">{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span>{recurrenceLabel(item)}</span>
          {item.durationMin ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.durationMin} min</span>
            </>
          ) : null}
          {item.category ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.category}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.pausedAt ? <Tag>Pausado</Tag> : null}
        <IconButton icon="editar" label={`Editar ${item.title}`} onClick={onEdit} />
        <IconButton icon="lixeira" label={`Tirar ${item.title} da rotina`} onClick={onRemove} />
      </div>
    </li>
  )
}

/**
 * "Segunda, quarta e sexta" em vez de "Dias específicos".
 *
 * O rótulo genérico obriga a abrir o item pra saber em que dias ele cai, e a
 * pergunta que esta lista existe pra responder é justamente essa.
 */
function recurrenceLabel(item: RoutineItem): string {
  if (item.recurrence !== 'dias-semana') return ROUTINE_RECURRENCE_LABELS[item.recurrence]

  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const dias = item.weekdays.map((day) => nomes[day]).filter(Boolean)
  if (dias.length === 0) return ROUTINE_RECURRENCE_LABELS[item.recurrence]
  if (dias.length === 1) return `Toda ${dias[0]}`
  return dias.join(', ')
}

/** Sem horário vai pro fim: a lista é lida como uma linha do tempo. */
function byTimeThenTitle(a: RoutineItem, b: RoutineItem): number {
  if (a.timeOfDay && b.timeOfDay && a.timeOfDay !== b.timeOfDay) {
    return a.timeOfDay.localeCompare(b.timeOfDay)
  }
  if (a.timeOfDay && !b.timeOfDay) return -1
  if (!a.timeOfDay && b.timeOfDay) return 1
  return a.title.localeCompare(b.title, 'pt-BR')
}

function nomeDoDia(day: DayKey): string {
  const nome = dayKeyToDate(day).toLocaleDateString('pt-BR', { weekday: 'long' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

function nomeCurto(day: DayKey): string {
  return dayKeyToDate(day).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}
