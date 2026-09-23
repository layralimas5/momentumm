import { useState } from 'react'
import type { ErrorFilters } from '@/domain/admin/admin-gateway'
import type { ErrorSeverity, ErrorStatus } from '@/domain/admin/admin-schemas'
import { ERROR_MODULES } from '@/domain/admin/privacy'
import { container } from '@/infrastructure/container'
import { Select } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useAdmin } from '../admin-context'
import {
  AdminPage,
  BarList,
  Empty,
  Metric,
  MetricGrid,
  Pager,
  PeriodPicker,
  QueryState,
  Section,
  Sparkline,
  StatusTag,
  Table,
  Td,
  formatDate,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

const STATUS_LABELS: Readonly<Record<ErrorStatus, string>> = {
  novo: 'Novo',
  analisando: 'Analisando',
  resolvido: 'Resolvido',
  ignorado: 'Ignorado',
}
const SEVERITY_LABELS: Readonly<Record<ErrorSeverity, string>> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}
const MODULE_LABELS: Readonly<Record<string, string>> = {
  app: 'App',
  auth: 'Autenticação',
  database: 'Banco',
  storage: 'Storage',
  edge_function: 'Edge Functions',
  ai: 'IA',
  payment: 'Pagamento',
  planner: 'Planner',
  share: 'Compartilhamento',
  admin: 'Painel',
}

