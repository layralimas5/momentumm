import { useState } from 'react'
import { ADMIN_ROLES, ADMIN_ROLE_HINTS, ADMIN_ROLE_LABELS, type AdminRole } from '@/domain/admin/admin-role'
import type { AdminSetting } from '@/domain/admin/admin-schemas'
import { SENSITIVE_SETTINGS, SETTING_LABELS, validateSetting } from '@/domain/admin/settings-schema'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import { AdminPage, Empty, QueryState, Section, StatusTag, Table, Td, formatDate } from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'

/** As chaves que são do PAINEL, não do produto. Vivem na aba "Painel". */
const PANEL_SETTINGS: ReadonlySet<string> = new Set(['admin.security'])

/**
 * Duas abas, um componente: "Configurações" mostra as chaves do produto;
 * "Painel" mostra as chaves do próprio painel mais a gestão de
 * administradores. Separar em duas telas é o que impede a segurança do
 * painel de ficar escondida no meio de limite de plano e mensagem de sistema.
 */
export function AdminSettingsPage({ scope = 'produto' }: { readonly scope?: 'produto' | 'painel' }) {
  const admin = useAdmin()
  const settings = useAdminQuery(() => container.admin.settings(), 'settings')
  const admins = useAdminQuery(
    () => (scope === 'painel' && admin.can('admins.read') ? container.admin.listAdmins() : Promise.resolve([])),
    `admins:${scope}`,
  )
  const visible = (settings.data ?? []).filter((setting) =>
    scope === 'painel' ? PANEL_SETTINGS.has(setting.key) : !PANEL_SETTINGS.has(setting.key),
  )

  return (
    <AdminPage
      title={scope === 'painel' ? 'Painel' : 'Configurações do produto'}
      description={
        scope === 'painel'
          ? 'Segurança do painel e quem tem acesso a ele. Só o owner altera; toda mudança pede motivo e fica na auditoria.'
          : 'Limites, IA, funcionalidades, manutenção, versões legais e mensagens. Só o owner altera; toda mudança pede verificação recente, motivo, e grava antes e depois na auditoria.'
      }
    >
      <QueryState loading={settings.loading && !settings.data} error={settings.error} onRetry={() => void settings.reload()} />

      {settings.data ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((setting) => (
            <SettingCard key={setting.key} setting={setting} canWrite={admin.can('settings.write')} onSaved={() => void settings.reload()} />
          ))}
        </div>
      ) : null}

      {scope === 'painel' && admin.can('admins.read') ? (
        <AdminsSection members={admins.data ?? []} loading={admins.loading} error={admins.error} onChanged={() => void admins.reload()} />
      ) : null}
    </AdminPage>
  )
}

function SettingCard({
  setting,
  canWrite,
  onSaved,
}: {
  readonly setting: AdminSetting
  readonly canWrite: boolean
  readonly onSaved: () => void
}) {
  const [draft, setDraft] = useState(JSON.stringify(setting.value, null, 2))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const parsed = (() => {
    try {
      return { value: JSON.parse(draft) as unknown, error: null as string | null }
    } catch {
      return { value: null, error: 'JSON inválido.' }
    }
  })()
  const validation = parsed.error ? { ok: false, message: parsed.error } : validateSetting(setting.key, parsed.value)
  const changed = draft.trim() !== JSON.stringify(setting.value, null, 2).trim()
  const sensitive = SENSITIVE_SETTINGS.has(setting.key)

  return (
    <Section
      title={SETTING_LABELS[setting.key] ?? setting.key}
      hint={setting.description}
      action={
        <div className="flex items-center gap-2">
          {setting.public ? <StatusTag>pública</StatusTag> : null}
          {sensitive ? <StatusTag tone="warn">sensível</StatusTag> : null}
        </div>
      }
    >
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={Math.min(16, draft.split('\n').length + 1)}
            spellCheck={false}
            aria-label={`Valor de ${setting.key}`}
            className="w-full rounded-xl border border-line bg-surface-hi p-3 font-mono text-xs text-ink focus:border-brand"
          />
          <div aria-live="polite" className="mt-2 min-h-5 text-xs">
            {validation.message ? <span className="text-danger">{validation.message}</span> : changed ? <span className="text-positive">Válido.</span> : null}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!validation.ok || !changed} onClick={() => setOpen(true)}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(JSON.stringify(setting.value, null, 2)); setEditing(false) }}>Cancelar</Button>
          </div>
        </>
      ) : (
        <>
          <pre className="overflow-x-auto rounded-xl border border-line bg-surface-hi/40 p-3 font-mono text-xs text-ink">{JSON.stringify(setting.value, null, 2)}</pre>
          <p className="mt-2 text-xs text-ink-faint">
            Atualizada em {formatDate(setting.updated_at, true)}{setting.updated_by_name ? ` por ${setting.updated_by_name}` : ''}
          </p>
          {canWrite ? <Button size="sm" variant="secondary" className="mt-2" onClick={() => setEditing(true)}>Editar</Button> : null}
        </>
      )}

      <ActionDialog
        open={open}
        title={`Alterar ${SETTING_LABELS[setting.key] ?? setting.key}`}
        description={sensitive ? 'Configuração sensível: muda o que todo mundo vê ou pode fazer. Confirmação reforçada.' : 'A mudança vale na hora e fica na auditoria com antes e depois.'}
        confirmLabel="Aplicar"
        destructive={sensitive}
        onConfirm={async (reason) => {
          await container.admin.updateSetting(setting.key, parsed.value, reason)
          setEditing(false)
          onSaved()
        }}
        onClose={() => setOpen(false)}
      />
    </Section>
  )
}

