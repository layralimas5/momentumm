import { useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import type { CapacityProfile } from '@/domain/entities/checkin'
import type { PlanLimits } from '@/domain/entities/plan'
import type { Task } from '@/domain/entities/task'
import { formatElapsed } from '@/domain/entities/timer'
import { useFocus } from '@/presentation/focus/use-focus'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, ProgressBar } from '@/presentation/components/ui/Surface'
import { UpgradeHint } from './UpgradeHint'

interface FocusCardProps {
  readonly task: Task | null
  readonly capacity: CapacityProfile
  readonly minutesToday: number
  readonly limits: PlanLimits
}

const ALL_DURATIONS = [15, 25, 45, 60] as const

/**
 * Sessão de foco. O seletor sugere a duração que combina com a capacidade do
 * dia — em dia ruim ele não oferece uma hora de cara, porque a sessão que não
 * começa não serve pra nada.
 */
export function FocusCard({ task, capacity, minutesToday, limits }: FocusCardProps) {
  const focus = useFocus()
  /*
    A duração segue a capacidade do dia ATÉ a pessoa escolher outra. Guardar um
    número fixo no estado deixaria o card sugerindo 25 minutos logo depois de um
    check-in de energia baixa, contradizendo o próprio texto acima do seletor.
  */
  const [chosen, setChosen] = useState<number | null>(null)
  const duration = chosen ?? capacity.suggestedFocusMin

  const session = focus.session

  if (session) {
    const type = activityType(session.type)
    return (
      <Panel tone="brand" aria-labelledby="foco-titulo">
        <PanelHeader id="foco-titulo" title="Foco em andamento" icon="foco" />

        <p className="mt-3 truncate text-sm text-ink-muted">{session.label ?? type.label}</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-ink">
          {formatElapsed(focus.elapsed)}
        </p>

        {session.plannedMin ? (
          <div className="mt-4">
            <ProgressBar
              value={focus.plannedRatio}
              label={`Progresso da sessão de ${session.plannedMin} minutos`}
            />
            <p className="tabular mt-1.5 text-xs text-ink-faint">
              Meta da sessão: {session.plannedMin} min
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {focus.running ? (
            <Button variant="secondary" size="sm" onClick={focus.pause}>
              <Icon name="pausa" className="size-4" />
              Pausar
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={focus.resume}>
              <Icon name="play" className="size-4" />
              Retomar
            </Button>
          )}
          <Button size="sm" onClick={() => focus.setImmersive(true)}>
            Modo sem distrações
          </Button>
          <Button variant="ghost" size="sm" onClick={focus.discard}>
            Encerrar
          </Button>
        </div>
      </Panel>
    )
  }

  const available = ALL_DURATIONS.filter((value) => limits.focusDurations.includes(value))
  const blocked = ALL_DURATIONS.filter((value) => !limits.focusDurations.includes(value))
  const axis = task?.axis ?? 'estudo'
  const label = task?.title ?? 'Sessão livre de foco'

  return (
    <Panel aria-labelledby="foco-titulo">
      <PanelHeader
        id="foco-titulo"
        title="Sessão de foco"
        icon="foco"
        hint={`Hoje ${capacity.suggestedFocusMin} minutos é o tamanho que combina com sua energia.`}
      />

      <ChoiceGroup
        className="mt-4"
        size="sm"
        label="Duração da sessão"
        value={duration}
        onChange={setChosen}
        options={available.map((value) => ({ value, label: `${value} min` }))}
      />

      <p className="mt-4 rounded-xl border border-line bg-surface-hi/60 px-3.5 py-3 text-sm">
        <span className="text-ink-faint">Vai executar: </span>
        <span className="text-ink">{label}</span>
      </p>

      <Button
        className="mt-4 w-full"
        onClick={() =>
          focus.start({ axis, label, plannedMin: duration, taskId: task?.id ?? null })
        }
      >
        <Icon name="play" className="size-4" />
        Iniciar foco
      </Button>

      <button
        type="button"
        onClick={() => {
          focus.start({ axis, label, plannedMin: duration, taskId: task?.id ?? null })
          focus.setImmersive(true)
        }}
        className="mt-2 w-full rounded-lg px-3 py-2 text-sm text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
      >
        Iniciar em modo sem distrações
      </button>

      <p className="tabular mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm text-ink-muted">
        <Icon name="relogio" className="size-4 text-ink-faint" />
        {minutesToday} minutos registrados hoje
      </p>

      {blocked.length > 0 ? (
        <UpgradeHint
          className="mt-3"
          message={`Sessões de ${blocked.join(' e ')} minutos fazem parte do PRO.`}
        />
      ) : null}
    </Panel>
  )
}
