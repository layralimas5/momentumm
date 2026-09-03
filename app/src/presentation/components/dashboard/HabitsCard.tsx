import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { activityType } from '@/domain/entities/activity-type'
import {
  countsAsDone,
  DAY_PART_LABELS,
  frequencyLabel,
  habitTargetLabel,
  type HabitDayProgress,
  type HabitDayState,
  type HabitStatus,
} from '@/domain/entities/habit'
import { Button } from '@/presentation/components/ui/Button'
import { EmptyState } from '@/presentation/components/ui/States'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface HabitsCardProps {
  readonly states: readonly HabitDayState[]
  readonly progress: HabitDayProgress
  readonly onSetStatus: (habitId: string, status: HabitStatus) => Promise<void>
  readonly onSeeAll: () => void
  readonly onCreate: () => void
}

/**
 * Hábitos do dia.
 *
 * Nenhum estado aqui pune: "pulei conscientemente" e "adiei" são escolhas
 * legítimas, e a versão mínima conta como cumprido. O que o card mede é
 * presença, não perfeição.
 */
export function HabitsCard({ states, progress, onSetStatus, onSeeAll, onCreate }: HabitsCardProps) {
  return (
    <Panel aria-labelledby="habitos-titulo">
      <PanelHeader
        id="habitos-titulo"
        title="Hábitos de hoje"
        icon="habitos"
        action={
          states.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onSeeAll}>
              Ver todos
              <Icon name="seta" className="size-3.5" />
            </Button>
          ) : null
        }
      />

      {states.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhum hábito pra hoje"
            description="Um hábito simples e diário sustenta mais evolução do que três difíceis. Começa por um."
            action={
              <Button size="sm" onClick={onCreate}>
                <Icon name="mais" className="size-4" />
                Criar hábito
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar
              className="flex-1"
              value={progress.ratio}
              label="Progresso dos hábitos de hoje"
            />
            <span className="tabular shrink-0 text-sm text-ink-muted">
              {progress.done}/{progress.total}
            </span>
          </div>

          {progress.allDone ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-positive">
              <Icon name="check" className="size-4" />
              Todos os hábitos de hoje concluídos.
            </p>
          ) : null}

          <ul className="mt-4 flex flex-col gap-2">
            {states.map((state) => (
              <HabitRow key={state.habit.id} state={state} onSetStatus={onSetStatus} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function HabitRow({
  state,
  onSetStatus,
}: {
  state: HabitDayState
  onSetStatus: (habitId: string, status: HabitStatus) => Promise<void>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { habit, status, streak } = state
  const axis = activityType(habit.axis)
  const done = countsAsDone(status)

  const set = (next: HabitStatus) => {
    setMenuOpen(false)
    void onSetStatus(habit.id, next)
  }

  return (
    <li
      className={cn(
        'rounded-xl border px-3 py-2.5 transition-colors',
        done ? 'border-line bg-surface-hi/40' : 'border-line bg-surface-hi/70 hover:border-line-hi',
        status === 'pulado' || status === 'adiado' ? 'opacity-70' : '',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set(done ? 'pendente' : 'feito')}
          aria-pressed={done}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg border transition-colors',
            done
              ? 'border-transparent bg-positive/90 text-canvas'
              : 'border-line-hi text-ink-faint hover:border-brand hover:text-brand-hi',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span
                key="done"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <Icon name="check" className="size-4" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <HabitGlyph icon={habit.icon} className="size-4" />
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sr-only">
            {done ? `Desfazer conclusão de ${habit.name}` : `Concluir ${habit.name}`}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', done ? 'text-ink-muted' : 'text-ink')}>
            {habit.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
            <span style={{ color: axis.colorToken }}>{axis.label}</span>
            <span aria-hidden="true">·</span>
            <span>{DAY_PART_LABELS[habit.dayPart]}</span>
            <span aria-hidden="true">·</span>
            <span>{frequencyLabel(habit)}</span>
            <span aria-hidden="true">·</span>
            <span>{habitTargetLabel(habit)}</span>
          </p>
        </div>

        {streak > 0 ? (
          <span className="tabular hidden shrink-0 items-center gap-1 text-xs text-ink-faint sm:inline-flex">
            <Icon name="fogo" className="size-3.5 text-flame" />
            {streak}
          </span>
        ) : null}

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="grid size-9 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-top hover:text-ink"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ⋯
            </span>
            <span className="sr-only">Mais opções para {habit.name}</span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-line-hi bg-surface-top py-1 shadow-lg"
            >
              <MenuItem onClick={() => set('minimo')}>
                <Icon name="minimo" className="size-4" />
                Fiz a versão mínima
              </MenuItem>
              <MenuItem onClick={() => set('adiado')}>
                <Icon name="adiar" className="size-4" />
                Adiar pra depois
              </MenuItem>
              <MenuItem onClick={() => set('pulado')}>
                <Icon name="fechar" className="size-4" />
                Pular hoje, sem culpa
              </MenuItem>
              {status !== 'pendente' ? (
                <MenuItem onClick={() => set('pendente')}>
                  <Icon name="desfazer" className="size-4" />
                  Desfazer
                </MenuItem>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {status !== 'pendente' && status !== 'feito' ? (
        <p className="mt-2 pl-12">
          <Tag tone={status === 'minimo' ? 'brand' : 'neutral'}>
            {status === 'minimo'
              ? `Versão mínima: ${habitTargetLabel(habit, habit.minimalTarget)}`
              : status === 'pulado'
                ? 'Pulado conscientemente'
                : 'Adiado pra depois'}
          </Tag>
        </p>
      ) : null}
    </li>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink"
    >
      {children}
    </button>
  )
}
