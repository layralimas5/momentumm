import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { RequestFilters } from '@/domain/admin/admin-gateway'
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportStatus,
} from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { Select } from '@/presentation/components/ui/Field'
import {
  AdminPage,
  Empty,
  Pager,
  QueryState,
  Section,
  StatusTag,
  Table,
  Td,
  formatDate,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'

export function priorityTone(priority: string): 'neutral' | 'warn' | 'danger' {
  if (priority === 'urgente') return 'danger'
  if (priority === 'alta') return 'warn'
  return 'neutral'
}

export function AdminRequestsPage() {
  const [filters, setFilters] = useState<RequestFilters>({ page: 1 })
  const query = useAdminQuery(() => container.admin.listRequests(filters), JSON.stringify(filters))

  return (
    <AdminPage
      title="Solicitações"
      description="Suporte, exportação, exclusão, denúncia, pagamento, acesso, segurança e privacidade. Cada uma tem protocolo, prioridade, prazo, responsável e histórico."
      action={
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={filters.status ?? ''} onChange={(event) => setFilters({ ...filters, status: (event.target.value || undefined) as SupportStatus | undefined, page: 1 })} className="h-9 text-xs sm:w-44">
            <option value="">Todos os status</option>
            {SUPPORT_STATUSES.map((status) => <option key={status} value={status}>{SUPPORT_STATUS_LABELS[status]}</option>)}
          </Select>
          <Select value={filters.category ?? ''} onChange={(event) => setFilters({ ...filters, category: (event.target.value || undefined) as SupportCategory | undefined, page: 1 })} className="h-9 text-xs sm:w-44">
            <option value="">Toda categoria</option>
            {SUPPORT_CATEGORIES.map((category) => <option key={category} value={category}>{SUPPORT_CATEGORY_LABELS[category]}</option>)}
          </Select>
        </div>
      }
    >
      <Section title="Fila" hint={query.data ? `${query.data.total} solicitações` : undefined}>
        <QueryState loading={query.loading && !query.data} error={query.error} onRetry={() => void query.reload()} />
        {query.data && query.data.items.length === 0 ? (
          <Empty title="Nenhuma solicitação" description="As pessoas abrem solicitações em Configurações. Elas aparecem aqui na hora." />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <Table head={['Protocolo', 'Pessoa', 'Categoria', 'Assunto', 'Prioridade', 'Status', 'Responsável', 'Aberta', 'Prazo']}>
              {query.data.items.map((request) => (
                <tr key={request.id} className={request.overdue ? 'bg-danger/5' : undefined}>
                  <Td>
                    <Link to={`/admin/solicitacoes/${request.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {request.protocol}
                    </Link>
                  </Td>
                  <Td>{request.user_name ?? request.user_id.slice(0, 8)}</Td>
                  <Td>{SUPPORT_CATEGORY_LABELS[request.category]}</Td>
                  <Td className="max-w-xs truncate">{request.subject}</Td>
                  <Td><StatusTag tone={priorityTone(request.priority)}>{SUPPORT_PRIORITY_LABELS[request.priority]}</StatusTag></Td>
                  <Td><StatusTag tone={request.status === 'resolvida' || request.status === 'fechada' ? 'positive' : 'neutral'}>{SUPPORT_STATUS_LABELS[request.status]}</StatusTag></Td>
                  <Td>{request.assignee_name ?? '—'}</Td>
                  <Td className="tabular whitespace-nowrap">{formatDate(request.opened_at)}</Td>
                  <Td className={`tabular whitespace-nowrap ${request.overdue ? 'text-danger' : ''}`}>{formatDate(request.due_at)}</Td>
                </tr>
              ))}
            </Table>
            <Pager page={filters.page ?? 1} total={query.data.total} pageSize={25} onPage={(page) => setFilters({ ...filters, page })} />
          </>
        ) : null}
      </Section>
    </AdminPage>
  )
}
