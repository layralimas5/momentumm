import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { TextInput } from '@/presentation/components/ui/Field'
import { useAdmin } from '../admin-context'
import { ActionDialog } from '../components/ActionDialog'
import { AdminPage, Empty, Pager, QueryState, Section, StatusTag, Table, Td, formatDate } from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'

/** O corte mais recente que o banco aceita apagar. Igual ao `audit_purge_floor`. */
const DIAS_INTOCAVEIS = 90

function cortePadrao(): string {
  const data = new Date()
  data.setDate(data.getDate() - 365)
  return data.toISOString().slice(0, 10)
}

export function AdminAuditPage() {
  const admin = useAdmin()
  const [params] = useSearchParams()
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [before, setBefore] = useState(cortePadrao())
  const [purged, setPurged] = useState<number | null>(null)
  const [action, setAction] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const target = params.get('alvo') ?? undefined
  const query = useAdminQuery(
    () => container.admin.audit({ action: applied || undefined, target, page }),
    `${applied}|${target ?? ''}|${page}`,
  )

  return (
    <AdminPage
      title="Auditoria"
      description="Toda ação administrativa: quem, o quê, sobre qual recurso, quando, resultado, motivo e contexto. Uma linha não se edita nem se apaga sozinha; o owner pode limpar o que já passou de 90 dias, e a limpeza também vira registro."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setApplied(action.trim()); setPage(1) }}>
            <TextInput value={action} onChange={(event) => setAction(event.target.value)} placeholder="Ação (ex.: user.suspend)" className="h-9 w-56 text-xs" />
            <Button type="submit" size="sm" variant="secondary">Filtrar</Button>
          </form>
          {admin.role === 'owner' ? (
            <Button size="sm" variant="ghost" onClick={() => setPurgeOpen(true)}>Limpar antigos</Button>
          ) : null}
        </div>
      }
    >
      {purged === null ? null : (
        <p role="status" className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink">
          {purged.toLocaleString('pt-BR')} registro(s) apagado(s). A limpeza ficou registrada aqui mesmo.
        </p>
      )}

      {target ? (
        <p className="text-sm text-ink-muted">
          Mostrando só as ações sobre a conta {target.slice(0, 8)}…{' '}
          <Link to="/admin/auditoria" className="text-brand-hi underline-offset-2 hover:underline">ver tudo</Link>
        </p>
      ) : null}

      <Section title="Registros" hint={query.data ? `${query.data.total.toLocaleString('pt-BR')} no total` : undefined}>
        <QueryState loading={query.loading && !query.data} error={query.error} onRetry={() => void query.reload()} />
        {query.data && query.data.items.length === 0 ? (
          <Empty title="Nenhum registro" description="Nada foi feito com esse filtro." />
        ) : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <Table head={['Quando', 'Quem', 'Papel', 'Ação', 'Recurso', 'Alvo', 'Resultado', 'Motivo', 'Antes → depois', 'Contexto']}>
              {query.data.items.map((entry) => (
                <tr key={entry.id}>
                  <Td className="tabular whitespace-nowrap">{formatDate(entry.created_at, true)}</Td>
                  <Td>{entry.actor_name ?? entry.actor_id?.slice(0, 8) ?? 'sistema'}</Td>
                  <Td>{entry.actor_role ?? '-'}</Td>
                  <Td><code className="text-xs">{entry.action}</code></Td>
                  <Td className="text-xs text-ink-muted">{entry.resource_type}{entry.resource_id ? ` · ${entry.resource_id.slice(0, 12)}` : ''}</Td>
                  <Td>
                    {entry.target_user_id ? (
                      <Link to={`/admin/usuarios/${entry.target_user_id}`} className="text-brand-hi underline-offset-2 hover:underline">
                        {entry.target_name ?? entry.target_user_id.slice(0, 8)}
                      </Link>
                    ) : '-'}
                  </Td>
                  <Td><StatusTag tone={entry.result === 'ok' ? 'positive' : 'danger'}>{entry.result}</StatusTag></Td>
                  <Td className="max-w-xs text-xs text-ink-muted">{entry.reason ?? '-'}</Td>
                  <Td className="max-w-xs text-xs text-ink-faint">
                    {entry.before || entry.after ? (
                      <code className="break-all">{JSON.stringify(entry.before ?? null)} → {JSON.stringify(entry.after ?? null)}</code>
                    ) : '-'}
                  </Td>
                  <Td className="text-xs text-ink-faint">
                    {entry.context && Object.keys(entry.context).length > 0 ? Object.entries(entry.context).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') : '-'}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pager page={page} total={query.data.total} pageSize={50} onPage={setPage} />
          </>
        ) : null}
      </Section>

      <ActionDialog
        open={purgeOpen}
        title="Limpar auditoria antiga"
        description={`Apaga todo registro anterior à data escolhida. Os últimos ${DIAS_INTOCAVEIS} dias não saem: é a janela em que o log ainda serve de prova. Não dá pra escolher uma linha; o corte é por data, e esta limpeza também fica registrada.`}
        confirmLabel="Apagar registros"
        destructive
        onConfirm={async (reason) => {
          setPurged(await container.admin.purgeAudit(before, reason))
          setPage(1)
          await query.reload()
        }}
        onClose={() => setPurgeOpen(false)}
      >
        <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
          Apagar tudo antes de
          <TextInput
            type="date"
            value={before}
            max={new Date(Date.now() - DIAS_INTOCAVEIS * 86_400_000).toISOString().slice(0, 10)}
            onChange={(event) => setBefore(event.target.value)}
          />
        </label>
      </ActionDialog>
    </AdminPage>
  )
}
