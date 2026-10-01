import { Link } from 'react-router-dom'
import { addDays } from '@/domain/entities/day'
import { routineExecutionFor, routineRecurrenceLabel } from '@/domain/entities/routine-item'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { routinePrefillPath } from '@/presentation/routine/routine-prefill'

/** Quatro semanas: o bastante pra ver um ritmo, curto o bastante pra o número ser de agora. */
const WINDOW_DAYS = 28

/**
 * A rotina do objetivo, com o que foi feito.
 *
 * É a ponta PROGRESSO da §16. O treino de seg, qua e sex já contava no score;
 * faltava aparecer aqui, no objetivo que ele sustenta, com o número de vezes
 * que aconteceu de verdade.
 */
export function ObjectiveRoutinePanel({ objectiveId, objectiveTitle }: { readonly objectiveId: string; readonly objectiveTitle: string }) {
  const planner = usePlanner()
  const rows = routineExecutionFor(
    objectiveId,
    planner.routineItems,
    planner.routineOccurrences,
    addDays(planner.today, -(WINDOW_DAYS - 1)),
    planner.today,
  )

  return (
    <Panel>
      <PanelHeader
        title="Na rotina"
        icon="relogio"
        action={
          <Link
            to={routinePrefillPath({ objectiveId, title: objectiveTitle })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-hi px-3 text-sm font-medium text-ink transition-colors hover:border-brand/60 hover:bg-brand/10"
          >
            <Icon name="mais" className="size-4" />
            Levar pra rotina
          </Link>
        }
      />

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Nada na rotina ainda. O plano diz o que fazer; a rotina diz quando. Um treino fixo de seg, qua e sex vale
          mais que a intenção de treinar.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.itemId} className="flex items-center gap-3">
              <span className="tabular w-12 shrink-0 text-sm text-ink-muted">{row.timeOfDay ?? '·'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{row.title}</p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{routineRecurrenceLabel(row)}</p>
              </div>
              <span className="tabular shrink-0 text-xs text-ink-muted">
                {row.done === 0 ? 'nenhuma vez' : row.done === 1 ? '1 vez' : `${row.done} vezes`}
                <span className="sr-only"> nas últimas {WINDOW_DAYS / 7} semanas</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 ? (
        <p className="mt-3 text-xs text-ink-faint">Feito nas últimas {WINDOW_DAYS / 7} semanas.</p>
      ) : null}
    </Panel>
  )
}
