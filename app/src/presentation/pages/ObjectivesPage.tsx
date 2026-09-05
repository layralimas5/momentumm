import { Link } from 'react-router-dom'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { deadlineLabelOf, OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { ObjectiveStateTag, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useObjectives, type ObjectiveView } from '@/presentation/planner/use-objectives'
import { PageHeader } from './PageHeader'

/**
 * Objetivos.
 *
 * A lista responde três coisas por cartão: onde está, quanto falta e o que
 * fazer agora. Um objetivo sem próxima ação visível é um objetivo que a pessoa
 * vai olhar e fechar a aba — por isso a próxima ação vem no cartão, não só no
 * detalhe.
 */
export function ObjectivesPage() {
  const planner = usePlanner()
  const views = useObjectives()
  const composer = useComposer()

  const running = views.filter((view) => view.progress.state === 'em-andamento' || view.progress.state === 'nao-iniciado')
  const paused = views.filter((view) => view.progress.state === 'pausado')
  const done = views.filter((view) => view.progress.state === 'concluido')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Objetivos"
        description="O que você quer conquistar, com prazo. É daqui que sai o plano — meta sem destino vira lista de tarefas."
        action={
          <Button onClick={() => composer.open('objetivo')}>
            <Icon name="mais" className="size-4" />
            Novo objetivo
          </Button>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}

      {planner.loading && views.length === 0 ? (
        <LoadingBlock label="Carregando os objetivos" />
      ) : views.length === 0 ? (
        <EmptyState
          title="Nenhum objetivo ainda"
          description="Começa por um só. Um objetivo com prazo vira plano; três ao mesmo tempo viram uma lista que ninguém executa."
          action={
            <Button onClick={() => composer.open('objetivo')}>
              <Icon name="mais" className="size-4" />
              Criar meu primeiro objetivo
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Group title="Em andamento" views={running} />
          <Group title="Pausados" views={paused} hint="Continuam aqui e param de cobrar o dia." />
          <Group title="Concluídos" views={done} />
        </div>
      )}
    </div>
  )
}

function Group({
  title,
  views,
  hint,
}: {
  readonly title: string
  readonly views: readonly ObjectiveView[]
  readonly hint?: string
}) {
  if (views.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {title} <span className="tabular text-ink-faint">({views.length})</span>
        </h3>
        {hint ? <p className="mt-1 text-sm text-ink-faint">{hint}</p> : null}
      </div>

      <ul className="grid gap-4 xl:grid-cols-2">
        {views.map((view) => (
          <li key={view.progress.objective.id}>
            <ObjectiveCard view={view} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ObjectiveCard({ view }: { readonly view: ObjectiveView }) {
  const { objective } = view.progress
  const axis = activityType(objective.axis)
  const dimmed = view.progress.state === 'pausado' || view.progress.state === 'concluido'

  return (
    <Panel className={`flex h-full flex-col ${dimmed ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/app/objetivos/${objective.id}`}
            className="block truncate text-base font-semibold text-ink transition-colors hover:text-brand-ink"
          >
            {objective.title}
          </Link>
          <p className="mt-1 text-xs text-ink-faint">
            {axis.label} · {deadlineLabelOf(view.progress)}
          </p>
        </div>
        <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ObjectiveStateTag state={view.progress.state} />
        <PriorityTag priority={objective.priority} />
        {view.stalled ? <Tag tone="warn">Parado há mais de uma semana</Tag> : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ProgressBar
          className="flex-1"
          value={view.progress.ratio}
          label={`Progresso de ${objective.title}`}
          color={axis.colorToken}
        />
        <span className="tabular shrink-0 text-sm font-semibold text-ink">
          {Math.round(view.progress.ratio * 100)}%
        </span>
      </div>

      <p className="mt-2 text-xs text-ink-faint">
        {formatUnit(axis, view.progress.done)} de {objective.target}
      </p>

      {view.progress.state === 'concluido' ? null : (
        <p className="mt-3 text-pretty text-sm text-ink-muted">{view.progress.summary}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4 text-xs text-ink-faint">
        <span>
          {view.habits.length} {view.habits.length === 1 ? 'hábito' : 'hábitos'}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {view.doneTasks}/{view.tasks.length} ações
        </span>
        {/* Pausado não mostra leitura de ritmo: pausar existe pra parar de cobrar. */}
        {view.progress.state === 'concluido' || view.progress.state === 'pausado' ? null : (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-ink-muted">
              {OBJECTIVE_STATUS_LABELS[view.progress.status]}
            </span>
          </>
        )}
      </div>

      {view.nextTask ? (
        <p className="mt-3 truncate rounded-lg bg-surface-hi px-3 py-2 text-xs text-ink-muted">
          <span className="text-ink-faint">Próxima ação: </span>
          {view.nextTask.title}
        </p>
      ) : null}
    </Panel>
  )
}
