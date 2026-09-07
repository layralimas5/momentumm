import { Link } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import type { Objective, ObjectiveState } from '@/domain/entities/objective'
import { OBJECTIVE_STATE_LABELS } from '@/domain/entities/objective'
import {
  STAGE_STATUS_LABELS,
  type StageViewStatus,
} from '@/domain/entities/plan-stage'
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
  readonly className?: string | undefined
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

/**
 * O caminho de um item: papel, etapa e objetivo, numa linha só.
 *
 * É a peça que faz o dia parar de ser uma lista de tarefas. "Finalizar
 * onboarding" não diz nada sozinho; "Ação prioritária · Etapa: MVP · Objetivo:
 * Lançar meu SaaS" diz por que ela está na tela hoje. Ela vive aqui, junto das
 * outras etiquetas, porque aparece no dashboard, no plano, no foco e no
 * celular — e três desenhos diferentes pro mesmo caminho fariam a pessoa
 * reaprender a tela a cada aba.
 */
export function ContextLine({
  role,
  stage,
  objective,
  className,
}: {
  /** O papel do item: "Ação prioritária", "Hábito de apoio". */
  readonly role?: string | undefined
  readonly stage?: string | null | undefined
  readonly objective?: Objective | undefined
  readonly className?: string | undefined
}) {
  if (!role && !stage && !objective) return null

  return (
    <p
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-faint ${className ?? ''}`}
    >
      {role ? <span className="text-ink-muted">{role}</span> : null}
      {role && (stage || objective) ? <span aria-hidden="true">·</span> : null}
      {stage ? <span>Etapa: {stage}</span> : null}
      {stage && objective ? <span aria-hidden="true">·</span> : null}
      {objective ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          Objetivo:
          <ObjectiveLink objective={objective} />
        </span>
      ) : null}
    </p>
  )
}

const STAGE_TONES: Record<StageViewStatus, 'neutral' | 'brand' | 'positive' | 'warn'> = {
  'nao-iniciada': 'neutral',
  'em-andamento': 'brand',
  concluida: 'positive',
  pausada: 'neutral',
  atrasada: 'warn',
}

export function StageStatusTag({ status }: { readonly status: StageViewStatus }) {
  return (
    <Tag tone={STAGE_TONES[status]}>
      {status === 'concluida' ? <Icon name="check" className="size-3.5" /> : null}
      {status === 'pausada' ? <Icon name="pausa" className="size-3.5" /> : null}
      {STAGE_STATUS_LABELS[status]}
    </Tag>
  )
}
