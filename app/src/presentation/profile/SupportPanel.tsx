import { useCallback, useEffect, useState } from 'react'
import type { MyAccessGrant, MySupportRequest } from '@/domain/admin/admin-schemas'
import type { SupportRequestEvent } from '@/domain/repositories/support-repository'
import {
  ACCESS_GRANT_STATUS_LABELS,
  CONTENT_SCOPE_LABELS,
  MAX_SUPPORT_DESCRIPTION,
  MAX_SUPPORT_SUBJECT,
  SUPPORT_CATEGORY_LABELS,
  supportCategoriesFor,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
} from '@/domain/support/support-request'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { usePlanLimits } from '@/presentation/plan/use-plan-limits'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'

/**
 * O canal com a equipe, pelo lado da pessoa.
 *
 * Três coisas: abrir uma solicitação (com protocolo), acompanhar as
 * abertas e responder, e decidir sobre pedidos de acesso ao próprio
 * conteúdo. O terceiro bloco é o que faz o acesso excepcional existir de
 * verdade: sem o "sim" daqui, ninguém da equipe lê nada.
 */
export function SupportPanel() {
  const [requests, setRequests] = useState<readonly MySupportRequest[]>([])
  const [grants, setGrants] = useState<readonly MyAccessGrant[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextRequests, nextGrants] = await Promise.all([
        container.support.listMyRequests(),
        container.support.myAccessGrants(),
      ])
      setRequests(nextRequests)
      setGrants(nextGrants)
      setError(null)
    } catch (cause) {
      setError(toUserMessage(cause))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-5">
      <AccessGrantsBlock grants={grants} onChanged={load} />
      <Panel>
        <PanelHeader
          title="Ajuda e solicitações"
          icon="sino"
          hint="Exportação, exclusão, pagamento, acesso, segurança, denúncia ou privacidade — em qualquer plano. Ajuda com o app faz parte do PRO. Cada pedido ganha um protocolo e um prazo."
        />
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <NewRequestForm onCreated={load} />
        {requests.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-2">
            {requests.map((request) => (
              <RequestItem key={request.id} request={request} onChanged={load} />
            ))}
          </ul>
        ) : null}
        {container.demo ? (
          <p className="mt-4 text-xs text-ink-faint">
            No modo demo a solicitação fica só neste navegador: não existe equipe do outro lado.
          </p>
        ) : null}
      </Panel>
    </div>
  )
}

