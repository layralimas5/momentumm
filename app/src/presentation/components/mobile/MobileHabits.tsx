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
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { HabitGlyph, Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { tapFeedback } from '@/shared/lib/haptics'
import { MobileSection } from './MobileSection'

interface MobileHabitsProps {
  readonly states: readonly HabitDayState[]
  readonly objectiveTitles: ReadonlyMap<string, string>
  readonly progress: HabitDayProgress
  readonly onSetStatus: (habitId: string, status: HabitStatus) => Promise<void>
  readonly onSeeAll: () => void
  readonly onCreate: () => void
}

/**
 * Hábitos do dia no celular.
 *
 * Lista de linhas de 56px, não uma pilha de cartões: o objetivo é marcar
 * concluído com o polegar enquanto se anda. Todo o resto (adiar, versão mínima,
 * pular) mora no sheet que abre ao tocar na linha.
 */
export function MobileHabits({
  states,
  objectiveTitles,
  progress,
  onSetStatus,
  onSeeAll,
  onCreate,
}: MobileHabitsProps) {
  const [openHabitId, setOpenHabitId] = useState<string | null>(null)
  const active = states.find((state) => state.habit.id === openHabitId) ?? null

  return (
    <MobileSection
      title="Hábitos de hoje"
      icon="habitos"
      action={
        states.length > 0
          ? { label: 'Ver todos', onClick: onSeeAll }
          : undefined
      }
    >
      {states.length === 0 ? (
        <div className="surface-card p-4">
          <p className="text-sm text-ink-muted">
            Nenhum hábito pra hoje. Um só, pequeno, sustenta mais que três difíceis.
          </p>
          <Button size="md" className="mt-3 h-12 w-full" onClick={onCreate}>
            <Icon name="mais" className="size-4" />
            Criar hábito
          </Button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-top">
              <span
                className="block h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </span>
            <span className="tabular shrink-0 text-sm text-ink-muted">
              {progress.done} de {progress.total} concluídos
            </span>
          </div>

          <ul>
            {states.map((state) => (
              <HabitRow
                key={state.habit.id}
                state={state}
                objectiveTitle={
                  state.habit.objectiveId
                    ? (objectiveTitles.get(state.habit.objectiveId) ?? null)
                    : null
                }
                onToggle={() => {
                  tapFeedback()
                  void onSetStatus(
                    state.habit.id,
                    countsAsDone(state.status) ? 'pendente' : 'feito',
                  )
                }}
                onOpen={() => setOpenHabitId(state.habit.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <BottomSheet
        open={active !== null}
        title={active?.habit.name ?? ''}
        description={
          active
            ? `${activityType(active.habit.axis).label} · ${DAY_PART_LABELS[active.habit.dayPart]} · ${frequencyLabel(active.habit)}`
            : undefined
        }
        onClose={() => setOpenHabitId(null)}
      >
        {active ? (
          <div className="flex flex-col gap-1">
            {countsAsDone(active.status) ? (
              <SheetAction
                icon={<Icon name="desfazer" className="size-5" />}
                label="Desfazer conclusão"
                hint="Volta pra pendente"
                onClick={() => {
                  setOpenHabitId(null)
                  void onSetStatus(active.habit.id, 'pendente')
                }}
              />
            ) : (
              <SheetAction
                icon={<Icon name="check" className="size-5" />}
                label="Concluir"
                hint={habitTargetLabel(active.habit)}
                tone="brand"
                onClick={() => {
                  setOpenHabitId(null)
                  void onSetStatus(active.habit.id, 'feito')
                }}
              />
            )}

            <SheetAction
              icon={<Icon name="minimo" className="size-5" />}
              label="Fiz a versão mínima"
              hint={`${habitTargetLabel(active.habit, active.habit.minimalTarget)} · conta na sequência`}
              onClick={() => {
                setOpenHabitId(null)
                void onSetStatus(active.habit.id, 'minimo')
              }}
            />

            <SheetAction
              icon={<Icon name="adiar" className="size-5" />}
              label="Adiar pra depois"
              hint="Ainda cabe hoje, só não agora"
              onClick={() => {
                setOpenHabitId(null)
                void onSetStatus(active.habit.id, 'adiado')
              }}
            />

            <SheetAction
              icon={<Icon name="fechar" className="size-5" />}
              label="Pular hoje, sem culpa"
              hint="Escolha consciente, não falha"
              onClick={() => {
                setOpenHabitId(null)
                void onSetStatus(active.habit.id, 'pulado')
              }}
            />

            {active.streak > 0 ? (
              <p className="mt-2 flex items-center gap-2 px-3 text-sm text-ink-faint">
                <Icon name="fogo" className="size-4 text-flame" />
                {active.streak} {active.streak === 1 ? 'dia seguido' : 'dias seguidos'}
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </MobileSection>
  )
}

function HabitRow({
  state,
  objectiveTitle,
  onToggle,
  onOpen,
}: {
  state: HabitDayState
  objectiveTitle: string | null
  onToggle: () => void
  onOpen: () => void
}) {
  const { habit, status, streak } = state
  const axis = activityType(habit.axis)
  const done = countsAsDone(status)
  const skipped = status === 'pulado' || status === 'adiado'

  return (
    <li className="flex items-stretch border-t border-line">
      {/*
        A linha inteira abre os detalhes e o círculo conclui. São dois alvos
        grandes e separados: nada de acertar um ícone de 16px pra desfazer.
      */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-2 text-left transition-colors active:bg-surface-hi',
          skipped && 'opacity-60',
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-hi"
          style={{ color: axis.colorToken }}
        >
          <HabitGlyph icon={habit.icon} className="size-4.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-sm font-medium',
              done ? 'text-ink-muted line-through decoration-line-hi' : 'text-ink',
            )}
          >
            {habit.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-faint">
            <span className="truncate">
              {status === 'minimo'
                ? 'Versão mínima feita'
                : status === 'pulado'
                  ? 'Pulado hoje'
                  : status === 'adiado'
                    ? 'Adiado'
                    : DAY_PART_LABELS[habit.dayPart]}
            </span>
            {/* O objetivo apoiado, quando existe: no celular ele é o único
                contexto que cabe, e é o que impede o hábito de virar caixinha
                de marcar. */}
            {objectiveTitle ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{objectiveTitle}</span>
              </>
            ) : null}
            {streak > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular inline-flex shrink-0 items-center gap-1">
                  <Icon name="fogo" className="size-3.5 text-flame" />
                  {streak}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        className="grid w-16 shrink-0 place-items-center transition-colors active:bg-surface-hi"
      >
        <span
          className={cn(
            'grid size-11 place-items-center rounded-full border transition-colors',
            done
              ? 'border-transparent bg-positive/90 text-canvas'
              : 'border-line-hi text-transparent',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={done ? 'done' : 'pending'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <Icon name="check" className="size-5" strokeWidth={2.5} />
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="sr-only">
          {done ? `Desfazer conclusão de ${habit.name}` : `Concluir ${habit.name}`}
        </span>
      </button>
    </li>
  )
}
