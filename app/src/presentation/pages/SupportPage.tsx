import { useEffect, useState } from 'react'
import type { MySupportRequest } from '@/domain/admin/admin-schemas'
import { isPro } from '@/domain/entities/plan'
import {
  MAX_SUPPORT_DESCRIPTION,
  MAX_SUPPORT_SUBJECT,
  SUPPORT_CATEGORY_LABELS,
  supportCategoriesFor,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
} from '@/domain/support/support-request'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanLimits } from '@/presentation/plan/use-plan-limits'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { Panel, PanelHeader, Tag } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useMyRequests } from '@/presentation/support/use-my-requests'
import type { SupportRequestEvent } from '@/domain/repositories/support-repository'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'
import { PageHeader } from './PageHeader'

/**
 * O canal de suporte, do lado de quem usa.
 *
 * O banco, as funções e o painel da equipe já existiam; o que faltava era a
 * porta. Aqui a pessoa abre o chamado, acompanha o estado e responde a equipe
 * no mesmo lugar, com o protocolo à vista pra poder cobrar.
 *
 * A tela atende todo mundo de propósito. Exclusão de conta, privacidade e
 * segurança são direitos, não benefício de plano: trancar isso atrás do PRO
 * transformaria uma obrigação legal em item de pacote. O que o PRO muda é a
 * fila, e isso a tela diz em uma linha.
 */
