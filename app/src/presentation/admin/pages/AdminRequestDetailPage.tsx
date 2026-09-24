import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AdminMember } from '@/domain/admin/admin-schemas'
import {
  ACCESS_GRANT_STATUS_LABELS,
  CONTENT_SCOPES,
  CONTENT_SCOPE_LABELS,
  DEFAULT_ACCESS_HOURS,
  MAX_ACCESS_HOURS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  type ContentScope,
  type SupportPriority,
  type SupportStatus,
} from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import { AdminPage, QueryState, Section, StatusTag, formatDate } from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { priorityTone } from './AdminRequestsPage'

export function AdminRequestDetailPage() {
  const { id = '' } = useParams()
  const admin = useAdmin()
  const { user } = useAuth()
  const query = useAdminQuery(() => container.admin.requestDetail(id), id)
  const request = query.data

  const [status, setStatus] = useState<SupportStatus | ''>('')
  const [priority, setPriority] = useState<SupportPriority | ''>('')
  const [assignee, setAssignee] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [resolution, setResolution] = useState('')
  const [note, setNote] = useState('')
  const [team, setTeam] = useState<readonly AdminMember[]>([])
  const [accessOpen, setAccessOpen] = useState(false)
  const [scopes, setScopes] = useState<readonly ContentScope[]>([])
  const [hours, setHours] = useState(String(DEFAULT_ACCESS_HOURS))
  const [content, setContent] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (admin.can('admins.read')) void container.admin.listAdmins().then(setTeam).catch(() => setTeam([]))
  }, [admin])

  const save = useAsyncAction(async () => {
    await container.admin.updateRequest(id, {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignee ? { assignee } : {}),
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    setNote('')
    await query.reload()
  })

  const read = useAsyncAction(async (grantId: string) => {
    const ok = await admin.requireStepUp()
    if (!ok) return
    setContent(await container.admin.readScopedContent(grantId))
  })

  const activeGrant = request?.access_grants.find((grant) => grant.active)
  const pendingGrant = request?.access_grants.find((grant) => grant.status === 'pendente')

  return (
    <AdminPage
      title={request ? request.protocol : 'Solicitação'}
      description={request ? `${SUPPORT_CATEGORY_LABELS[request.category]} · aberta em ${formatDate(request.opened_at, true)}` : 'Carregando…'}
      action={<Link to="/admin/solicitacoes" className="text-sm text-ink-muted underline-offset-2 hover:underline">← Fila</Link>}
    >
      <QueryState loading={query.loading && !request} error={query.error} onRetry={() => void query.reload()} />

      {request ? (
        <>
          {activeGrant ? (
            <p className="rounded-xl border border-flame/30 bg-flame-dim/30 px-3.5 py-2.5 text-sm text-ink">
              <strong>Acesso excepcional ativo</strong> ao conteúdo desta pessoa até {formatDate(activeGrant.expires_at, true)}.
              Escopo: {activeGrant.scopes.map((scope) => CONTENT_SCOPE_LABELS[scope]).join('; ')}. Cada leitura fica na auditoria.
            </p>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-5">
              <Section title={request.subject} hint={`${request.user_name ?? 'Pessoa'} · ${request.user_email_masked ?? ''} · ${request.user_plan?.toUpperCase() ?? ''}`}>
                <p className="whitespace-pre-wrap text-sm text-ink">{request.description}</p>
                <p className="mt-3 text-xs text-ink-faint">
                  Este é o único conteúdo pessoal visível fora de um acesso excepcional: o que a pessoa escreveu aqui, pra esta solicitação.
                </p>
              </Section>

              <Section title="Histórico">
                <ol className="flex flex-col gap-3">
                  {request.events.map((event) => (
                    <li key={event.id} className="flex gap-3 text-sm">
                      <span className="tabular w-32 shrink-0 text-xs text-ink-faint">{formatDate(event.created_at, true)}</span>
                      <div className="min-w-0">
                        <p className="text-ink">
                          <span className="text-ink-muted">{event.actor_kind === 'usuario' ? request.user_name ?? 'Pessoa' : event.actor_name ?? event.actor_kind}</span>{' '}
                          · {event.type.replace(/_/g, ' ')}
                        </p>
                        {event.note ? <p className="mt-0.5 whitespace-pre-wrap text-ink-muted">{event.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              {admin.can('content_access.request') ? (
                <Section title="Acesso excepcional a conteúdo" hint="Só com consentimento da pessoa. Nunca pra si mesmo. Expira sozinho.">
                  {request.access_grants.length > 0 ? (
                    <ul className="mb-4 flex flex-col gap-2">
                      {request.access_grants.map((grant) => (
                        <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                          <div>
                            <StatusTag tone={grant.active ? 'warn' : 'neutral'}>{ACCESS_GRANT_STATUS_LABELS[grant.status]}</StatusTag>
                            <span className="ml-2 text-xs text-ink-faint">
                              {grant.scopes.join(', ')} · pedido em {formatDate(grant.requested_at, true)}
                              {grant.expires_at ? ` · expira ${formatDate(grant.expires_at, true)}` : ''}
                            </span>
                            <p className="mt-1 text-xs text-ink-muted">Motivo: {grant.reason}</p>
                          </div>
                          {grant.active && grant.requested_by === user?.id ? (
                            <Button size="sm" variant="secondary" loading={read.running} onClick={() => void read.run(grant.id)}>
                              Ler conteúdo autorizado
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {read.error ? <p className="mb-3 text-sm text-danger">{read.error}</p> : null}
                  {!activeGrant && !pendingGrant && request.status !== 'resolvida' && request.status !== 'fechada' && request.user_id !== user?.id ? (
                    <Button size="sm" variant="secondary" onClick={() => setAccessOpen(true)}>Pedir acesso à pessoa</Button>
                  ) : null}
                  {content ? (
                    <div className="mt-4 rounded-xl border border-flame/30 bg-surface-hi/40 p-4">
                      <p className="text-xs font-semibold tracking-wide text-flame uppercase">Conteúdo autorizado (leitura registrada)</p>
                      <pre className="mt-2 max-h-96 overflow-auto text-xs text-ink">{JSON.stringify(content, null, 2)}</pre>
                      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setContent(null)}>Fechar</Button>
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4">
              <Section title="Estado">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Status</dt><dd><StatusTag>{SUPPORT_STATUS_LABELS[request.status]}</StatusTag></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Prioridade</dt><dd><StatusTag tone={priorityTone(request.priority)}>{SUPPORT_PRIORITY_LABELS[request.priority]}</StatusTag></dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Responsável</dt><dd className="text-ink">{request.assignee_name ?? '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Prazo</dt><dd className="tabular text-ink">{formatDate(request.due_at, true)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Resolvida</dt><dd className="tabular text-ink">{formatDate(request.resolved_at, true)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-faint">Conta</dt><dd><Link to={`/admin/usuarios/${request.user_id}`} className="text-brand-hi underline-offset-2 hover:underline">abrir</Link></dd></div>
                </dl>
                {request.resolution ? <p className="mt-3 text-sm text-ink-muted">Resolução: {request.resolution}</p> : null}
              </Section>

              {admin.can('requests.act') ? (
                <Section title="Atualizar">
                  <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save.run() }}>
                    <Field label="Status">
                      {(fieldId) => (
                        <Select id={fieldId} value={status} onChange={(event) => setStatus(event.target.value as SupportStatus | '')}>
                          <option value="">Manter</option>
                          {SUPPORT_STATUSES.map((item) => <option key={item} value={item}>{SUPPORT_STATUS_LABELS[item]}</option>)}
                        </Select>
                      )}
                    </Field>
                    <Field label="Prioridade">
                      {(fieldId) => (
                        <Select id={fieldId} value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority | '')}>
                          <option value="">Manter</option>
                          {SUPPORT_PRIORITIES.map((item) => <option key={item} value={item}>{SUPPORT_PRIORITY_LABELS[item]}</option>)}
                        </Select>
                      )}
                    </Field>
                    {team.length > 0 ? (
                      <Field label="Responsável">
                        {(fieldId) => (
                          <Select id={fieldId} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                            <option value="">Manter</option>
                            {team.map((member) => <option key={member.user_id} value={member.user_id}>{member.name ?? member.email_masked}</option>)}
                          </Select>
                        )}
                      </Field>
                    ) : user ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setAssignee(user.id)}>
                        {assignee === user.id ? 'Vou assumir esta' : 'Assumir esta solicitação'}
                      </Button>
                    ) : null}
                    <Field label="Novo prazo">
                      {(fieldId) => <TextInput id={fieldId} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />}
                    </Field>
                    <Field label="Resolução" hint="Aparece pra pessoa.">
                      {(fieldId) => <TextInput id={fieldId} value={resolution} maxLength={1000} onChange={(event) => setResolution(event.target.value)} />}
                    </Field>
                    <Field label="Nota no histórico" hint="Aparece pra pessoa." error={save.error}>
                      {(fieldId, describedBy) => <TextInput id={fieldId} aria-describedby={describedBy} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />}
                    </Field>
                    <Button type="submit" loading={save.running}>Salvar</Button>
                  </form>
                </Section>
              ) : null}
            </aside>
          </div>

          <ActionDialog
            open={accessOpen}
            title="Pedir acesso excepcional"
            description="A pessoa recebe o pedido em Configurações e decide. O acesso só existe depois do consentimento dela, pelo prazo escolhido, e ela revoga quando quiser."
            confirmLabel="Enviar pedido"
            reasonLabel="Motivo (a pessoa vai ler)"
            onConfirm={async (reason) => {
              await container.admin.requestContentAccess(id, reason, scopes, Number(hours))
              setScopes([])
              await query.reload()
            }}
            onClose={() => setAccessOpen(false)}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink">Escopo exato</legend>
              {CONTENT_SCOPES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(event) =>
                      setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))
                    }
                    className="mt-0.5 size-4 accent-brand"
                  />
                  {CONTENT_SCOPE_LABELS[scope]}
                </label>
              ))}
            </fieldset>
            <Field label={`Duração em horas (máx. ${MAX_ACCESS_HOURS})`}>
              {(fieldId) => <TextInput id={fieldId} type="number" min={1} max={MAX_ACCESS_HOURS} value={hours} onChange={(event) => setHours(event.target.value)} />}
            </Field>
          </ActionDialog>
        </>
      ) : null}
    </AdminPage>
  )
}
