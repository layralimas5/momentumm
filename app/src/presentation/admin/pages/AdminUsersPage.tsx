import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { UserFilters } from '@/domain/admin/admin-gateway'
import type { AccountState } from '@/domain/admin/admin-schemas'
import { PLAN_LABELS } from '@/domain/entities/plan'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
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

const PAGE_SIZE = 25

export const ACCOUNT_STATE_LABELS: Readonly<Record<AccountState, string>> = {
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  exclusao_solicitada: 'Exclusão em andamento',
}

export function AdminUsersPage() {
  const admin = useAdmin()
  const [draft, setDraft] = useState<UserFilters>({})
  const [filters, setFilters] = useState<UserFilters>({ page: 1 })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invited, setInvited] = useState<string | null>(null)
  const query = useAdminQuery(
    () => container.admin.listUsers({ ...filters, pageSize: PAGE_SIZE }),
    JSON.stringify(filters),
  )

  return (
    <AdminPage
      title="Usuários"
      description="Cada linha é um cartão administrativo: estado, plano, contagens e uso. Nenhum título de objetivo, texto de ação ou registro aparece aqui, nem em nenhuma outra tela."
      action={
        admin.can('users.act') ? (
          <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
            Cadastrar usuário
          </Button>
        ) : undefined
      }
    >
      {invited ? (
        <p aria-live="polite" className="rounded-xl border border-positive/30 bg-positive/10 px-3.5 py-2.5 text-sm text-ink">
          Convite enviado pra {invited}. A pessoa recebe o link por e-mail e escolhe a senha.
        </p>
      ) : null}

      <ActionDialog
        open={inviteOpen}
        title="Cadastrar usuário por convite"
        description="Pra caso raro: a pessoa recebe um e-mail com o link, escolhe a senha e entra. O caminho normal continua sendo ela criar a própria conta."
        confirmLabel="Enviar convite"
        onConfirm={async (reason) => {
          await container.admin.inviteUser(inviteEmail.trim(), inviteName.trim(), reason)
          setInvited(inviteEmail.trim())
          setInviteEmail('')
          setInviteName('')
        }}
        onClose={() => setInviteOpen(false)}
      >
        <Field label="Nome">
          {(id) => <TextInput id={id} value={inviteName} maxLength={60} onChange={(event) => setInviteName(event.target.value)} />}
        </Field>
        <Field label="E-mail">
          {(id) => <TextInput id={id} type="email" value={inviteEmail} autoComplete="off" onChange={(event) => setInviteEmail(event.target.value)} />}
        </Field>
      </ActionDialog>

      <Section title="Filtros">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            setFilters({ ...draft, page: 1 })
          }}
        >
          <Field label="Buscar" hint="Nome, @, id ou e-mail exato">
            {(id) => (
              <TextInput
                id={id}
                value={draft.search ?? ''}
                onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              />
            )}
          </Field>
          <Field label="Plano">
            {(id) => (
              <Select
                id={id}
                value={draft.plan ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, plan: (event.target.value || undefined) as UserFilters['plan'] })
                }
              >
                <option value="">Todos</option>
                <option value="free">{PLAN_LABELS.free}</option>
                <option value="pro">{PLAN_LABELS.pro}</option>
              </Select>
            )}
          </Field>
          <Field label="Status da conta">
            {(id) => (
              <Select
                id={id}
                value={draft.status ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, status: (event.target.value || undefined) as AccountState | undefined })
                }
              >
                <option value="">Todos</option>
                {Object.entries(ACCOUNT_STATE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Onboarding">
            {(id) => (
              <Select
                id={id}
                value={draft.onboarding === undefined ? '' : String(draft.onboarding)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    onboarding: event.target.value === '' ? undefined : event.target.value === 'true',
                  })
                }
              >
                <option value="">Todos</option>
                <option value="true">Concluído</option>
                <option value="false">Não concluído</option>
              </Select>
            )}
          </Field>
          <Field label="Ativo nos últimos">
            {(id) => (
              <Select
                id={id}
                value={draft.activeWithinDays ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    activeWithinDays: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              >
                <option value="">Qualquer</option>
                <option value="1">1 dia</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
              </Select>
            )}
          </Field>
          <Field label="Cadastro de">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={draft.createdFrom ?? ''}
                onChange={(event) => setDraft({ ...draft, createdFrom: event.target.value || undefined })}
              />
            )}
          </Field>
          <Field label="Cadastro até">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={draft.createdTo ?? ''}
                onChange={(event) => setDraft({ ...draft, createdTo: event.target.value || undefined })}
              />
            )}
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit">Filtrar</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({})
                setFilters({ page: 1 })
              }}
            >
              Limpar
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Contas" hint={query.data ? `${query.data.total.toLocaleString('pt-BR')} encontradas` : undefined}>
        <QueryState loading={query.loading && !query.data} error={query.error} onRetry={() => void query.reload()} />
        {query.data && query.data.items.length === 0 ? (
          <Empty title="Nenhuma conta com esses filtros" description="Ajusta a busca ou limpa os filtros." />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <Table head={['Conta', 'Plano', 'Status', 'Cadastro', 'Último acesso', 'Onboarding', 'E-mail', 'MFA', 'Obj / Háb / Ações', 'IA', 'Solicit.']}>
              {query.data.items.map((user) => (
                <tr key={user.id} className="hover:bg-surface-hi/40">
                  <Td>
                    <Link to={`/admin/usuarios/${user.id}`} className="font-medium text-ink underline-offset-2 hover:underline">
                      {user.name ?? 'Sem perfil'}
                    </Link>
                    <span className="block text-xs text-ink-faint">{user.handle ? `@${user.handle}` : user.id.slice(0, 8)}</span>
                    <span className="block text-xs text-ink-faint">{user.email_masked ?? '—'}</span>
                  </Td>
                  <Td>
                    <StatusTag tone={user.plan === 'pro' ? 'brand' : 'neutral'}>
                      {user.plan ? PLAN_LABELS[user.plan] : '—'}
                    </StatusTag>
                  </Td>
                  <Td>
                    <StatusTag tone={user.status === 'ativa' ? 'positive' : user.status === 'suspensa' ? 'danger' : 'warn'}>
                      {ACCOUNT_STATE_LABELS[user.status]}
                    </StatusTag>
                  </Td>
                  <Td className="tabular whitespace-nowrap">{formatDate(user.created_at)}</Td>
                  <Td className="tabular whitespace-nowrap">{formatDate(user.last_seen_at, true)}</Td>
                  <Td>{user.onboarding_done ? 'Sim' : 'Não'}</Td>
                  <Td>{user.email_confirmed ? 'Confirmado' : 'Pendente'}</Td>
                  <Td>{user.mfa_enabled ? 'Ativo' : 'Não'}</Td>
                  <Td className="tabular">
                    {user.objectives_count} / {user.habits_count} / {user.tasks_count}
                  </Td>
                  <Td className="tabular">{user.ai_calls_total}</Td>
                  <Td className="tabular">{user.open_requests}</Td>
                </tr>
              ))}
            </Table>
            <Pager
              page={filters.page ?? 1}
              total={query.data.total}
              pageSize={PAGE_SIZE}
              onPage={(page) => setFilters({ ...filters, page })}
            />
          </>
        ) : null}
      </Section>
    </AdminPage>
  )
}