export function SupportPage() {
  const { profile } = useAuth()
  const { requests, loading, error, reload } = useMyRequests()
  const [openId, setOpenId] = useState<string | null>(null)
  const pro = profile ? isPro(profile.plan) : false
  /*
    Quem decide o formulário é a CAPACIDADE do plano, não o nome dele. `pro`
    continua existindo pra falar de fila; quem abre ou fecha "Ajuda com o app" é
    `appSupport`, que é a mesma chave que o servidor aplica.
  */
  const appSupport = usePlanLimits().appSupport

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suporte"
        description={
          pro
            ? 'Abra um chamado e acompanhe a resposta aqui. Como PRO, o teu vai na frente da fila.'
            : 'Abra um chamado e acompanhe a resposta aqui mesmo.'
        }
      />

      <NewRequest onOpened={reload} pro={pro} appSupport={appSupport} />

      <Panel>
        <PanelHeader title="Meus chamados" icon="plano" />

        {loading ? (
          <LoadingBlock label="Carregando os teus chamados" />
        ) : error ? (
          <ErrorNote message={error} />
        ) : requests.length === 0 ? (
          <EmptyState
            title="Nenhum chamado por aqui"
            description="Quando você abrir um, ele aparece nesta lista com o protocolo e o estado."
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {requests.map((request) => (
              <li key={request.id}>
                <RequestRow
                  request={request}
                  open={openId === request.id}
                  onToggle={() => setOpenId(openId === request.id ? null : request.id)}
                  onAnswered={reload}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------------------

function NewRequest({
  onOpened,
  pro,
  appSupport,
}: {
  readonly onOpened: () => Promise<void>
  readonly pro: boolean
  readonly appSupport: boolean
}) {
  /*
    A lista sai do plano, e a primeira dela é o valor inicial.

    Fixar 'suporte' aqui deixaria o gratuito com o formulário abrindo numa
    categoria que o servidor recusa: a pessoa escreveria o chamado inteiro pra
    receber "faz parte do PRO" no envio.
  */
  const categories = supportCategoriesFor(appSupport)
  const [category, setCategory] = useState<SupportCategory>(() => categories[0] ?? 'acesso')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [protocol, setProtocol] = useState<string | null>(null)

  const send = useAsyncAction(async () => {
    const result = await container.support.openRequest(category, subject.trim(), description.trim())
    setProtocol(result.protocol)
    setSubject('')
    setDescription('')
    await onOpened()
  })

  // Os mesmos limites da tabela: o servidor recusa fora disso, e avisar antes
  // de gastar o texto da pessoa é mais barato do que devolver erro depois.
  const subjectOk = subject.trim().length >= 3 && subject.trim().length <= MAX_SUPPORT_SUBJECT
  const descriptionOk =
    description.trim().length >= 1 && description.trim().length <= MAX_SUPPORT_DESCRIPTION

  return (
    <Panel>
      {pro ? (
        <PanelHeader title="Abrir um chamado" icon="sino" hint="Atendimento prioritário do PRO." />
      ) : (
        <PanelHeader
          title="Abrir um chamado"
          icon="sino"
          hint="Conta, cobrança, acesso, privacidade, segurança, denúncia, exportação e exclusão. Ajuda com o app faz parte do PRO."
        />
      )}

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (subjectOk && descriptionOk) void send.run()
        }}
      >
        <Field label="Sobre o que é">
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={category}
              onChange={(event) => setCategory(event.target.value as SupportCategory)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {SUPPORT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Assunto" hint={`Até ${MAX_SUPPORT_SUBJECT} caracteres.`}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={subject}
              maxLength={MAX_SUPPORT_SUBJECT}
              placeholder="Em uma linha, o que aconteceu"
              onChange={(event) => setSubject(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="O que aconteceu"
          hint={`${description.trim().length} de ${MAX_SUPPORT_DESCRIPTION} caracteres.`}
        >
          {(id, describedBy) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              value={description}
              rows={5}
              maxLength={MAX_SUPPORT_DESCRIPTION}
              placeholder="Conta o que você tentou, o que esperava e o que apareceu na tela."
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-brand"
            />
          )}
        </Field>

        {send.error ? <ErrorNote message={send.error} /> : null}

        {protocol ? (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-positive/30 bg-positive/8 px-3.5 py-3 text-sm text-ink"
          >
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            <span>
              Chamado aberto. O protocolo é <strong className="font-semibold">{protocol}</strong>, e
              a resposta chega aqui e no sino de avisos.
            </span>
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-fit"
          disabled={!subjectOk || !descriptionOk}
          loading={send.running}
        >
          Enviar chamado
        </Button>
      </form>
    </Panel>
  )
}

// ---------------------------------------------------------------------------

function RequestRow({
  request,
  open,
  onToggle,
  onAnswered,
}: {
  readonly request: MySupportRequest
  readonly open: boolean
  readonly onToggle: () => void
  readonly onAnswered: () => Promise<void>
}) {
  const waiting = request.status === 'aguardando_usuario'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border',
        waiting ? 'border-brand/40 bg-brand-dim/20' : 'border-line bg-surface-hi/30',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-surface-hi"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{request.subject}</span>
          <span className="tabular mt-0.5 block text-xs text-ink-faint">
            {request.protocol} · {SUPPORT_CATEGORY_LABELS[request.category]} ·{' '}
            {request.opened_at.toLocaleDateString('pt-BR')}
          </span>
        </span>

        <Tag tone={waiting ? 'brand' : request.status === 'resolvida' ? 'positive' : 'neutral'}>
          {SUPPORT_STATUS_LABELS[request.status]}
        </Tag>
      </button>

      {open ? <Conversation request={request} onAnswered={onAnswered} /> : null}
    </div>
  )
}

/**
 * O histórico do chamado e a resposta.
 *
 * Carrega só quando a pessoa abre: a lista costuma ter poucos chamados, mas
 * cada um tem o próprio histórico, e buscar todos de uma vez seria trabalho
 * jogado fora.
 */
function Conversation({
  request,
  onAnswered,
}: {
  readonly request: MySupportRequest
  readonly onAnswered: () => Promise<void>
}) {
  const [events, setEvents] = useState<readonly SupportRequestEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    container.support
      .requestEvents(request.id)
      .then((list) => {
        if (alive) setEvents(list)
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [request.id])

  const reply = useAsyncAction(async () => {
    await container.support.addMessage(request.id, note.trim())
    setNote('')
    setEvents(await container.support.requestEvents(request.id))
    await onAnswered()
  })

  return (
    <div className="border-t border-line px-3.5 py-3">
      {request.resolution ? (
        <p className="rounded-xl border border-positive/30 bg-positive/8 px-3.5 py-3 text-sm text-ink">
          <strong className="font-semibold">Resposta da equipe:</strong> {request.resolution}
        </p>
      ) : null}

      {loading ? (
        <LoadingBlock label="Carregando o histórico" />
      ) : error ? (
        <ErrorNote message={error} />
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-faint">Nada registrado ainda além da abertura.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  event.actorKind === 'equipe' ? 'bg-brand' : 'bg-line-hi',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-ink-faint">
                  {event.actorKind === 'equipe'
                    ? 'Equipe'
                    : event.actorKind === 'usuario'
                      ? 'Você'
                      : 'Sistema'}{' '}
                  · {event.createdAt.toLocaleString('pt-BR')}
                </span>
                {event.note ? (
                  <span className="mt-0.5 block text-sm text-pretty text-ink">{event.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      {request.status === 'fechada' ? (
        <p className="mt-4 text-xs text-ink-faint">
          Chamado fechado. Se voltar a acontecer, abre um novo que o histórico continua aqui.
        </p>
      ) : (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (note.trim().length > 0) void reply.run()
          }}
        >
          <label htmlFor={`resposta-${request.id}`} className="text-sm font-medium text-ink">
            Responder
          </label>
          <textarea
            id={`resposta-${request.id}`}
            value={note}
            rows={3}
            maxLength={1000}
            placeholder="Escreve aqui e a equipe recebe no painel."
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-brand"
          />
          {reply.error ? <ErrorNote message={reply.error} /> : null}
          <Button
            type="submit"
            size="sm"
            className="w-full sm:w-fit"
            disabled={note.trim().length === 0}
            loading={reply.running}
          >
            Enviar resposta
          </Button>
        </form>
      )}
    </div>
  )
}
