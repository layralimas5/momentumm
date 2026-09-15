import { Link } from 'react-router-dom'
import { forecastLabel } from '@/domain/entities/forecast'
import type { ObjectiveView } from '@/presentation/planner/use-objectives'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { useComposer } from '@/presentation/planner/ComposerProvider'

/**
 * Previsão, gargalo e próxima ação: as três leituras que transformam o número
 * em decisão.
 *
 * Elas vêm juntas de propósito. "Fecha 12 dias depois do prazo" sozinho é uma
 * má notícia; ao lado do gargalo e da próxima ação, vira um caminho. Um painel
 * que só dá o diagnóstico ensina a pessoa a fechar o app.
 */
export function ForecastPanel({ view }: { readonly view: ObjectiveView }) {
  const composer = useComposer()
  const { forecast, plan } = view
  const objective = plan.objective

  return (
    <Panel>
      <PanelHeader
        title="Previsão"
        icon="calendario"
        hint="Pelo ritmo recente. Não é promessa."
      />

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {forecastLabel(forecast)}
        </p>
        {forecast.kind === 'estimado' ? (
          <Tag tone={forecast.daysLate > 0 ? 'warn' : 'positive'}>
            {forecast.daysLate > 0
              ? `${forecast.daysLate} ${forecast.daysLate === 1 ? 'dia' : 'dias'} depois do prazo`
              : 'Dentro do prazo'}
          </Tag>
        ) : null}
        {/*
          A confiança fica visível quando é baixa. Uma previsão de três dias de
          série não pode aparecer com o mesmo peso de uma com dois meses.
        */}
        {forecast.kind === 'estimado' && forecast.confidence === 'baixa' ? (
          <Tag>Confiança baixa</Tag>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-ink-muted">{forecast.message}</p>

      {plan.bottleneck ? (
        <div className="mt-4 rounded-xl border border-flame/25 bg-flame-dim/30 px-3.5 py-3">
          <p className="text-xs font-medium tracking-wide text-flame uppercase">Gargalo</p>
          <p className="mt-1.5 text-sm text-ink">
            A etapa <span className="font-medium">{plan.bottleneck.stage.title}</span> vale{' '}
            {plan.bottleneck.stage.weight}% do objetivo e concentra{' '}
            {plan.bottleneck.overdueTasks.length > 0
              ? `${plan.bottleneck.overdueTasks.length} ${plan.bottleneck.overdueTasks.length === 1 ? 'ação atrasada' : 'ações atrasadas'}`
              : 'o trabalho parado'}
            .
          </p>
        </div>
      ) : null}

      {plan.nextTask ? (
        <div className="mt-4 rounded-xl border border-line bg-surface-hi/50 px-3.5 py-3">
          <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
            Próxima ação
          </p>
          <p className="mt-1.5 text-sm text-ink">{plan.nextTask.title}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {plan.currentStage
              ? `Etapa: ${plan.currentStage.stage.title}`
              : 'Sem etapa definida'}{' '}
            · {plan.nextTask.estimatedMin} min
          </p>
          <Link
            to="/app/foco"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-ink transition-colors hover:text-brand-hi"
          >
            Abrir o foco
            <Icon name="seta" className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-line-hi px-3.5 py-3">
          <p className="text-sm text-ink-muted">
            Nenhuma ação em aberto nesse objetivo. Sem próximo passo, ele para de andar.
          </p>
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            onClick={() => composer.open('acao', { presetObjectiveId: objective.id })}
          >
            <Icon name="mais" className="size-4" />
            Criar a próxima ação
          </Button>
        </div>
      )}
    </Panel>
  )
}
