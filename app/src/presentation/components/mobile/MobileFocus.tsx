import { activityType } from '@/domain/entities/activity-type'
import type { CapacityProfile } from '@/domain/entities/checkin'
import type { PlanLimits } from '@/domain/entities/plan'
import type { Task } from '@/domain/entities/task'
import { formatElapsed } from '@/domain/entities/timer'
import { useFocus } from '@/presentation/focus/use-focus'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProgressBar } from '@/presentation/components/ui/Surface'
import { MobileSection } from './MobileSection'

interface MobileFocusProps {
  readonly task: Task | null
  readonly capacity: CapacityProfile
  readonly minutesToday: number
  readonly limits: PlanLimits
  readonly onNeedPro: (feature: string) => void
}

const ALL_DURATIONS = [15, 25, 45, 60] as const

/**
 * Card de foco no celular.
 *
 * Compacto: ação, duração e um botão. A escolha da duração já vem calibrada
 * pela capacidade do dia, então em geral é só tocar em "Iniciar foco" — a
 * sessão em si acontece na tela imersiva, não aqui.
 */
export function MobileFocus({
  task,
  capacity,
  minutesToday,
  limits,
  onNeedPro,
}: MobileFocusProps) {
  const focus = useFocus()
  const session = focus.session

  if (session) {
    const type = activityType(session.type)
    return (
      <MobileSection title="Foco em andamento" icon="foco">
        <div className="surface-brand edge-light p-4">
          <p className="truncate text-sm text-ink-muted">{session.label ?? type.label}</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">
            {formatElapsed(focus.elapsed)}
          </p>

          {session.plannedMin ? (
            <ProgressBar
              className="mt-3"
              value={focus.plannedRatio}
              label={`Progresso da sessão de ${session.plannedMin} minutos`}
            />
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button size="lg" className="h-12 flex-1" onClick={() => focus.setImmersive(true)}>
              <Icon name="play" className="size-4" />
              Voltar pro foco
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-12 w-12 px-0"
              onClick={focus.running ? focus.pause : focus.resume}
            >
              <Icon name={focus.running ? 'pausa' : 'play'} className="size-4" />
              <span className="sr-only">{focus.running ? 'Pausar' : 'Retomar'}</span>
            </Button>
          </div>
        </div>
      </MobileSection>
    )
  }

  const axis = task?.axis ?? 'estudo'
  const label = task?.title ?? 'Sessão livre de foco'
  const suggested = capacity.suggestedFocusMin

  return (
    <MobileSection title="Sessão de foco" icon="foco">
      <div className="surface-card p-4">
        <p className="line-clamp-2 text-sm">
          <span className="text-ink-faint">Vai executar: </span>
          <span className="text-ink">{label}</span>
        </p>

        <div
          role="group"
          aria-label="Duração da sessão"
          className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ALL_DURATIONS.map((value) => {
            const locked = !limits.focusDurations.includes(value)
            const selected = value === suggested && !locked
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  locked
                    ? onNeedPro(`Sessões de ${value} minutos`)
                    : focus.start({ axis, label, plannedMin: value, taskId: task?.id ?? null })
                }
                className={[
                  'tabular flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand bg-brand-dim/60 text-ink'
                    : 'border-line bg-surface-hi/60 text-ink-muted active:bg-surface-top',
                ].join(' ')}
              >
                {value} min
                {locked ? <Icon name="raio" className="size-3.5 text-brand-hi" /> : null}
              </button>
            )
          })}
        </div>

        <Button
          size="lg"
          className="mt-3 h-13 w-full"
          onClick={() => {
            focus.start({ axis, label, plannedMin: suggested, taskId: task?.id ?? null })
            focus.setImmersive(true)
          }}
        >
          <Icon name="play" className="size-4" />
          Iniciar foco de {suggested} min
        </Button>

        <p className="tabular mt-3 flex items-center gap-2 text-sm text-ink-faint">
          <Icon name="relogio" className="size-4" />
          {minutesToday} minutos focados hoje
        </p>
      </div>
    </MobileSection>
  )
}