export function AdminErrorsPage() {
  const admin = useAdmin()
  const { period } = usePeriod()
  /*
    Abre em produção de propósito.

    Rodar o app local apontando pro Supabase real grava erro de
    desenvolvimento aqui. Começar filtrado é o que impede a central de
    parecer cheia de problema quando o que tem é ruído da máquina de quem
    programa.
  */
  const [filters, setFilters] = useState<ErrorFilters>({ page: 1, environment: 'producao' })
  const metrics = useAdminQuery(() => container.admin.errorMetrics(period), `${period.from}|${period.to}`)
  const list = useAdminQuery(() => container.admin.listErrors(filters), JSON.stringify(filters))

  const update = useAsyncAction(async (id: string, status: ErrorStatus, severity?: ErrorSeverity) => {
    await container.admin.setErrorStatus(id, status, severity)
    await Promise.all([list.reload(), metrics.reload()])
  })

  return (
    <AdminPage
      title="Erros e saúde do sistema"
      description="Erros agrupados por assinatura. Pessoa afetada vira hash; mensagem entra sanitizada: sem e-mail, token, chave, prompt ou texto pessoal."
      action={<PeriodPicker />}
    >
      <QueryState loading={metrics.loading && !metrics.data} error={metrics.error} onRetry={() => void metrics.reload()} />

      {metrics.data ? (
        <>
          <MetricGrid cols={5}>
            <Metric label="Ocorrências" value={metrics.data.occurrences} lowerIsBetter />
            <Metric label="Pessoas afetadas" value={metrics.data.affected_users} hint="anonimizadas" />
            <Metric label="Falhas de autenticação" value={metrics.data.by_module['auth'] ?? 0} />
            <Metric label="Erros de banco" value={metrics.data.by_module['database'] ?? 0} />
            <Metric label="Edge Functions" value={metrics.data.by_module['edge_function'] ?? 0} />
            <Metric label="Storage" value={metrics.data.by_module['storage'] ?? 0} />
            <Metric label="Pagamento" value={metrics.data.payment_failures} />
            <Metric label="Falhas da IA" value={metrics.data.ai_failures} />
            <Metric label="Resposta média da IA" value={metrics.data.ai_avg_ms} format="ms" />
            <Metric label="Críticos por dia (máx.)" value={Math.max(0, ...metrics.data.series.map((day) => day.critical))} />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Ocorrências por dia">
              <Sparkline points={metrics.data.series.map((day) => day.occurrences)} label="Ocorrências por dia" color="var(--color-danger)" />
            </Section>
            <Section title="Por módulo">
              <BarList items={metrics.data.by_module} labelOf={(key) => MODULE_LABELS[key] ?? key} />
            </Section>
            <Section title="Por severidade">
              <BarList items={metrics.data.by_severity} labelOf={(key) => SEVERITY_LABELS[key as ErrorSeverity] ?? key} />
            </Section>
          </div>
        </>
      ) : null}

      <Section
        title="Central de erros"
        action={
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.environment ?? ''}
              onChange={(event) => setFilters({ ...filters, environment: event.target.value || undefined, page: 1 })}
              className="h-9 w-40 text-xs"
            >
              <option value="">Todo ambiente</option>
              <option value="producao">Produção</option>
              <option value="preview">Preview</option>
              <option value="desenvolvimento">Desenvolvimento</option>
            </Select>
            <Select value={filters.status ?? ''} onChange={(event) => setFilters({ ...filters, status: (event.target.value || undefined) as ErrorStatus | undefined, page: 1 })} className="h-9 w-36 text-xs">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={filters.severity ?? ''} onChange={(event) => setFilters({ ...filters, severity: (event.target.value || undefined) as ErrorSeverity | undefined, page: 1 })} className="h-9 w-36 text-xs">
              <option value="">Toda severidade</option>
              {Object.entries(SEVERITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Select value={filters.module ?? ''} onChange={(event) => setFilters({ ...filters, module: event.target.value || undefined, page: 1 })} className="h-9 w-36 text-xs">
              <option value="">Todo módulo</option>
              {ERROR_MODULES.map((module) => <option key={module} value={module}>{MODULE_LABELS[module] ?? module}</option>)}
            </Select>
          </div>
        }
      >
        <QueryState loading={list.loading && !list.data} error={list.error ?? update.error} onRetry={() => void list.reload()} />
        {list.data && list.data.items.length === 0 ? (
          <Empty title="Nenhum erro com esses filtros" description="Bom sinal, ou filtro estreito demais." />
        ) : null}
        {list.data && list.data.items.length > 0 ? (
          <>
            <Table head={['Última vez', 'Código', 'Módulo', 'Ambiente', 'Versão', 'Ocorr.', 'Pessoas', 'Severidade', 'Status', 'Mensagem']}>
              {list.data.items.map((error) => (
                <tr key={error.id}>
                  <Td className="tabular whitespace-nowrap">{formatDate(error.last_seen_at, true)}</Td>
                  <Td><code className="text-xs">{error.code}</code></Td>
                  <Td>{MODULE_LABELS[error.module] ?? error.module}</Td>
                  <Td>{error.environment}</Td>
                  <Td className="tabular">{error.app_version}</Td>
                  <Td className="tabular">{error.occurrences}</Td>
                  <Td className="tabular">{error.affected_users}</Td>
                  <Td>
                    {admin.can('errors.act') ? (
                      <Select value={error.severity} onChange={(event) => void update.run(error.id, error.status, event.target.value as ErrorSeverity)} className="h-8 w-28 text-xs">
                        {Object.entries(SEVERITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    ) : (
                      <StatusTag tone={error.severity === 'critica' ? 'danger' : error.severity === 'alta' ? 'warn' : 'neutral'}>{SEVERITY_LABELS[error.severity]}</StatusTag>
                    )}
                  </Td>
                  <Td>
                    {admin.can('errors.act') ? (
                      <Select value={error.status} onChange={(event) => void update.run(error.id, event.target.value as ErrorStatus)} className="h-8 w-32 text-xs">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    ) : (
                      <StatusTag>{STATUS_LABELS[error.status]}</StatusTag>
                    )}
                  </Td>
                  <Td className="max-w-md text-xs text-ink-muted">{error.message}</Td>
                </tr>
              ))}
            </Table>
            <Pager page={filters.page ?? 1} total={list.data.total} pageSize={25} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        ) : null}
      </Section>
    </AdminPage>
  )
}
