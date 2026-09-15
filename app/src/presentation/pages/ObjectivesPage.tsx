import { Link } from 'react-router-dom'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { deadlineLabelOf, OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { ObjectiveStateTag, PriorityTag } from '@/presentation/components/shared/Meta'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, ProgressBar, Tag } from '@/presentation/components/ui/Surface'
import { AiEntryLink } from '@/presentation/ai/AiBits'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
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
 *
 * E ela vem com o botão que a coloca no dia. Marcar um objetivo como "parado
 * há mais de uma semana" e não oferecer a saída é diagnóstico sem tratamento:
 * a pessoa fica sabendo que travou e continua sem saber por onde destravar.
 */
export function ObjectivesPage() {
  const planner = usePlanner()
  const views = useObjectives()
  const composer = useComposer()

  const running = views.filter((view) => view.progress.state === 'em-andamento' || view.progress.state === 'nao-iniciado')
  const paused = views.filter((view) => view.progress.state === 'pausado')
  const done = views.filter((view) => view.progress.state === 'concluido')

  const limit = planner.usage.objectives

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Objetivos"
        description="Onde você quer chegar, com prazo."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {planner.limits.ai && !limit.reached ? (
              <AiEntryLink
                enabled
                label="Criar plano com IA"
                to="/app/ia?funcao=plano"
              />
            ) : null}
            <Button onClick={() => composer.open('objetivo')} disabled={limit.reached}>
              <Icon name="mais" className="size-4" />
              Novo objetivo
            </Button>
          </div>
        }
      />

      {planner.error ? <ErrorNote message={planner.error} /> : null}
      {limit.message ? <UpgradeHint message={limit.message} /> : null}
      {!planner.limits.ai && !limit.reached ? (
        <UpgradeHint message="Criar plano com IA: o objetivo vira etapas, hábitos e ações que cabem no teu tempo. Faz parte do PRO." />
      ) : null}

      {planner.loading && views.length === 0 ? (
        <LoadingBlock label="Carregando os objetivos" />
      ) : views.length === 0 ? (
        <EmptyState
          title="Nenhum objetivo ainda"
          description="Começa por um só. Objetivo com prazo vira plano."
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
          value={view.ratio}
          label={`Progresso de ${objective.title}`}
          color={axis.colorToken}
        />
        <span className="tabular shrink-0 text-sm font-semibold text-ink">
          {Math.round(view.ratio * 100)}%
        </span>
      </div>

      {/* O que a barra mede vem escrito: com plano ela mede execução, sem
          plano ela cai no volume. Uma barra sem legenda é uma barra que anda
          sozinha. */}
      <p className="mt-2 text-xs text-ink-faint">
        {view.ratioSource === 'plano'
          ? `${view.plan.stages.filter((item) => item.stage.status === 'concluida').length} de ${view.plan.stages.length} etapas · ${formatUnit(axis, view.progress.done)} registradas`
          : `${formatUnit(axis, view.progress.done)} de ${objective.target} · sem etapas ainda`}
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

      {view.nextTask ? <NextStep view={view} /> : null}
    </Panel>
  )
}

/**
 * A próxima ação do objetivo, com a ponte pro dia.
 *
 * Era só texto. O caminho entre "o plano diz que é isso" e "hoje eu faço
 * isso" passava por abrir o objetivo, achar a ação e editar a data — três
 * telas pra uma decisão que cabe em um toque, e é justamente a decisão que
 * tira um objetivo parado da inércia.
 */
function NextStep({ view }: { readonly view: ObjectiveView }) {
  const planner = usePlanner()
  const task = view.nextTask
  const bring = useAsyncAction(async (id: string) => {
    await planner.updateTask(id, { day: planner.today })
  })

  if (!task) return null

  const today = task.day <= planner.today
  const running = view.progress.state === 'em-andamento' || view.progress.state === 'nao-iniciado'

  return (
    <div className="mt-3 rounded-lg bg-surface-hi px-3 py-2">
      <p className="truncate text-xs text-ink-muted">
        <span className="text-ink-faint">Próxima ação: </span>
        {task.title}
      </p>

      {today || !running ? (
        <p className="mt-1 text-xs text-ink-faint">
          {running ? 'Já está no teu dia de hoje.' : 'Retomar o objetivo devolve ela pro teu dia.'}
        </p>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 -ml-2"
          loading={bring.running}
          onClick={() => void bring.run(task.id)}
        >
          <Icon name="calendario" className="size-3.5" />
          Trazer pra hoje
        </Button>
      )}

      <div aria-live="polite" className="min-h-4">
        {bring.error ? <p className="text-xs text-danger">{bring.error}</p> : null}
      </div>
    </div>
  )
}
