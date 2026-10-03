import { StatusTag } from '@/presentation/components/ds/Badges'
import { ProgressBar } from '@/presentation/components/ds/Progress'
import { ActivityItem } from '@/presentation/components/ds/Rows'
import { Icon } from '@/presentation/components/ui/Icon'
import type { FocusItem, TodayFocus } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { axisLabel, axisOfFocus, useDayToggle, xpOf } from './day-items'

/** A seção "Hoje": quanto do dia já saiu e o que falta, uma linha por coisa. */
export function TodayChecklist({
  focus,
  onAdd,
  onOpen,
}: {
  readonly focus: TodayFocus
  readonly onAdd: () => void
  readonly onOpen: (item: FocusItem) => void
}) {
  const planner = usePlanner()
  const { busyKey, toggleFocus } = useDayToggle()
  const ratio = focus.total === 0 ? 0 : focus.done / focus.total

  return (
    <section aria-labelledby="hoje-lista" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <h2 id="hoje-lista" className="text-lg font-semibold tracking-tight text-ink">
          Hoje
        </h2>
        {focus.total > 0 ? (
          <span className="text-sm text-ink-faint tabular">
            {focus.done} de {focus.total} concluídos
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          {focus.total > 0 ? (
            <span className="text-sm font-semibold text-brand-hi tabular">{Math.round(ratio * 100)}%</span>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            className="chip press grid size-9 place-items-center rounded-full text-brand-hi"
          >
            <Icon name="mais" className="size-4" strokeWidth={2.25} />
            <span className="sr-only">Adicionar ao dia</span>
          </button>
        </span>
      </div>

      {focus.total > 0 ? <ProgressBar value={ratio} label={`Hoje: ${focus.done} de ${focus.total}`} size="sm" /> : null}

      {focus.all.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="well press flex min-h-20 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-medium text-ink-muted"
        >
          <Icon name="mais" className="size-4" />
          Nada planejado. Adicione a primeira ação do dia
        </button>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {focus.all.map((item) => {
            const key = `${item.kind}-${item.id}`
            const xp = xpOf({ kind: item.kind, isMainPriority: item.task?.isMainPriority ?? false })
            const axis = axisLabel(planner.axes, axisOfFocus(item))

            return (
              <ActivityItem
                key={key}
                title={item.title}
                done={item.done}
                busy={busyKey === key}
                onToggle={() => void toggleFocus(item)}
                onOpen={() => onOpen(item)}
                {...(xp ? { xp } : {})}
                meta={<FocusMeta item={item} />}
                tag={
                  item.done ? (
                    <StatusTag>Concluído</StatusTag>
                  ) : item.task?.isMainPriority ? (
                    <StatusTag tone="brand">Foco</StatusTag>
                  ) : axis ? (
                    <StatusTag>{axis}</StatusTag>
                  ) : null
                }
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}

function FocusMeta({ item }: { readonly item: FocusItem }) {
  if (item.habitState && item.habitState.streak > 0) {
    return (
      <>
        <Icon name="fogo" className="size-3.5 text-flame" filled strokeWidth={2} />
        {item.habitState.streak} {item.habitState.streak === 1 ? 'dia' : 'dias'}
      </>
    )
  }
  if (item.priority === 'alta' && !item.done) return <>Prioridade alta</>
  if (item.objective) return <>Meta: {item.objective.title}</>
  if (item.stageTitle) return <>{item.stageTitle}</>
  return <>{item.kind === 'habito' ? 'Hábito' : 'Ação'}</>
}

