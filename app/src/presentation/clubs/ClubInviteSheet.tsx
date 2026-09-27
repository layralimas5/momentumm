import { useCallback, useEffect, useState } from 'react'
import type { CircleAuthor } from '@/domain/entities/circle-feed'
import type { Club, ClubMember } from '@/domain/entities/club'
import { clubInviteMessage, clubInviteUrl } from '@/domain/entities/club-invite'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useCircle } from '@/presentation/circle/use-circle'
import { toUserMessage } from '@/shared/errors'

/** Espera a pessoa parar de digitar: uma busca por tecla seria uma por letra. */
const DEBOUNCE_MS = 320
const MIN_TERM = 2

/**
 * Chamar gente pro clube.
 *
 * Duas portas, e elas resolvem problemas diferentes:
 *
 *   pelo link    um endereço que dá pra mandar em qualquer lugar, pra quem tem
 *                conta e pra quem não tem. Vale inclusive no clube por
 *                convite: ter o link É o convite, e um link que só funcionasse
 *                em clube aberto não resolveria nada que o botão "entrar" já
 *                não resolvesse.
 *   pelo app     nominal, pra quem já está aqui dentro: o círculo com um
 *                toque, e qualquer conta pelo @. Chega como aviso, e a pessoa
 *                aceita ou recusa.
 *
 * ## Por que convidar não coloca ninguém dentro
 *
 * A versão anterior desta folha ADICIONAVA a pessoa. Entrar em grupo sem ter
 * dito sim é a definição de spam, e é o tipo de coisa que um produto faz uma
 * vez e perde a confiança que a comunidade inteira depende. Agora o dono chama,
 * e quem entra é quem responde.
 *
 * Tudo aqui é escrita do DONO, e o banco cobra assinatura por ela. A folha nem
 * chega a abrir pra quem não administra, mas se chegasse, a política recusaria
 * do mesmo jeito.
 */
