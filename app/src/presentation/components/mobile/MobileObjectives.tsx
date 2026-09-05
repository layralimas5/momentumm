import { activityType, formatUnit } from '@/domain/entities/activity-type'
import {
  deadlineLabelOf,
  OBJECTIVE_STATUS_LABELS,
  type ObjectiveProgress,
  type ObjectiveStatus,
} from '@/domain/entities/objective'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { MobileSection } from './MobileSection'

interface MobileObjectivesProps {
  readonly objectives: readonly ObjectiveProgress[]
  readonly onCreate: () => void
  readonly onOpenReview: () => void
}

/**
 * Progresso dos objetivos no celular.
 *
 * Aqui a barra de prazo importa mais ainda: na tela pequena não cabe a tabela
 * inteira, e o risco cinza é o que responde "estou atrasada?" sem ler número
 * nenhum.
 */
export function MobileObjectives({ objectives, onCreate, onOpenReview }: MobileObjectivesProps) {
  if (objectives.length === 0) {
    return (
      <MobileSection title="Meus objetivos" icon="trofeu">
        <div className="surface-card p-4">
          <p className="text-sm text-ink-muted">
            Nenhum objetivo com prazo. Sem data pra fechar, o hábito vira rotina sem destino.
          </p>
          <Button size="md" variant="secondary" className="mt-3 h-12 w-full" onClick={onCreate}>
            <Icon name="mais" className="size-4" />
            Definir objetivo
          </Button>
        </div>
      </MobileSection>
    )
  }

  return (
    <MobileSection
      title="Meus objetivos"
      icon="trofeu"
      action={{ label: 'Ver a semana', onClick: onOpenReview }}
    >
      <ul className="flex flex-col gap-3">
        {objectives.map((progress) => {
          const type = activityType(progress.objective.axis)
          const elapsedPercent = Math.round(progress.elapsed * 100)

          return (
            <li key={progress.objective.id} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-ink">{progress.objective.title}</p>
                {/* Pausado mostra o estado, não o ritmo: cobrar prazo de um
                    objetivo que a pessoa suspendeu é o oposto de pausar. */}
                {progress.state === 'pausado' ? (
                  <Tag>Pausado</Tag>
                ) : (
                  <Tag tone={statusTone(progress.status)}>
                    {OBJECTIVE_STATUS_LABELS[progress.status]}
                  </Tag>
                )}
              </div>

              <p className="mt-1 text-sm text-ink-faint">
                {formatUnit(type, progress.done)} de {progress.objective.target} ·{' '}
                {deadlineLabelOf(progress)}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex-1">
                  <ProgressBar
                    value={progress.ratio}
                    label={`Progresso de ${progress.objective.title}`}
                    color={
                      progress.status === 'concluido' ? 'var(--color-positive)' : type.colorToken
                    }
                  />
                  {progress.status !== 'concluido' ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-1.5 w-px bg-ink-faint"
                      style={{ left: `${Math.min(100, elapsedPercent)}%` }}
                    />
                  ) : null}
                </div>
                <span className="tabular shrink-0 text-sm text-ink-muted">
                  {Math.round(progress.ratio * 100)}%
                </span>
              </div>

              <p className="mt-3 text-sm text-pretty text-ink-muted">{progress.summary}</p>
            </li>
          )
        })}
      </ul>
    </MobileSection>
  )
}

function statusTone(status: ObjectiveStatus): 'positive' | 'neutral' | 'warn' {
  if (status === 'concluido' || status === 'no-prazo') return 'positive'
  if (status === 'atrasado' || status === 'vencido') return 'warn'
  return 'neutral'
}