function AdminsSection({
  members,
  loading,
  error,
  onChanged,
}: {
  readonly members: readonly { user_id: string; role: AdminRole; name: string | null; email_masked: string | null; granted_at: Date; reason: string | null; mfa_enabled: boolean }[]
  readonly loading: boolean
  readonly error: string | null
  readonly onChanged: () => void
}) {
  const admin = useAdmin()
  const [grantOpen, setGrantOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('support')
  const [revoking, setRevoking] = useState<string | null>(null)

  return (
    <Section
      title="Administradores e permissões"
      hint="Um papel por conta. Conceder exige e-mail confirmado e verificação em duas etapas ativa na conta da pessoa."
      action={admin.can('admins.write') ? <Button size="sm" onClick={() => setGrantOpen(true)}>Conceder papel</Button> : undefined}
    >
      <QueryState loading={loading && members.length === 0} error={error} onRetry={onChanged} />
      {!loading && members.length === 0 ? <Empty title="Nenhum administrador" description="Estranho: você está aqui." /> : null}
      {members.length > 0 ? (
        <Table head={['Pessoa', 'Papel', 'MFA', 'Desde', 'Motivo', '']}>
          {members.map((member) => (
            <tr key={member.user_id}>
              <Td>
                <span className="font-medium">{member.name ?? '-'}</span>
                <span className="block text-xs text-ink-faint">{member.email_masked}</span>
              </Td>
              <Td><StatusTag tone={member.role === 'owner' ? 'brand' : 'neutral'}>{ADMIN_ROLE_LABELS[member.role]}</StatusTag></Td>
              <Td>{member.mfa_enabled ? 'Ativo' : <span className="text-danger">Não</span>}</Td>
              <Td className="tabular">{formatDate(member.granted_at)}</Td>
              <Td className="text-xs text-ink-muted">{member.reason ?? '-'}</Td>
              <Td>
                {admin.can('admins.write') ? (
                  <Button size="sm" variant="ghost" onClick={() => setRevoking(member.user_id)}>Revogar</Button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}

      <ul className="mt-4 grid gap-2 text-xs text-ink-faint sm:grid-cols-2">
        {ADMIN_ROLES.map((item) => (
          <li key={item}><strong className="text-ink-muted">{ADMIN_ROLE_LABELS[item]}:</strong> {ADMIN_ROLE_HINTS[item]}</li>
        ))}
      </ul>

      <ActionDialog
        open={grantOpen}
        title="Conceder papel administrativo"
        description="A pessoa precisa ter conta com e-mail confirmado e MFA ativo. Se já tem papel, ele é substituído."
        confirmLabel="Conceder"
        destructive
        onConfirm={async (reason) => {
          await container.admin.grantRole(email.trim(), role, reason)
          setEmail('')
          onChanged()
        }}
        onClose={() => setGrantOpen(false)}
      >
        <Field label="E-mail da conta">
          {(fieldId) => <TextInput id={fieldId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Papel" hint={ADMIN_ROLE_HINTS[role]}>
          {(fieldId) => (
            <Select id={fieldId} value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
              {ADMIN_ROLES.map((item) => <option key={item} value={item}>{ADMIN_ROLE_LABELS[item]}</option>)}
            </Select>
          )}
        </Field>
      </ActionDialog>

      <ActionDialog
        open={revoking !== null}
        title="Revogar papel"
        description="A conta volta a ser comum na hora. O último owner não pode ser removido."
        confirmLabel="Revogar"
        destructive
        onConfirm={async (reason) => {
          if (!revoking) return
          await container.admin.revokeRole(revoking, reason)
          onChanged()
        }}
        onClose={() => setRevoking(null)}
      />
    </Section>
  )
}