export function ClubInviteSheet({
  open,
  club,
  members,
  onClose,
}: {
  readonly open: boolean
  readonly club: Club
  readonly members: readonly ClubMember[]
  readonly onClose: () => void
}) {
  const circle = useCircle()
  /*
    A busca depende da FUNÇÃO, não do objeto do círculo.

    `useCircle` devolve um objeto novo a cada render, e esta folha chama o hook
    por conta própria: com o objeto na lista de dependências, cada `setState`
    do efeito criava um objeto novo, que reexecutava o efeito, que chamava
    `setState` de novo. `search` é estável (`useCallback`), e é o que o efeito
    de fato usa.
  */
  const buscar = circle.search
  const [busy, setBusy] = useState<string | null>(null)
  const [convidados, setConvidados] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const [term, setTerm] = useState('')
  const [results, setResults] = useState<readonly CircleAuthor[]>([])
  const [searching, setSearching] = useState(false)

  const dentro = new Set(members.map((member) => member.userId))
  const convidaveis = circle.friends.filter((friend) => !dentro.has(friend.person.id))

  /*
    O link é pedido ao abrir a folha, não ao tocar no botão.

    Ele é o caminho mais usado, e gerar só no clique deixaria o botão principal
    esperando uma ida ao servidor com a folha nativa de compartilhamento já
    aberta, que é onde o iPhone desiste do gesto.
  */
  useEffect(() => {
    if (!open || link !== null) return

    let alive = true

    void container.clubs
      .inviteToken(club.id)
      .then((token) => {
        if (!alive) return
        setLink(clubInviteUrl(window.location.origin, token))
        track('club_invite_link_created', 'desafios')
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })

    return () => {
      alive = false
    }
  }, [open, link, club.id])

  /*
    A espera é DERIVADA do que existe, não um estado à parte.

    Com um `gerando` próprio, a linha que o desligava vivia num `.finally`, e
    ela não rodava: a re-renderização disparada pelo link chegava antes, o
    efeito era limpo, e o botão ficava girando com o link já na tela.
  */
  const gerando = open && link === null && error === null

  useEffect(() => {
    const needle = term.trim()
    if (needle.length < MIN_TERM) {
      setResults([])
      return
    }

    let cancelled = false
    setSearching(true)

    const timer = window.setTimeout(async () => {
      try {
        const found = await buscar(needle)
        // Resposta lenta de uma busca antiga não pode sobrescrever a nova:
        // sem isso, apagar letras faria resultados velhos voltarem.
        if (!cancelled) setResults(found)
      } catch (cause) {
        if (!cancelled) setError(toUserMessage(cause))
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [term, buscar])

  const convidar = useCallback(
    async (userId: string) => {
      setBusy(userId)
      setError(null)
      try {
        await container.clubs.invite(club.id, userId)
        track('club_invite_sent', 'desafios')
        setConvidados((atual) => new Set(atual).add(userId))
      } catch (cause) {
        setError(toUserMessage(cause))
      } finally {
        setBusy(null)
      }
    },
    [club.id],
  )

  const compartilhar = async () => {
    if (!link) return
    const texto = clubInviteMessage(club.name, link)

    try {
      if (navigator.share) {
        await navigator.share({ title: club.name, text: texto, url: link })
        return
      }
    } catch {
      // Cancelou a folha nativa: não é erro, e não vira aviso na tela.
      return
    }

    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  const naBusca = results.filter(
    (person) => !dentro.has(person.id) && !convidaveis.some((f) => f.person.id === person.id),
  )
  const needle = term.trim()

  return (
    <BottomSheet
      open={open}
      title="Chamar gente pro clube"
      description="Manda o link pra qualquer pessoa, ou convida pelo app quem já tem conta aqui."
      onClose={onClose}
    >
      <div className="flex flex-col gap-5 pb-1">
        {error ? <ErrorNote message={error} /> : null}

        <section>
          <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
            Pelo link
          </h3>

          <Button
            size="lg"
            variant="secondary"
            className="mt-2 w-full"
            loading={gerando}
            disabled={link === null}
            onClick={() => void compartilhar()}
          >
            <Icon name="compartilhar" className="size-4" />
            Compartilhar o link do clube
          </Button>

          {link ? (
            <p className="mt-2 truncate rounded-lg border border-line bg-surface-hi px-3 py-2 text-xs text-ink-faint">
              {link}
            </p>
          ) : null}

          <p aria-live="polite" className="mt-1.5 min-h-5 text-xs text-ink-faint">
            {copiado
              ? 'Link copiado. É só colar na conversa.'
              : 'Quem abrir o link entra no clube, mesmo sendo por convite.'}
          </p>
        </section>

        <section>
          <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
            Do seu círculo
          </h3>

          {circle.loading ? (
            <p className="mt-2 text-sm text-ink-muted">Carregando teu círculo…</p>
          ) : convidaveis.length === 0 ? (
            <p className="mt-2 text-sm text-pretty text-ink-muted">
              {circle.friends.length === 0
                ? 'Teu círculo está vazio por enquanto. Quem você adicionar lá aparece aqui.'
                : 'Todo mundo do teu círculo já está neste clube.'}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {convidaveis.map((friend) => (
                <PersonRow
                  key={friend.person.id}
                  person={friend.person}
                  busy={busy}
                  convidado={convidados.has(friend.person.id)}
                  onInvite={() => void convidar(friend.person.id)}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
            Buscar quem já usa o app
          </h3>

          <label className="relative mt-2 block">
            <span className="sr-only">Buscar pessoas por nome ou @</span>
            <Icon
              name="busca"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
            />
            <TextInput
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Nome ou @ de quem você quer chamar"
              className="pl-9"
              autoComplete="off"
            />
          </label>

          {needle.length >= MIN_TERM && !searching && naBusca.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">
              {results.length === 0
                ? 'Ninguém encontrado com isso. Pelo @ exato a busca acha qualquer conta.'
                : 'Quem apareceu já está no clube ou já aparece aqui em cima.'}
            </p>
          ) : null}

          {naBusca.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {naBusca.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  busy={busy}
                  convidado={convidados.has(person.id)}
                  onInvite={() => void convidar(person.id)}
                />
              ))}
            </ul>
          ) : null}
        </section>

        <p className="text-xs text-pretty text-ink-faint">
          Convite não coloca ninguém dentro: ele chega como aviso, e a pessoa decide. Quem entra vê
          o nome, a foto e os dias cumpridos de cada um nos desafios daqui. Nada além disso
          atravessa: hábito, ação e registro continuam sendo de quem os fez.
        </p>
      </div>
    </BottomSheet>
  )
}

/**
 * Uma pessoa na lista, com o botão que muda de estado.
 *
 * "Convite enviado" fica no lugar do botão em vez de sumir com a linha: quem
 * acabou de chamar cinco pessoas precisa ver quais foram, e uma linha que
 * desaparece no clique parece um erro.
 */
function PersonRow({
  person,
  busy,
  convidado,
  onInvite,
}: {
  readonly person: CircleAuthor
  readonly busy: string | null
  readonly convidado: boolean
  readonly onInvite: () => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-1 py-2">
      <Avatar name={person.name} src={person.avatarUrl} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
        <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
      </span>

      {convidado ? (
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-positive">
          <Icon name="check" className="size-4" />
          Convite enviado
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          loading={busy === person.id}
          onClick={onInvite}
        >
          Convidar
        </Button>
      )}
    </li>
  )
}
