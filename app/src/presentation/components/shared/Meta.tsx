import { Link } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import type { Objective, ObjectiveState } from '@/domain/entities/objective'
import { OBJECTIVE_STATE_LABELS } from '@/domain/entities/objective'
import { PRIORITY_LABELS, type Priority } from '@/domain/entities/priority'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'

/**
 * As etiquetas que aparecem em toda parte: prioridade, estado do objetivo e o
 * link de volta pro objetivo que uma ação ou hábito serve.
 *
 * Elas moram juntas de propósito. Objetivo, hábito, plano e o dia mostram a
 * mesma informação, e três desenhos diferentes pra "prioridade alta" fariam a
 * pessoa reaprender a tela a cada aba.
 */

export function PriorityTag({ priority }: { readonly priority: Priority }) {
  // Só a alta ganha destaque. Se as três chamassem atenção, nenhuma chamaria.
  if (priority === 'media') return null

  return (
    <Tag tone={priority === 'alta' ? 'warn' : 'neutral'}>
      {priority === 'alta' ? <Icon name="raio" className="size-3.5" /> : null}
      {PRIORITY_LABELS[priority]}
    </Tag>
  )
}

const STATE_TONES: Record<ObjectiveState, 'neutral' | 'brand' | 'positive' | 'warn'> = {
  'nao-iniciado': 'neutral',
  'em-andamento': 'brand',
  pausado: 'neutral',
  concluido: 'positive',
  arquivado: 'neutral',
}

export function ObjectiveStateTag({ state }: { readonly state: ObjectiveState }) {
  return (
    <Tag tone={STATE_TONES[state]}>
      {state === 'pausado' ? <Icon name="pausa" className="size-3.5" /> : null}
      {state === 'concluido' ? <Icon name="check" className="size-3.5" /> : null}
      {OBJECTIVE_STATE_LABELS[state]}
    </Tag>
  )
}

/**
 * O objetivo que uma ação ou hábito empurra, como link.
 *
 * É a peça que responde "pra que serve isso" sem obrigar a pessoa a sair da
 * tela pra descobrir — e é ela que separa o Momentumm de uma lista de tarefas.
 */
export function ObjectiveLink({
  objective,
  className,
}: {
  readonly objective: Objective | undefined
  readonly className?: string
}) {
  if (!objective) return null
  const axis = activityType(objective.axis)

  return (
    <Link
      to={`/app/objetivos/${objective.id}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md text-xs text-ink-faint transition-colors hover:text-ink-muted ${className ?? ''}`}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: axis.colorToken }}
      />
      <span className="truncate">{objective.title}</span>
    </Link>
  )
}
