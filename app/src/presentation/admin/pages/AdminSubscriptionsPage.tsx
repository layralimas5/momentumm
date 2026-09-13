import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CANCEL_REASON_LABELS, type CancelReason } from '@/domain/support/support-request'
import { PLAN_LABELS } from '@/domain/entities/plan'
import { container } from '@/infrastructure/container'
import { Select } from '@/presentation/components/ui/Field'
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

const STATUS_LABELS: Readonly<Record<string, string>> = {
  trial: 'Em teste',
  ativa: 'Ativa',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
  inadimplente: 'Inadimplente',
}

const EVENT_LABELS: Readonly<Record<string, string>> = {
  criada: 'Novas assinaturas',
  trial_iniciado: 'Testes iniciados',
  trial_convertido: 'Testes convertidos',
  renovada: 'Renovações',
  upgrade: 'Upgrades',
  downgrade: 'Downgrades',
  pagamento_falhou: 'Falhas de pagamento',
  reembolso: 'Reembolsos',
  cancelada: 'Cancelamentos',
  vencida: 'Vencimentos',
  reativada: 'Reativações',
}

export function AdminSubscriptionsPage() {
  const admin = useAdmin()
  const { period } = usePeriod()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const metrics = useAdminQuery(() => container.admin.subscriptionMetrics(period), `${period.from}|${period.to}`)
  const list = useAdminQuery(
    () => (admin.can('users.read') ? container.admin.listSubscriptions(status || undefined, page) : Promise.resolve(null)),
    `${status}|${page}`,
  )
  const data = metrics.data

  return (
    <AdminPage
      title="Assinaturas e pagamentos"
      description="Estado das assinaturas, receita recorrente e eventos de cobrança. Dado de cartão não existe aqui: fica no provedor."
      action={<PeriodPicker />}
    >
      <QueryState loading={metrics.loading && !data} error={metrics.error} onRetry={() => void metrics.reload()} />

      {data ? (
        <>
          <Section title="Agora">
            <MetricGrid cols={5}>
              <Metric label="Gratuitos" value={data.free_users} />
              <Metric label="PRO" value={data.pro_users} />
              <Metric label="Conversão pra PRO" value={data.conversion_rate} format="percent" />
              <Metric label="MRR" value={data.mrr_cents} format="brl" />
              <Metric label="ARR" value={data.arr_cents} format="brl" />
              <Metric label="Ativas" value={data.by_status['ativa'] ?? 0} />
              <Metric label="Em teste" value={data.trials_active} />
              <Metric label="Canceladas" value={data.by_status['cancelada'] ?? 0} />
              <Metric label="Vencidas" value={data.by_status['vencida'] ?? 0} />
              <Metric label="Inadimplentes" value={data.by_status['inadimplente'] ?? 0} />
            </MetricGrid>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-card border border-line bg-surface p-4">
                <p className="text-xs text-ink-faint">Mensal x anual (ativas)</p>
                <BarList items={{ mensal: data.by_interval['mensal'] ?? 0, anual: data.by_interval['anual'] ?? 0 }} />
              </div>
              <div className="rounded-card border border-line bg-surface p-4">
                <p className="text-xs text-ink-faint">Novas por dia no período</p>
                <Sparkline points={data.series.map((day) => day.new)} label="Novas assinaturas por dia" className="mt-2" />
              </div>
            </div>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Eventos no período" hint="Escritos pelo webhook do provedor.">
              {Object.keys(data.events).length === 0 ? (
                <Empty title="Nenhum evento de cobrança" description="Sem provedor de pagamento conectado, esta lista fica vazia. Isso é dado real, não falha." />
              ) : (
                <BarList items={data.events} labelOf={(key) => EVENT_LABELS[key] ?? key} />
              )}
              <p className="mt-3 text-xs text-ink-faint">Conversões no período: {data.period_conversion}</p>
            </Section>
            <Section title="Motivos de cancelamento" hint="Escolhidos pela pessoa ao pedir o cancelamento.">
              <BarList items={data.cancel_reasons} labelOf={(key) => CANCEL_REASON_LABELS[key as CancelReason] ?? key} />
              <Link to="/admin/cancelamentos" className="mt-3 inline-block text-sm text-brand-hi underline-offset-2 hover:underline">
                Ver painel de cancelamentos
              </Link>
            </Section>
          </div>
        </>
      ) : null}

      {admin.can('users.read') ? (
        <Section
          title="Assinaturas"
          action={
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-9 w-40 text-xs">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          }
        >
          <QueryState loading={list.loading && !list.data} error={list.error} onRetry={() => void list.reload()} />
          {list.data && list.data.items.length === 0 ? (
            <Empty title="Nenhuma assinatura registrada" description="A tabela é preenchida pelo webhook do provedor de pagamento." />
          ) : null}
          {list.data && list.data.items.length > 0 ? (
            <>
              <Table head={['Conta', 'Provedor', 'Plano', 'Status', 'Valor', 'Início', 'Fim do período', 'Cancelada em']}>
                {list.data.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <Link to={`/admin/usuarios/${item.user_id}`} className="font-medium text-ink underline-offset-2 hover:underline">{item.user_name ?? item.user_id.slice(0, 8)}</Link>
                      <span className="block text-xs text-ink-faint">{item.email_masked}</span>
                    </Td>
                    <Td>{item.provider}</Td>
                    <Td>{PLAN_LABELS[item.plan]} · {item.interval}</Td>
                    <Td><StatusTag tone={item.status === 'ativa' ? 'positive' : item.status === 'inadimplente' ? 'danger' : 'neutral'}>{STATUS_LABELS[item.status] ?? item.status}</StatusTag></Td>
                    <Td className="tabular">{(item.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: item.currency })}</Td>
                    <Td className="tabular">{formatDate(item.started_at)}</Td>
                    <Td className="tabular">{formatDate(item.current_period_end)}</Td>
                    <Td className="tabular">{formatDate(item.canceled_at)}</Td>
                  </tr>
                ))}
              </Table>
              <Pager page={page} total={list.data.total} pageSize={25} onPage={setPage} />
            </>
          ) : null}
        </Section>
      ) : null}
    </AdminPage>
  )
}
