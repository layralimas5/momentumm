import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { addDays } from '@/domain/entities/day'
import type { Task } from '@/domain/entities/task'
import type { FocusItem, TodayFocus } from '@/presentation/planner/use-dashboard'
import { ObjectiveLink } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { IconButton, Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * Seu foco de hoje: o bloco principal do dashboard.
 *
 * É o único lugar da tela que responde "o que eu faço agora", e por isso ele
 * ganha o maior peso visual e a primeira dobra. Ação e hábito aparecem na mesma
 * lista porque é assim que o dia é vivido — separar em dois cards obriga a
 * pessoa a somar de cabeça o que falta.
 *
 * No máximo três itens. O quarto não cabe numa decisão: a partir dele a pessoa
 * para de escolher e passa a varrer. O resto continua a um toque em "ver tudo
 * do dia" — o dashboard ordena o trabalho, nunca esconde.
 *
 * Concluir aqui escreve no registro original (ação ou hábito). Não existe uma
 * segunda lista pro dashboard.
 */
export function TodayFocusCard({
  focus,
  onStartFocus,
  onSeeAll,
  onPlanDay,
  secondary = false,
}: {
  readonly focus: TodayFocus
  readonly onStartFocus: (task: Task) => void
  readonly onSeeAll: () => void
  readonly onPlanDay: () => void
  /**
   * Quando a ação principal já tem card próprio acima, o resto do dia não
   * disputa com ela: vira uma linha recolhida, que abre a mesma lista.
   */
  readonly secondary?: boolean
}) {
  const remaining = focus.total - focus.items.length

  if (secondary) {
    return (
      <OtherActions focus={focus} onStartFocus={onStartFocus} onSeeAll={onSeeAll} />
    )
  }

  return (
    <Panel tone="raised" aria-labelledby="foco-titulo" className="edge-light">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="foco-titulo" className="text-xl font-semibold tracking-tight text-ink">
            Seu foco de hoje
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {focus.total === 0
              ? 'Nada planejado ainda.'
              : `${focus.total} ${focus.total === 1 ? 'atividade' : 'atividades'}${
                  focus.minutes ? ` · cerca de ${formatMinutes(focus.minutes)}` : ''
                }`}
          </p>
        </div>

        {focus.total > 0 ? (
          <div className="w-full sm:w-44">
            <div className="flex items-baseline justify-between gap-2 text-xs text-ink-faint">
              <span>Concluído</span>
              <span className="tabular text-ink-muted">
                {focus.done} de {focus.total}
              </span>
            </div>
            <ProgressBar
              className="mt-1.5"
              value={focus.total === 0 ? 0 : focus.done / focus.total}
              label={`Progresso do dia: ${focus.done} de ${focus.total}`}
            />
          </div>
        ) : null}
      </div>

      {focus.total === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line-hi px-4 py-6 text-center">
          <p className="text-sm text-ink">Seu dia ainda não tem atividades planejadas.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Escolhe uma ação do teu plano ou cria uma pequena pra hoje. Uma só já tira da inércia.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={onPlanDay}>
              <Icon name="mais" className="size-4" />
              Planejar o dia
            </Button>
            <Button size="sm" variant="secondary" onClick={onSeeAll}>
              Escolher do plano
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {focus.items.map((item) => (
              <FocusRow key={`${item.kind}-${item.id}`} item={item} onStartFocus={onStartFocus} />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-ink-faint">
              {remaining > 0
                ? `Mais ${remaining} ${remaining === 1 ? 'atividade' : 'atividades'} no dia.`
                : 'Isso é tudo que você planejou pra hoje.'}
            </p>
            <Button variant="ghost" size="sm" onClick={onSeeAll}>
              Ver tudo do dia
              <Icon name="seta" className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

/**
 * O resto do dia, recolhido.
 *
 * Fechado ele diz só quantas ações sobraram, pra pessoa saber que existem sem
 * precisar decidir sobre elas agora. Aberto é exatamente a mesma lista do card
 * cheio: nenhuma ação fica escondida atrás da hierarquia.
 */
function OtherActions({
  focus,
  onStartFocus,
  onSeeAll,
}: {
  readonly focus: TodayFocus
  readonly onStartFocus: (task: Task) => void
  readonly onSeeAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  const open_count = focus.total - focus.done
  if (focus.total === 0 || open_count <= 0) return null

  return (
    <section aria-labelledby="outras-acoes-titulo" className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="outras-acoes-lista"
        className="flex min-h-13 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-surface-hi"
      >
        <span id="outras-acoes-titulo" className="text-sm font-medium text-ink-muted">
          {open_count} {open_count === 1 ? 'outra ação hoje' : 'outras ações hoje'}
        </span>
        <Icon
          name="seta"
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-ink-faint transition-transform duration-200',
            open ? '-rotate-90' : 'rotate-90',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="outras-acoes-lista"
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="flex flex-col divide-y divide-line border-t border-line px-4">
              {focus.items.map((item) => (
                <FocusRow key={`${item.kind}-${item.id}`} item={item} onStartFocus={onStartFocus} />
              ))}
            </ul>
            <div className="border-t border-line px-4 py-2.5">
              <Button variant="ghost" size="sm" onClick={onSeeAll}>
                Ver tudo do dia
                <Icon name="seta" className="size-3.5" />
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function FocusRow({
  item,
  onStartFocus,
}: {
  readonly item: FocusItem
  readonly onStartFocus: (task: Task) => void
}) {
  const planner = usePlanner()
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (item.task) {
        await planner.setTaskDone(item.task.id, !item.done)
      } else if (item.habitState) {
        await planner.setHabitStatus(item.habitState.habit.id, item.done ? 'pendente' : 'feito')
      }
    } finally {
      setBusy(false)
    }
  }

  const postpone = () => {
    if (item.task) {
      void planner.updateTask(item.task.id, {
        day: addDays(item.task.day < planner.today ? planner.today : item.task.day, 1),
      })
      return
    }
    if (item.habitState) void planner.setHabitStatus(item.habitState.habit.id, 'adiado')
  }

  return (
    <li className="flex items-start gap-3 py-3">
      {/*
        Alvo de 44px: é o mínimo confortável no polegar, e essa é a única ação
        da tela que a pessoa repete várias vezes por dia.
      */}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-label={item.done ? `Desfazer ${item.title}` : `Concluir ${item.title}`}
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors',
          item.done
            ? 'border-positive bg-positive/20 text-positive'
            : 'border-line-hi text-transparent hover:border-brand',
          busy && 'opacity-50',
        )}
      >
        <Icon name="check" className="size-4" strokeWidth={2.5} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[0.95rem] font-medium text-pretty',
            item.done ? 'text-ink-faint line-through' : 'text-ink',
          )}
        >
          {item.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span className={item.role === 'Prioridade principal' ? 'text-brand-ink' : undefined}>
            {item.role}
          </span>
          {item.stageTitle ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Etapa: {item.stageTitle}</span>
            </>
          ) : null}
          {item.objective ? (
            <>
              <span aria-hidden="true">·</span>
              <ObjectiveLink objective={item.objective} />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {item.minutes ? <Tag>{item.minutes} min</Tag> : null}

        {item.task && !item.done ? (
          <IconButton
            icon="play"
            label={`Começar ${item.title}`}
            onClick={() => item.task && onStartFocus(item.task)}
          />
        ) : null}

        {item.done ? null : (
          <IconButton icon="adiar" label={`Adiar ${item.title}`} onClick={postpone} />
        )}
      </div>
    </li>
  )
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${String(minutes).padStart(2, '0')}`
}
