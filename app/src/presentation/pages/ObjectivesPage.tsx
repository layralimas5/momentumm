import { Link } from 'react-router-dom'
import { activityType, formatUnit } from '@/domain/entities/activity-type'
import { deadlineLabelOf, OBJECTIVE_STATUS_LABELS } from '@/domain/entities/objective'
import { overviewOf } from '@/domain/entities/objectives-overview'
import { ObjectivesEmpty } from '@/presentation/components/objective/ObjectivesEmpty'
import { ObjectivesOverviewTiles } from '@/presentation/components/objective/ObjectivesOverviewTiles'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
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
  const overview = overviewOf(
    views.map((view) => ({ ratio: view.ratio, progress: view.progress })),
  )

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

      {planner.error ? (
        <ErrorNote message={planner.error} onRetry={() => void planner.reload()} />
      ) : null}

      {/*
        Como estou, antes de como está cada um.

        Some quando não há objetivo ativo: três zeros em cima de uma tela vazia
        é o oposto de um convite.
      */}
      <ObjectivesOverviewTiles overview={overview} />

      {/*
        O aviso de limite só quando ele ENCOSTA.

        Ele era permanente, e abria a tela contando o que a conta não pode
        fazer — antes mesmo de a pessoa ver o que ela já fez. Um teto que só
        vale no terceiro objetivo não precisa aparecer no primeiro.
      */}
      {limit.reached && limit.message ? <UpgradeHint message={limit.message} /> : null}

      {planner.loading && views.length === 0 ? (
        <LoadingBlock label="Carregando os objetivos" />
      ) : views.length === 0 ? (
        <ObjectivesEmpty onCreate={() => composer.open('objetivo')} />
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

/**
 * Um objetivo na lista.
 *
 * Tinha NOVE blocos: título, área, prazo, selo de estado, selo de prioridade,
 * barra, porcentagem, legenda da barra, parágrafo de diagnóstico, rodapé com
 * hábitos e ações, e a próxima ação. Três objetivos assim são vinte e sete
 * blocos numa tela — e boa parte deles dizia a mesma coisa duas vezes:
 * "Atrasado" aparecia no parágrafo E no rodapé, "Em andamento" repetia o
 * título da própria seção, e o progresso vinha em quatro formatos.
 *
 * Agora são quatro, e cada um responde uma pergunta diferente:
 *
 *   o que é          título, área e prazo
 *   como vai         barra, porcentagem e o que ela mede
 *   precisa de mim?  só quando precisa — atrasado ou parado
 *   e agora?         a próxima ação, com o botão que a traz pro dia
 *
 * O diagnóstico em frase não sumiu: ele abre a tela do objetivo, que é onde a
 * pessoa chega pra decidir e onde a frase tem espaço pra ser lida.
 */
function ObjectiveCard({ view }: { readonly view: ObjectiveView }) {
  const { objective } = view.progress
  const axis = activityType(objective.axis)
  const dimmed = view.progress.state === 'pausado' || view.progress.state === 'concluido'

  /*
    O estado só aparece quando muda alguma coisa.

    "Em andamento" repete o título da seção que já contém o card, e um selo
    que está em todos os cards não distingue card nenhum. Sobra o que pede
    ação: atrasado, vencido, parado há uma semana.
  */
  const alerta =
    view.progress.state === 'pausado' || view.progress.state === 'concluido'
      ? null
      : view.stalled
        ? 'Parado há mais de uma semana'
        : view.progress.status === 'atrasado' || view.progress.status === 'vencido'
          ? OBJECTIVE_STATUS_LABELS[view.progress.status]
          : null

  return (
    <Panel className={`flex h-full flex-col ${dimmed ? 'opacity-75' : ''}`}>
      <Link
        to={`/app/objetivos/${objective.id}`}
        className="group flex items-start justify-between gap-3"
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-ink transition-colors group-hover:text-brand-ink">
            {objective.title}
          </span>
          <span className="mt-1 block text-xs text-ink-faint">
            {axis.label} · {deadlineLabelOf(view.progress)}
            {objective.priority === 'alta' ? ' · prioridade alta' : ''}
          </span>
        </span>
        <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
      </Link>

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
          plano ela cai no volume. Uma barra sem legenda anda sozinha. */}
      <p className="mt-2 text-xs text-ink-faint">
        {view.ratioSource === 'plano'
          ? `${view.plan.stages.filter((item) => item.stage.status === 'concluida').length} de ${view.plan.stages.length} etapas · ${view.doneTasks}/${view.tasks.length} ações`
          : `${formatUnit(axis, view.progress.done)} de ${objective.target} · sem etapas ainda`}
      </p>

      {alerta ? (
        <p className="mt-3">
          <Tag tone="warn">{alerta}</Tag>
        </p>
      ) : null}

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
