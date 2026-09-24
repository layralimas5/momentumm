import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FEATURE_LABELS, type ProductFeature } from '@/domain/analytics/product-events'
import { CANCEL_REASON_LABELS, type CancelReason } from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
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
  StatusTag,
  Table,
  Td,
  formatDate,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

const STATUS_LABELS = { solicitado: 'Solicitado', processado: 'Processado', retido: 'Retido' } as const

export function AdminCancellationsPage() {
  const admin = useAdmin()
  const { period } = usePeriod()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ id: string; status: keyof typeof STATUS_LABELS; retention: boolean } | null>(null)
  const query = useAdminQuery(() => container.admin.cancellations(period, page), `${period.from}|${period.to}|${page}`)
  const data = query.data

  return (
    <AdminPage
      title="Cancelamentos"
      description="Quem pediu pra sair, por quê, depois de quanto tempo e o que usava antes. O comentário livre só aparece pra owner e admin e some depois de 90 dias."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <MetricGrid cols={5}>
            <Metric label="Cancelamentos" value={data.count} />
            <Metric label="Taxa" value={data.rate} format="percent" hint="Sobre assinaturas ativas, em teste ou canceladas" />
            <Metric label="Tempo médio como assinante" value={data.avg_tenure_days} hint="dias" />
            <Metric label="Tentativas de retenção" value={data.retention_attempts} />
            <Metric label="Retidos" value={data.retained} />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Motivo informado">
              <BarList items={data.by_reason} labelOf={(key) => CANCEL_REASON_LABELS[key as CancelReason] ?? key} />
            </Section>
            <Section title="Recursos usados antes" hint="Nos 30 dias anteriores ao pedido.">
              <BarList items={data.features_before} labelOf={(key) => FEATURE_LABELS[key as ProductFeature] ?? key} />
            </Section>
            <Section title="Plano cancelado e hora do dia">
              <BarList items={data.by_plan_interval} />
              <div className="mt-4">
                <BarList items={Object.fromEntries(Object.entries(data.by_hour).map(([hour, value]) => [`${hour}h`, value]))} />
              </div>
            </Section>
          </div>

          {admin.role !== 'analyst' ? (
            <Section title="Pedidos">
              {data.items.length === 0 ? (
                <Empty title="Nenhum pedido no período" description="Cancelamento é pedido pela pessoa em Configurações e aparece aqui na hora." />
              ) : (
                <>
                  <Table head={['Conta', 'Quando', 'Plano', 'Tempo', 'Motivo', 'Comentário', 'Acesso até', 'Status', '']}>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <Td>
                          <Link to={`/admin/usuarios/${item.user_id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                            {item.user_name ?? item.user_id.slice(0, 8)}
                          </Link>
                        </Td>
                        <Td className="tabular whitespace-nowrap">{formatDate(item.created_at, true)}</Td>
                        <Td>{item.plan.toUpperCase()}{item.interval ? ` · ${item.interval}` : ''}</Td>
                        <Td className="tabular">{item.tenure_days} d</Td>
                        <Td>{CANCEL_REASON_LABELS[item.reason]}</Td>
                        <Td className="max-w-xs text-ink-muted">{item.comment ?? '-'}</Td>
                        <Td className="tabular">{formatDate(item.access_until)}</Td>
                        <Td>
                          <StatusTag tone={item.status === 'retido' ? 'positive' : 'neutral'}>{STATUS_LABELS[item.status]}</StatusTag>
                          {item.retention_attempted ? <span className="block text-xs text-ink-faint">retenção tentada</span> : null}
                        </Td>
                        <Td>
                          {admin.can('requests.act') ? (
                            <Button size="sm" variant="ghost" onClick={() => setEditing({ id: item.id, status: item.status, retention: item.retention_attempted })}>
                              Atualizar
                            </Button>
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                  <Pager page={page} total={data.count} pageSize={25} onPage={setPage} />
                </>
              )}
            </Section>
          ) : null}
        </>
      ) : null}

      {editing ? (
        <ActionDialog
          open
          title="Atualizar pedido de cancelamento"
          description="Marca o que foi feito com esse pedido."
          confirmLabel="Salvar"
          critical={false}
          onConfirm={async (reason) => {
            await container.admin.updateCancellation(editing.id, { status: editing.status, retentionAttempted: editing.retention }, reason)
            await query.reload()
          }}
          onClose={() => setEditing(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-sm text-ink">
              Status
              <select
                value={editing.status}
                onChange={(event) => setEditing({ ...editing, status: event.target.value as keyof typeof STATUS_LABELS })}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-surface-hi px-3 text-ink"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={editing.retention} onChange={(event) => setEditing({ ...editing, retention: event.target.checked })} className="size-4 accent-brand" />
              Houve tentativa de retenção
            </label>
          </div>
        </ActionDialog>
      ) : null}
    </AdminPage>
  )
}
