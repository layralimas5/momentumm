import { activityType, formatUnit } from '@/domain/entities/activity-type'
import {
  deadlineLabelOf,
  OBJECTIVE_STATUS_LABELS,
  type ObjectiveProgress,
  type ObjectiveStatus,
} from '@/domain/entities/objective'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, ProgressBar, Tag } from '@/presentation/components/ui/Surface'

interface ObjectivesCardProps {
  readonly objectives: readonly ObjectiveProgress[]
  readonly onCreate: () => void
  readonly onOpenReview: () => void
}

/**
 * Progresso dos objetivos.
 *
 * Fica acima das metas de propósito: a meta é o ritmo da semana, o objetivo é o
 * destino. Quando os dois competem por atenção, é o destino que precisa ganhar,
 * senão a pessoa cumpre a rotina e nunca chega em lugar nenhum.
 *
 * O card mostra sempre as duas leituras juntas — o quanto já foi feito e o
 * quanto do prazo já passou. Progresso sem prazo consola; prazo sem progresso
 * assusta. Só os dois juntos fazem decidir.
 */
export function ObjectivesCard({ objectives, onCreate, onOpenReview }: ObjectivesCardProps) {
  return (
    <Panel aria-labelledby="objetivos-titulo">
      <PanelHeader
        id="objetivos-titulo"
        title="Meus objetivos"
        icon="trofeu"
        action={
          objectives.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onOpenReview}>
              Ver a semana
              <Icon name="seta" className="size-3.5" />
            </Button>
          ) : null
        }
      />

      {objectives.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nenhum objetivo com prazo"
            description="Objetivo é o que dá direção pro hábito. Sem data pra fechar, tudo vira rotina sem destino."
            action={
              <Button size="sm" onClick={onCreate}>
                <Icon name="mais" className="size-4" />
                Definir objetivo
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {objectives.map((progress) => (
            <ObjectiveRow key={progress.objective.id} progress={progress} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function ObjectiveRow({ progress }: { readonly progress: ObjectiveProgress }) {
  const { objective } = progress
  const type = activityType(objective.axis)
  const percent = Math.round(progress.ratio * 100)
  const elapsedPercent = Math.round(progress.elapsed * 100)

  return (
    <li className="rounded-xl border border-line bg-surface-hi/50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{objective.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {formatUnit(type, progress.done)} de {objective.target} · {deadlineLabelOf(progress)}
          </p>
        </div>
        <Tag tone={statusTone(progress.status)} color={type.colorToken}>
          {OBJECTIVE_STATUS_LABELS[progress.status]}
        </Tag>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative flex-1">
          <ProgressBar
            value={progress.ratio}
            label={`Progresso de ${objective.title}`}
            color={progress.status === 'concluido' ? 'var(--color-positive)' : type.colorToken}
          />
          {/*
            A marca do prazo. É ela que transforma a barra em decisão: ficar
            atrás do risco é a única definição honesta de "atrasado".
          */}
          {progress.status !== 'concluido' ? (
            <span
              aria-hidden="true"
              className="absolute top-0 h-1.5 w-px bg-ink-faint"
              style={{ left: `${Math.min(100, elapsedPercent)}%` }}
            />
          ) : null}
        </div>
        <span className="tabular shrink-0 text-xs text-ink-muted">{percent}%</span>
      </div>

      <p className="mt-2.5 text-xs text-pretty text-ink-muted">{progress.summary}</p>

      {objective.motive ? (
        <p className="mt-2 border-l-2 border-line-hi pl-2.5 text-xs text-pretty text-ink-faint italic">
          {objective.motive}
        </p>
      ) : null}
    </li>
  )
}

function statusTone(status: ObjectiveStatus): 'positive' | 'neutral' | 'warn' {
  if (status === 'concluido' || status === 'no-prazo') return 'positive'
  if (status === 'atrasado' || status === 'vencido') return 'warn'
  return 'neutral'
}