function NewRequestForm({ onCreated }: { readonly onCreated: () => Promise<void> }) {
  /*
    A mesma lista da tela de Suporte, pela mesma função.

    São dois formulários pro mesmo canal, e montar a lista na mão em cada um é
    como um deles oferecer uma categoria que o servidor recusa no dia em que a
    regra mudar.
  */
  const categories = supportCategoriesFor(usePlanLimits().appSupport)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<SupportCategory>(() => categories[0] ?? 'acesso')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [protocol, setProtocol] = useState<string | null>(null)

  const submit = useAsyncAction(async () => {
    const created = await container.support.openRequest(category, subject.trim(), description.trim())
    track('support_opened', null, { kind: category })
    setProtocol(created.protocol)
    setSubject('')
    setDescription('')
    setOpen(false)
    await onCreated()
  })

  if (!open) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Icon name="sino" className="size-4" />
          Abrir solicitação
        </Button>
        {protocol ? (
          <span aria-live="polite" className="text-sm text-positive">
            Recebida. Protocolo {protocol}.
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit.run()
      }}
    >
      <Field label="Sobre o quê">
        {(id) => (
          <Select id={id} value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {SUPPORT_CATEGORY_LABELS[item]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Assunto">
        {(id) => <TextInput id={id} value={subject} maxLength={MAX_SUPPORT_SUBJECT} required onChange={(event) => setSubject(event.target.value)} />}
      </Field>
      <Field
        label="Conta o que aconteceu"
        hint={`${description.length}/${MAX_SUPPORT_DESCRIPTION}. Esse texto é lido só pela equipe, dentro desta solicitação.`}
        error={submit.error}
      >
        {(id, describedBy) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            value={description}
            maxLength={MAX_SUPPORT_DESCRIPTION}
            required
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-xl border border-line bg-surface-hi px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand"
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submit.running} disabled={subject.trim().length < 3 || description.trim().length === 0}>
          Enviar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function RequestItem({ request, onChanged }: { readonly request: MySupportRequest; readonly onChanged: () => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [events, setEvents] = useState<readonly SupportRequestEvent[]>([])
  const [message, setMessage] = useState('')

  const loadEvents = useCallback(async () => {
    setEvents(await container.support.requestEvents(request.id))
  }, [request.id])

  useEffect(() => {
    if (expanded) void loadEvents()
  }, [expanded, loadEvents])

  const reply = useAsyncAction(async () => {
    await container.support.addMessage(request.id, message.trim())
    setMessage('')
    await Promise.all([loadEvents(), onChanged()])
  })

  const closed = request.status === 'resolvida' || request.status === 'fechada'

  return (
    <li className="rounded-xl border border-line bg-surface-hi/40 px-3.5 py-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{request.subject}</span>
          <span className="block text-xs text-ink-faint">
            {request.protocol} · {SUPPORT_CATEGORY_LABELS[request.category]} ·{' '}
            {request.opened_at.toLocaleDateString('pt-BR')}
          </span>
        </span>
        <Tag tone={closed ? 'positive' : request.status === 'aguardando_usuario' ? 'warn' : 'neutral'}>
          {SUPPORT_STATUS_LABELS[request.status]}
        </Tag>
      </button>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          {request.resolution ? <p className="text-sm text-ink">Resolução: {request.resolution}</p> : null}
          <ol className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="text-sm">
                <span className="text-xs text-ink-faint">
                  {event.createdAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {event.actorKind === 'usuario' ? 'você' : event.actorKind === 'equipe' ? 'equipe' : 'sistema'} ·{' '}
                  {event.type.replace(/_/g, ' ')}
                </span>
                {event.note ? <p className="whitespace-pre-wrap text-ink-muted">{event.note}</p> : null}
              </li>
            ))}
          </ol>
          {!closed ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void reply.run()
              }}
            >
              <Field label="Responder" error={reply.error}>
                {(id, describedBy) => (
                  <TextInput id={id} aria-describedby={describedBy} value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} />
                )}
              </Field>
              <Button type="submit" size="sm" variant="secondary" loading={reply.running} disabled={message.trim().length === 0} className="self-start">
                Enviar
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Os pedidos de acesso ao conteúdo da pessoa.
 *
 * Aparece só quando existe algum. Pendente pede decisão; ativo mostra até
 * quando e deixa revogar. Nenhum pedido vira acesso sem passar por aqui.
 */
function AccessGrantsBlock({ grants, onChanged }: { readonly grants: readonly MyAccessGrant[]; readonly onChanged: () => Promise<void> }) {
  const respond = useAsyncAction(async (grantId: string, decision: 'consentir' | 'negar' | 'revogar') => {
    await container.support.respondAccess(grantId, decision)
    await onChanged()
  })

  const relevant = grants.filter((grant) => grant.status === 'pendente' || grant.status === 'ativo')
  if (relevant.length === 0) return null

  return (
    <Panel tone="raised">
      <PanelHeader
        title="Pedidos de acesso ao seu conteúdo"
        icon="cadeado"
        hint="A equipe nunca vê seus objetivos, ações, registros ou reviews. Quando precisa, ela pede, e só você libera. O acesso expira sozinho e você revoga quando quiser."
      />
      {respond.error ? <p className="mt-3 text-sm text-danger">{respond.error}</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {relevant.map((grant) => (
          <li key={grant.id} className="rounded-xl border border-flame/30 bg-flame-dim/20 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {grant.requested_by_name ?? 'Equipe'} · {grant.protocol}
              </span>
              <Tag tone={grant.status === 'ativo' ? 'warn' : 'neutral'}>{ACCESS_GRANT_STATUS_LABELS[grant.status]}</Tag>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Motivo: {grant.reason}</p>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-faint">
              {grant.scopes.map((scope) => (
                <li key={scope}>• {CONTENT_SCOPE_LABELS[scope]}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">
              {grant.status === 'ativo' && grant.expires_at
                ? `Ativo até ${grant.expires_at.toLocaleString('pt-BR')}.`
                : `Válido por ${grant.duration_hours}h a partir do seu consentimento.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grant.status === 'pendente' ? (
                <>
                  <Button size="sm" loading={respond.running} onClick={() => void respond.run(grant.id, 'consentir')}>
                    Autorizar por {grant.duration_hours}h
                  </Button>
                  <Button size="sm" variant="secondary" loading={respond.running} onClick={() => void respond.run(grant.id, 'negar')}>
                    Negar
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="danger" loading={respond.running} onClick={() => void respond.run(grant.id, 'revogar')}>
                  Revogar agora
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
