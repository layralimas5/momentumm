import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { activityType } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import type { Goal } from '@/domain/entities/goal'
import { isPending, type Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { tapFeedback } from '@/shared/lib/haptics'
import { MobileSection } from './MobileSection'

/** Três é o teto na tela inicial. Lista longa aqui vira a lista infinita que o produto combate. */
const VISIBLE_LIMIT = 3

interface MobileActionsProps {
  readonly tasks: readonly Task[]
  readonly goals: readonly Goal[]
  readonly today: DayKey
  readonly excludeId?: string | undefined
  readonly onComplete: (task: Task) => Promise<void>
  readonly onPostpone: (task: Task) => Promise<void>
  readonly onShrink: (task: Task) => Promise<void>
  readonly onStartFocus: (task: Task) => void
  readonly onEdit: (task: Task) => void
  readonly onCreate: () => void
  readonly onSeeAll: () => void
}

export function MobileActions({
  tasks,
  goals,
  today,
  excludeId,
  onComplete,
  onPostpone,
  onShrink,
  onStartFocus,
  onEdit,
  onCreate,
  onSeeAll,
}: MobileActionsProps) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const pending = tasks
    .filter((task) => isPending(task) && task.id !== excludeId && task.day <= today)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))

  const visible = pending.slice(0, VISIBLE_LIMIT)
  const hidden = pending.length - visible.length
  const active = tasks.find((task) => task.id === openTaskId) ?? null

  return (
    <MobileSection
      title="Próximas ações"
      icon="jornada"
      action={{ label: 'Planejamento', onClick: onSeeAll }}
    >
      {visible.length === 0 ? (
        <div className="surface-card p-4">
          <p className="text-sm text-ink-muted">
            Nada pendente além da prioridade. Toda meta precisa de uma próxima ação concreta.
          </p>
          <Button size="md" variant="secondary" className="mt-3 h-12 w-full" onClick={onCreate}>
            <Icon name="mais" className="size-4" />
            Criar ação
          </Button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <ul>
            <AnimatePresence initial={false}>
              {visible.map((task, index) => (
                <ActionRow
                  key={task.id}
                  task={task}
                  goal={goals.find((goal) => goal.id === task.goalId) ?? null}
                  today={today}
                  first={index === 0}
                  onComplete={() => {
                    tapFeedback()
                    void onComplete(task)
                  }}
                  onPostpone={() => {
                    tapFeedback([10, 40, 10])
                    void onPostpone(task)
                  }}
                  onOpen={() => setOpenTaskId(task.id)}
                />
              ))}
            </AnimatePresence>
          </ul>

          {hidden > 0 ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="min-h-12 w-full border-t border-line px-4 text-left text-sm text-ink-faint transition-colors active:bg-surface-hi"
            >
              Mais {hidden} {hidden === 1 ? 'ação' : 'ações'} no planejamento
            </button>
          ) : null}
        </div>
      )}

      <BottomSheet
        open={active !== null}
        title={active?.title ?? ''}
        description={active ? `${active.estimatedMin} min estimados` : undefined}
        onClose={() => setOpenTaskId(null)}
      >
        {active ? (
          <div className="flex flex-col gap-1">
            <SheetAction
              icon={<Icon name="play" className="size-5" />}
              label="Focar nessa agora"
              hint="Abre o cronômetro em modo sem distrações"
              tone="brand"
              onClick={() => {
                setOpenTaskId(null)
                onStartFocus(active)
              }}
            />
            <SheetAction
              icon={<Icon name="check" className="size-5" />}
              label="Concluir"
              onClick={() => {
                setOpenTaskId(null)
                void onComplete(active)
              }}
            />
            {active.minimalVersion ? (
              <SheetAction
                icon={<Icon name="minimo" className="size-5" />}
                label="Fazer a versão mínima"
                hint={active.minimalVersion}
                onClick={() => {
                  setOpenTaskId(null)
                  void onShrink(active)
                }}
              />
            ) : null}
            <SheetAction
              icon={<Icon name="adiar" className="size-5" />}
              label="Adiar pra amanhã"
              onClick={() => {
                setOpenTaskId(null)
                void onPostpone(active)
              }}
            />
            <SheetAction
              icon={<Icon name="editar" className="size-5" />}
              label="Editar"
              onClick={() => {
                setOpenTaskId(null)
                onEdit(active)
              }}
            />
          </div>
        ) : null}
      </BottomSheet>
    </MobileSection>
  )
}

/** Distância de arrasto que confirma o adiamento. */
const SWIPE_THRESHOLD = 88

function ActionRow({
  task,
  goal,
  today,
  first,
  onComplete,
  onPostpone,
  onOpen,
}: {
  task: Task
  goal: Goal | null
  today: DayKey
  first: boolean
  onComplete: () => void
  onPostpone: () => void
  onOpen: () => void
}) {
  const [offset, setOffset] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)

  const axis = task.axis ? activityType(task.axis) : null
  const overdue = task.day < today

  /*
    Deslizar pra esquerda adia. O gesto é atalho, não caminho único: a mesma
    ação está no menu "⋯" ao lado, que é o que a pessoa acha sem precisar
    descobrir nada. Só assume o gesto quando o movimento é claramente
    horizontal, senão o dedo travaria a rolagem da página.
  */
  const onPointerDown = (event: React.PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY }
    horizontal.current = false
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!start.current) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y

    if (!horizontal.current) {
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null
        return
      }
      if (Math.abs(dx) < 8) return
      horizontal.current = true
    }

    setOffset(Math.min(0, dx))
  }

  const onPointerUp = () => {
    if (offset < -SWIPE_THRESHOLD) onPostpone()
    setOffset(0)
    start.current = null
    horizontal.current = false
  }

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('relative overflow-hidden', !first && 'border-t border-line')}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex items-center gap-2 bg-flame-dim/60 px-5 text-sm text-flame"
        style={{ opacity: offset < -12 ? 1 : 0 }}
      >
        <Icon name="adiar" className="size-4" />
        Adiar
      </span>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          'relative flex items-stretch bg-surface',
          offset === 0 && 'transition-transform duration-200',
        )}
      >
        <button
          type="button"
          onClick={onComplete}
          className="grid w-14 shrink-0 place-items-center transition-colors active:bg-surface-hi"
        >
          <span className="grid size-11 place-items-center rounded-full border border-line-hi text-transparent active:border-positive active:text-positive">
            <Icon name="check" className="size-5" strokeWidth={2.5} />
          </span>
          <span className="sr-only">Concluir {task.title}</span>
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="min-h-16 min-w-0 flex-1 py-2.5 pr-2 text-left transition-colors active:bg-surface-hi"
        >
          <span className="block truncate text-sm font-medium text-ink">{task.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-faint">
            <span className="shrink-0">{task.estimatedMin} min</span>
            <span aria-hidden="true">·</span>
            <span className="truncate" style={axis ? { color: axis.colorToken } : undefined}>
              {goal
                ? `Meta de ${activityType(goal.type).label}`
                : (axis?.label ?? 'Sem meta')}
            </span>
            {overdue ? <span className="shrink-0 text-flame">· atrasada</span> : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="grid w-12 shrink-0 place-items-center text-ink-faint transition-colors active:bg-surface-hi"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ⋯
          </span>
          <span className="sr-only">Opções de {task.title}</span>
        </button>
      </div>
    </motion.li>
  )
}
