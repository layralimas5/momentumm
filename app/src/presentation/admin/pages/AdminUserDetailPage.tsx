import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { UserAction } from '@/domain/admin/admin-gateway'
import { ADMIN_ROLE_LABELS } from '@/domain/admin/admin-role'
import { PLAN_LABELS } from '@/domain/entities/plan'
import {
  CANCEL_REASON_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
} from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import {
  AdminPage,
  Empty,
  Metric,
  MetricGrid,
  QueryState,
  Section,
  StatusTag,
  Table,
  Td,
  formatDate,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { ACCOUNT_STATE_LABELS } from './AdminUsersPage'

interface PendingAction {
  readonly action: UserAction
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly destructive: boolean
}

const ACTIONS: Readonly<Record<UserAction, Omit<PendingAction, 'action'>>> = {
  suspend: {
    title: 'Suspender conta',
    description: 'Bloqueia login e derruba as sessões abertas. A pessoa não perde nada: os dados ficam intactos até a reativação.',
    confirmLabel: 'Suspender',
    destructive: true,
  },
  reactivate: {
    title: 'Reativar conta',
    description: 'Libera o login de novo.',
    confirmLabel: 'Reativar',
    destructive: false,
  },
  revoke_sessions: {
    title: 'Revogar todas as sessões',
    description: 'Derruba a sessão em todos os aparelhos. Use quando houver suspeita de conta invadida. A pessoa entra de novo com a senha.',
    confirmLabel: 'Revogar sessões',
    destructive: true,
  },
  resend_confirmation: {
    title: 'Reenviar confirmação de e-mail',
    description: 'Manda de novo o link de confirmação pro e-mail cadastrado. Nada muda na conta.',
    confirmLabel: 'Reenviar',
    destructive: false,
  },
  start_deletion: {
    title: 'Iniciar exclusão da conta',
    description: 'Só com uma solicitação de exclusão aberta pela própria pessoa. Bloqueia o acesso e agenda a remoção pra 7 dias, a janela de arrependimento.',
    confirmLabel: 'Iniciar exclusão',
    destructive: true,
  },
  complete_deletion: {
    title: 'Concluir exclusão agora',
    description: 'Apaga arquivos e a conta de forma definitiva. Só depois do prazo agendado. Não tem volta.',
    confirmLabel: 'Apagar definitivamente',
    destructive: true,
  },
}

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const admin = useAdmin()
  const query = useAdminQuery(() => container.admin.userDetail(id), id)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [deletionRequest, setDeletionRequest] = useState('')
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockMinutes, setBlockMinutes] = useState('60')
  const [exportOpen, setExportOpen] = useState(false)
  /** A exclusão sem espera. Só o owner vê o botão, e só o banco decide. */
  const [forceOpen, setForceOpen] = useState(false)
  const user = query.data

  const open = (action: UserAction) => setPending({ action, ...ACTIONS[action] })

  const runAction = async (reason: string) => {
    if (!pending) return
    await container.admin.runUserAction({
      action: pending.action,
      userId: id,
      reason,
      ...(pending.action === 'start_deletion' ? { requestId: deletionRequest } : {}),
    })
    await query.reload()
  }

  const exportData = async (reason: string) => {
    const data = await container.admin.exportUserAdminData(id, reason)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `momentumm-admin-${id.slice(0, 8)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const deletionRequests = user?.requests.filter(
    (request) => request.category === 'exclusao' && request.status !== 'resolvida' && request.status !== 'fechada',
  )

  return (
    <AdminPage
      title={user?.name ?? 'Conta'}
      description={user ? `${user.handle ? `@${user.handle} · ` : ''}${user.email_masked ?? ''} · id ${user.id}` : 'Carregando…'}
      action={
        <Link to="/admin/usuarios" className="text-sm text-ink-muted underline-offset-2 hover:underline">
          ← Todos os usuários
        </Link>
      }
    >
      <QueryState loading={query.loading && !user} error={query.error} onRetry={() => void query.reload()} />

      {user ? (
        <>
          <div className="flex flex-wrap gap-2">
            <StatusTag tone={user.status === 'ativa' ? 'positive' : user.status === 'suspensa' ? 'danger' : 'warn'}>
              {ACCOUNT_STATE_LABELS[user.status]}
            </StatusTag>
            <StatusTag tone={user.plan === 'pro' ? 'brand' : 'neutral'}>{user.plan ? PLAN_LABELS[user.plan] : '-'}</StatusTag>
            <StatusTag>{user.email_confirmed ? 'E-mail confirmado' : 'E-mail pendente'}</StatusTag>
            <StatusTag tone={user.mfa_enabled ? 'positive' : 'neutral'}>{user.mfa_enabled ? 'MFA ativo' : 'Sem MFA'}</StatusTag>
            <StatusTag>{user.onboarding_done ? 'Onboarding concluído' : 'Onboarding pendente'}</StatusTag>
            {user.role ? <StatusTag tone="brand">Equipe: {ADMIN_ROLE_LABELS[user.role]}</StatusTag> : null}
            {user.ai_blocked_until ? <StatusTag tone="danger">IA bloqueada até {formatDate(user.ai_blocked_until, true)}</StatusTag> : null}
          </div>

          {user.status_reason ? (
            <p className="text-sm text-ink-muted">
              Motivo do estado atual: {user.status_reason}
              {user.status_scheduled_for ? ` · agendado para ${formatDate(user.status_scheduled_for, true)}` : ''}
            </p>
          ) : null}

          <Section title="Uso agregado" hint="Contagens, nunca conteúdo.">
            <MetricGrid cols={5}>
              <Metric label="Cadastro" value={null} hint={formatDate(user.created_at)} />
              <Metric label="Último acesso" value={null} hint={formatDate(user.last_seen_at, true)} />
              <Metric label="Objetivos ativos" value={user.objectives_count} />
              <Metric label="Hábitos ativos" value={user.habits_count} />
              <Metric label="Ações (total)" value={user.tasks_count} hint={`${user.tasks_completed_7d} concluídas em 7 dias`} />
              <Metric label="Chamadas de IA" value={user.ai_calls_total} hint={user.ai_calls_month !== undefined ? `${user.ai_calls_month} neste mês` : undefined} />
              <Metric label="Solicitações abertas" value={user.open_requests} />
            </MetricGrid>
            {user.ai_usage && user.ai_usage.length > 0 ? (
              <p className="mt-3 text-xs text-ink-faint">
                IA por função: {user.ai_usage.map((item) => `${item.kind} ${item.count}`).join(' · ')}
              </p>
            ) : null}
          </Section>

          {admin.can('users.act') ? (
            <Section title="Ações" hint="Toda ação exige motivo, verificação recente do segundo fator e fica na auditoria.">
              <div className="flex flex-wrap gap-2">
                {user.status === 'suspensa' || user.status === 'exclusao_solicitada' ? (
                  <Button variant="secondary" size="sm" onClick={() => open('reactivate')}>Reativar conta</Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => open('suspend')}>Suspender conta</Button>
                )}
                {!user.email_confirmed ? (
                  <Button variant="secondary" size="sm" onClick={() => open('resend_confirmation')}>Reenviar confirmação</Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => open('revoke_sessions')}>Revogar sessões</Button>
                <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>Exportar dados administrativos</Button>
                {user.ai_blocked_until ? (
                  <Button variant="secondary" size="sm" onClick={() => setBlockOpen(true)}>Desbloquear IA</Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setBlockOpen(true)}>Bloquear IA</Button>
                )}
                {deletionRequests && deletionRequests.length > 0 && user.status !== 'exclusao_solicitada' ? (
                  <Button variant="danger" size="sm" onClick={() => { setDeletionRequest(deletionRequests[0]?.id ?? ''); open('start_deletion') }}>
                    Iniciar exclusão
                  </Button>
                ) : null}
                {user.status === 'exclusao_solicitada' && user.status_scheduled_for && user.status_scheduled_for <= new Date() ? (
                  <Button variant="danger" size="sm" onClick={() => open('complete_deletion')}>Concluir exclusão</Button>
                ) : null}
                {admin.role === 'owner' && user.status !== 'exclusao_solicitada' ? (
                  <Button variant="danger" size="sm" onClick={() => setForceOpen(true)}>
                    Excluir agora
                  </Button>
                ) : null}
                {admin.can('users.logs') ? (
                  <Link to={`/admin/auditoria?alvo=${user.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-ink-muted hover:bg-surface hover:text-ink">
                    Ver logs da conta
                  </Link>
                ) : null}
              </div>
              {!deletionRequests?.length && user.status !== 'exclusao_solicitada' ? (
                <p className="mt-3 text-xs text-ink-faint">
                  Exclusão só a partir de uma solicitação de exclusão aberta pela própria pessoa.
                </p>
              ) : null}
            </Section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Solicitações">
              {user.requests.length === 0 ? (
                <Empty title="Nenhuma solicitação" description="Essa conta nunca abriu uma." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {user.requests.map((request) => (
                    <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link to={`/admin/solicitacoes/${request.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                          {request.protocol}
                        </Link>
                        <span className="block truncate text-xs text-ink-faint">
                          {SUPPORT_CATEGORY_LABELS[request.category]} · {formatDate(request.opened_at)}
                        </span>
                      </div>
                      <StatusTag>{SUPPORT_STATUS_LABELS[request.status]}</StatusTag>
                    </li>
                  ))}
                </ul>
              )}
              {user.access_grants.some((grant) => grant.status === 'ativo') ? (
                <p className="mt-3 rounded-xl border border-flame/30 bg-flame-dim/30 px-3.5 py-2.5 text-sm text-ink">
                  Existe acesso excepcional ativo ao conteúdo desta conta.
                </p>
              ) : null}
            </Section>

            {user.subscriptions ? (
              <Section title="Assinatura" hint="Sem dado de cartão: isso fica no provedor.">
                {user.subscriptions.length === 0 ? (
                  <Empty title="Sem assinatura registrada" description="Conta gratuita, ou o provedor de pagamento ainda não escreveu aqui." />
                ) : (
                  <Table head={['Provedor', 'Plano', 'Status', 'Valor', 'Início', 'Fim do período']}>
                    {user.subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <Td>{subscription.provider}</Td>
                        <Td>{PLAN_LABELS[subscription.plan]} · {subscription.interval}</Td>
                        <Td><StatusTag>{subscription.status}</StatusTag></Td>
                        <Td className="tabular">{(subscription.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: subscription.currency })}</Td>
                        <Td className="tabular">{formatDate(subscription.started_at)}</Td>
                        <Td className="tabular">{formatDate(subscription.current_period_end)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
                {user.cancellations && user.cancellations.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                    {user.cancellations.map((item, index) => (
                      <li key={index}>
                        Cancelamento em {formatDate(item.created_at)}: {CANCEL_REASON_LABELS[item.reason]} ({item.status})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            ) : null}
          </div>

          {user.audit && user.audit.length > 0 ? (
            <Section title="Ações administrativas sobre esta conta" hint="As 50 mais recentes.">
              <Table head={['Quando', 'Ação', 'Papel', 'Resultado', 'Motivo']}>
                {user.audit.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="tabular whitespace-nowrap">{formatDate(entry.created_at, true)}</Td>
                    <Td>{entry.action}</Td>
                    <Td>{entry.actor_role ?? '-'}</Td>
                    <Td><StatusTag tone={entry.result === 'ok' ? 'positive' : 'danger'}>{entry.result}</StatusTag></Td>
                    <Td>{entry.reason ?? '-'}</Td>
                  </tr>
                ))}
              </Table>
            </Section>
          ) : null}

          {pending ? (
            <ActionDialog
              open
              title={pending.title}
              description={pending.description}
              confirmLabel={pending.confirmLabel}
              destructive={pending.destructive}
              onConfirm={runAction}
              onClose={() => setPending(null)}
            >
              {pending.action === 'start_deletion' && deletionRequests ? (
                <Field label="Solicitação de exclusão">
                  {(fieldId) => (
                    <select
                      id={fieldId}
                      value={deletionRequest}
                      onChange={(event) => setDeletionRequest(event.target.value)}
                      className="h-11 w-full rounded-xl border border-line bg-surface-hi px-3 text-ink"
                    >
                      {deletionRequests.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.protocol} · {formatDate(request.opened_at)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ) : null}
            </ActionDialog>
          ) : null}

          <ActionDialog
            open={forceOpen}
            title="Excluir a conta agora"
            description="Apaga a conta, os arquivos e todo o histórico na hora, sem a janela de 7 dias. É o caminho pra conta de teste e pra pedido feito por fora; quando a própria pessoa pede pelo app, use a exclusão com prazo. Não tem volta."
            confirmLabel="Apagar definitivamente"
            destructive
            onConfirm={async (reason) => {
              await container.admin.forceDeleteUser(id, reason)
              navigate('/admin/usuarios', { replace: true })
            }}
            onClose={() => setForceOpen(false)}
          />

          <ActionDialog
            open={exportOpen}
            title="Exportar dados administrativos"
            description="Gera um JSON com o que o painel sabe da conta: estado, plano, contagens, solicitações e auditoria. Nenhum conteúdo pessoal."
            confirmLabel="Baixar"
            onConfirm={exportData}
            onClose={() => setExportOpen(false)}
          />

          <ActionDialog
            open={blockOpen}
            title={user.ai_blocked_until ? 'Desbloquear a IA' : 'Bloquear a IA temporariamente'}
            description={user.ai_blocked_until ? 'Libera as chamadas de novo.' : 'Recusa chamadas da Momentumm AI desta conta pelo tempo escolhido. A franquia não é consumida.'}
            confirmLabel={user.ai_blocked_until ? 'Desbloquear' : 'Bloquear'}
            onConfirm={async (reason) => {
              if (user.ai_blocked_until) await container.admin.unblockAi(id, reason)
              else await container.admin.blockAi(id, Number(blockMinutes), reason)
              await query.reload()
            }}
            onClose={() => setBlockOpen(false)}
          >
            {!user.ai_blocked_until ? (
              <Field label="Duração (minutos)">
                {(fieldId) => (
                  <TextInput id={fieldId} type="number" min={1} max={43200} value={blockMinutes} onChange={(event) => setBlockMinutes(event.target.value)} />
                )}
              </Field>
            ) : null}
          </ActionDialog>
        </>
      ) : null}
    </AdminPage>
  )
}
