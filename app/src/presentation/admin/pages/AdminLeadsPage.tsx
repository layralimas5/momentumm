import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QUIZ_AREA_LABELS, isQuizArea } from '@/domain/entities/quiz'
import type { AdminQuizLead } from '@/domain/admin/admin-schemas'
import { formatPhone } from '@/domain/entities/quiz-lead'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import {
  AdminPage,
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
import { ActionDialog } from '../components/ActionDialog'
import { useAdmin } from '../admin-context'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

/**
 * Quem respondeu o quiz e deixou contato.
 *
 * A tela existe pra uma pergunta só: com quem eu falo hoje. Por isso ela
 * abre filtrada em quem AINDA NÃO virou conta, que é a gente que o funil
 * perdia em silêncio, e cada linha traz o objetivo que a pessoa escreveu:
 * é o assunto da conversa, pronto.
 */
export function AdminLeadsPage() {
  const { period } = usePeriod()
  const admin = useAdmin()
  const [pending, setPending] = useState<boolean | null>(true)
  const [page, setPage] = useState(1)
  /** O contato que a dona mandou esquecer. Null com o diálogo fechado. */
  const [removing, setRemoving] = useState<AdminQuizLead | null>(null)
  const query = useAdminQuery(
    () => container.admin.quizLeads(period, pending, page),
    `${period.from}|${period.to}|${String(pending)}|${page}`,
  )
  const data = query.data

  const filter = (value: boolean | null, label: string) => (
    <Button
      key={label}
      size="sm"
      variant={pending === value ? 'primary' : 'secondary'}
      aria-pressed={pending === value}
      onClick={() => {
        setPending(value)
        setPage(1)
      }}
    >
      {label}
    </Button>
  )

  return (
    <AdminPage
      title="Contatos do quiz"
      description="Quem respondeu o quiz em /criar-meu-plano e deixou como falar. O contato é pedido antes do diagnóstico, então aparece aqui mesmo quem nunca criou conta."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <MetricGrid cols={3}>
            <Metric label="Contatos no período" value={data.total} />
            <Metric label="Sem conta ainda" value={data.pending} hint="É com esses que dá pra falar." />
            <Metric
              label="Viraram conta"
              value={Math.max(0, data.total - data.pending)}
              hint={data.total === 0 ? undefined : 'Esses já estão no app.'}
            />
          </MetricGrid>

          <Section
            title="Lista"
            hint="Do mais recente pro mais antigo. O nome abre a ficha com as respostas; o e-mail abre o cliente de e-mail e o WhatsApp, a conversa."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {filter(true, 'Sem conta')}
              {filter(false, 'Já tem conta')}
              {filter(null, 'Todos')}
            </div>

            {data.items.length === 0 ? (
              <Empty
                title="Nenhum contato no período"
                description="Ninguém deixou contato no quiz nessas datas. Aumenta o período ou confere se o quiz está recebendo visita."
              />
            ) : (
              <>
                <Table head={['Pessoa', 'Contato', 'Objetivo', 'Origem', 'Quando', '', '']}>
                  {data.items.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      onRemove={admin.can('users.act') ? () => setRemoving(lead) : undefined}
                    />
                  ))}
                </Table>
                <Pager page={data.page} total={data.total} pageSize={data.page_size} onPage={setPage} />
              </>
            )}
          </Section>
        </>
      ) : null}

      <ActionDialog
        open={removing !== null}
        title="Esquecer este contato"
        description="Nome, e-mail, telefone e idade saem da lista e do banco. A resposta do quiz continua contando no funil, sem dono: número de mês fechado não muda porque alguém pediu pra sair."
        confirmLabel="Esquecer contato"
        destructive
        onConfirm={async (reason) => {
          if (!removing) return
          await container.admin.deleteQuizLead(removing.id, reason)
          await query.reload()
        }}
        onClose={() => setRemoving(null)}
      />
    </AdminPage>
  )
}

function LeadRow({
  lead,
  onRemove,
}: {
  readonly lead: AdminQuizLead
  readonly onRemove?: (() => void) | undefined
}) {
  const area = isQuizArea(lead.area) ? QUIZ_AREA_LABELS[lead.area] : lead.area

  return (
    <tr>
      <Td>
        <Link to={`/admin/contatos/${lead.id}`} className="font-medium text-ink hover:text-brand-hi hover:underline">
          {lead.name}
        </Link>
        {lead.age === null ? null : <span className="ml-2 text-xs text-ink-faint">{lead.age} anos</span>}
      </Td>
      <Td>
        <div className="flex flex-col gap-0.5">
          <a href={`mailto:${lead.email}`} className="text-brand-hi hover:underline">
            {lead.email}
          </a>
          {lead.phone === null ? (
            <span className="text-xs text-ink-faint">Sem WhatsApp</span>
          ) : (
            <a
              href={`https://wa.me/55${lead.phone}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-hi hover:underline"
            >
              {formatPhone(lead.phone)}
            </a>
          )}
        </div>
      </Td>
      <Td>
        <Link to={`/admin/contatos/${lead.id}`} className="text-ink hover:text-brand-hi hover:underline">
          {lead.goal || 'Sem objetivo escrito'}
        </Link>
        {area ? <span className="ml-2 text-xs text-ink-faint">{area}</span> : null}
      </Td>
      <Td>{lead.source}</Td>
      <Td className="whitespace-nowrap">{formatDate(new Date(lead.entered_at))}</Td>
      <Td>
        {lead.has_account ? (
          <StatusTag tone="positive">Virou conta</StatusTag>
        ) : (
          <StatusTag tone="warn">Sem conta</StatusTag>
        )}
      </Td>
      <Td>
        {onRemove ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Apagar
          </Button>
        ) : null}
      </Td>
    </tr>
  )
}
