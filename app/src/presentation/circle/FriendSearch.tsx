import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CircleAuthor } from '@/domain/entities/circle-feed'
import type { Relation } from '@/domain/entities/friendship'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { toUserMessage } from '@/shared/errors'
import { cn } from '@/shared/lib/cn'
import type { CircleState } from './use-circle'

/** Espera a pessoa parar de digitar. Uma busca por tecla seria uma por letra. */
const DEBOUNCE_MS = 320
const MIN_TERM = 2

/**
 * Encontrar alguém pelo nome ou pelo @.
 *
 * A busca não vira lista de sugestões nem "pessoas que você talvez conheça":
 * ela responde ao que foi digitado e nada mais. Sugerir gente seria começar a
 * empurrar rede social pra dentro de um app que a pessoa abriu pra cuidar da
 * própria rotina.
 */
export function FriendSearch({ circle }: { readonly circle: CircleState }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<readonly CircleAuthor[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const needle = term.trim()
    if (needle.length < MIN_TERM) {
      setResults([])
      setError(null)
      return
    }

    let cancelled = false
    setSearching(true)

    const timer = window.setTimeout(async () => {
      try {
        const found = await circle.search(needle)
        // A resposta lenta de uma busca antiga não pode sobrescrever a nova:
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
  }, [term, circle])

  const needle = term.trim()

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Buscar pessoas por nome ou @</span>
        <Icon
          name="busca"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
        />
        <TextInput
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nome ou @ de quem você quer no círculo"
          className="pl-9"
          autoComplete="off"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {needle.length >= MIN_TERM && !searching && results.length === 0 ? (
        <p className="text-sm text-ink-faint">Ninguém encontrado com isso.</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {results.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Avatar name={person.name} src={person.avatarUrl} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
              </span>
              <SearchAction
                relation={circle.relationOf(person.id)}
                personId={person.id}
                busy={circle.acting}
                onAdd={() => void circle.request(person.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * O botão muda com a relação.
 *
 * Oferecer "adicionar" pra quem já é amigo, ou pra quem já recebeu um pedido,
 * garante um erro do servidor no clique. A relação já está calculada — a tela
 * só precisa respeitá-la.
 */
function SearchAction({
  relation,
  personId,
  busy,
  onAdd,
}: {
  readonly relation: Relation
  readonly personId: string
  readonly busy: boolean
  readonly onAdd: () => void
}) {
  if (relation === 'amigos') {
    return (
      <Link
        to={`/app/circulo/${personId}`}
        className={cn('shrink-0 rounded-md text-sm font-medium text-brand-hi hover:text-brand-ink')}
      >
        Já é do círculo
      </Link>
    )
  }

  if (relation === 'pedido-enviado') {
    return <span className="shrink-0 text-sm text-ink-faint">Pedido enviado</span>
  }

  if (relation === 'pedido-recebido') {
    return <span className="shrink-0 text-sm text-ink-muted">Te enviou um pedido</span>
  }

  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={onAdd} className="shrink-0">
      <Icon name="mais" className="size-4" />
      Adicionar
    </Button>
  )
}
