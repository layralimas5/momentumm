import { useEffect, useState } from 'react'
import type { ProfileCard } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ErrorNote } from '@/presentation/components/ui/States'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { toUserMessage } from '@/shared/errors'

/**
 * As contas bloqueadas, e a saída de cada uma.
 *
 * Ela existe porque bloquear sem um lugar pra desbloquear é uma decisão sem
 * volta escondida num menu de três pontos. O lugar é Configurações, junto com
 * privacidade e segurança, e não no perfil: é uma lista da conta, não de uma
 * pessoa.
 *
 * Some inteira quando não há ninguém bloqueado. Um painel permanente dizendo
 * "nenhuma conta bloqueada" ocuparia espaço fixo pra informar o que é normal.
 */
export function BlockedPanel() {
  const [people, setPeople] = useState<readonly ProfileCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    void container.social
      .blockedList()
      .then((list) => {
        if (alive) setPeople(list)
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
  }, [])

  const unblock = async (userId: string) => {
    setWorking(userId)
    setError(null)
    try {
      await container.social.unblock(userId)
      setPeople((current) => current.filter((person) => person.id !== userId))
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setWorking(null)
    }
  }

  if (loading || (people.length === 0 && !error)) return null

  return (
    <Panel id="bloqueadas">
      <PanelHeader
        title="Contas bloqueadas"
        hint="Vocês não veem o conteúdo um do outro. Desbloquear não refaz quem seguia quem."
      />

      {error ? <ErrorNote message={error} /> : null}

      <ul className="flex flex-col divide-y divide-line">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2.5">
            <Avatar name={person.name} src={person.avatarUrl} className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
              <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={working === person.id}
              disabled={working !== null}
              onClick={() => void unblock(person.id)}
            >
              Desbloquear
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
