import { Link } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { useAdmin } from '../admin-context'
import {
  AdminPage,
  BarList,
  Metric,
  MetricGrid,
  PeriodPicker,
  QueryState,
  Section,
  Sparkline,
  StatusTag,
  Table,
  Td,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

const KIND_LABELS: Readonly<Record<string, string>> = {
  plan: 'Planos criados',
  day: 'Dias reorganizados',
  progress: 'Leituras de progresso',
  review: 'Resumos de review',
  review_draft: 'Reviews preparados',
  recovery: 'Modos de Retomada',
}

interface AiLimits {
  readonly enabled?: boolean
  readonly monthlyPerPlan?: { readonly free?: number; readonly pro?: number }
  readonly dailySafetyLimit?: number
  readonly perMinute?: number
  readonly costAlertUsd?: number
  readonly kinds?: Record<string, boolean>
}

export function AdminAiPage() {
  const admin = useAdmin()
  const { period } = usePeriod()
  const query = useAdminQuery(() => container.admin.aiMetrics(period), `${period.from}|${period.to}`)
  const data = query.data
  const limits = (data?.limits ?? null) as AiLimits | null
  const costOverAlert =
    data?.estimated_cost_usd !== null && data?.estimated_cost_usd !== undefined && limits?.costAlertUsd !== undefined
      ? data.estimated_cost_usd >= limits.costAlertUsd
      : false

  return (
    <AdminPage
      title="Momentumm AI"
      description="Uso, custo, tempo de resposta e falhas da IA. Só metadados: nenhum prompt, resposta ou contexto é guardado em lugar nenhum."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            <StatusTag tone={limits?.enabled === false ? 'warn' : 'positive'}>
              IA {limits?.enabled === false ? 'desligada' : 'ligada'}
            </StatusTag>
            {limits?.monthlyPerPlan ? (
              <StatusTag>Franquia PRO: {limits.monthlyPerPlan.pro ?? '—'}/mês</StatusTag>
            ) : null}
            {limits?.dailySafetyLimit ? <StatusTag>Teto diário: {limits.dailySafetyLimit}</StatusTag> : null}
            {data.blocks_active > 0 ? <StatusTag tone="danger">{data.blocks_active} conta(s) bloqueada(s)</StatusTag> : null}
            {costOverAlert ? <StatusTag tone="danger">Custo acima do alerta</StatusTag> : null}
          </div>

          <MetricGrid cols={5}>
            <Metric label="Pessoas que usaram" value={data.users} />
            <Metric label="Chamadas concluídas" value={data.calls} />
            <Metric label="Por pessoa" value={data.calls_per_user} />
            <Metric label="Taxa de sucesso" value={data.success_rate} format="percent" />
            <Metric label="Erros" value={data.errors} lowerIsBetter />
            <Metric label="Limites atingidos" value={data.limits_hit} />
            <Metric label="Bloqueadas" value={data.blocked} />
            <Metric label="Resposta média" value={data.avg_duration_ms} format="ms" />
            <Metric label="Resposta p95" value={data.p95_duration_ms} format="ms" />
            <Metric
              label="Custo estimado"
              value={data.estimated_cost_usd}
              format="usd"
              hint={data.estimated_cost_usd === null ? 'Configure as taxas por milhão de tokens' : undefined}
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Chamadas por dia">
              <Sparkline points={data.series.map((day) => day.calls)} label="Chamadas por dia" />
              <p className="mt-2 text-xs text-ink-faint tabular">
                {data.input_tokens.toLocaleString('pt-BR')} tokens de entrada · {data.output_tokens.toLocaleString('pt-BR')} de saída
              </p>
            </Section>
            <Section title="Por funcionalidade">
              <Table head={['Função', 'Concluídas', 'Erros', 'Limite', 'Média']}>
                {Object.entries(data.by_kind)
                  .sort((a, b) => b[1].ok - a[1].ok)
                  .map(([kind, stats]) => (
                    <tr key={kind}>
                      <Td>{KIND_LABELS[kind] ?? kind}</Td>
                      <Td className="tabular">{stats.ok}</Td>
                      <Td className="tabular">{stats.errors}</Td>
                      <Td className="tabular">{stats.limits}</Td>
                      <Td className="tabular">{stats.avg_ms === null ? '—' : `${Math.round(stats.avg_ms)} ms`}</Td>
                    </tr>
                  ))}
              </Table>
            </Section>
            <Section title="Erros por código">
              <BarList items={data.by_error} />
            </Section>
            <Section title="Modelo">
              <BarList items={data.by_model} />
            </Section>
          </div>

          {admin.can('settings.write') ? (
            <p className="text-sm text-ink-muted">
              Limite mensal por plano, teto diário, bloqueio por abuso, alerta de custo e disponibilidade das
              funções ficam em{' '}
              <Link to="/admin/configuracoes" className="text-brand-hi underline-offset-2 hover:underline">
                Configurações
              </Link>
              . Bloqueio por conta fica no detalhe do usuário.
            </p>
          ) : null}
        </>
      ) : null}
    </AdminPage>
  )
}
