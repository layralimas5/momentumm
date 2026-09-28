import { useCallback, useEffect, useState } from 'react'
import { sortRings, type StoryRing } from '@/domain/entities/story'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'
import { useSocialRevision } from './PostComposerProvider'

export interface StoryTrayView {
  readonly rings: readonly StoryRing[]
  /** A própria pessoa, quando ela tem story no ar. */
  readonly mine: StoryRing | null
  readonly loading: boolean
  readonly error: string | null
  /** Marca a pessoa como vista sem esperar o servidor: o anel apaga no toque. */
  markSeen(userId: string): void
  reload(): void
}

/**
 * A bandeja de stories.
 *
 * ## O próprio usuário sai da lista
 *
 * Ele é sempre o primeiro item da tira, e a tela desenha isso: ou o anel do
 * story dele, ou o "+" pra adicionar. Deixá-lo junto dos outros faria a
 * própria pessoa mudar de posição conforme os amigos postassem.
 *
 * ## O anel apaga no toque, não na volta do servidor
 *
 * Abrir o story de alguém e ver o anel continuar aceso por meio segundo é o
 * que faz a pessoa tocar de novo. A marcação de "visto" vai pro servidor por
 * baixo, e falhar ali não desfaz nada na tela: o pior caso é o anel voltar
 * aceso na próxima carga, que é o erro barato dos dois.
 */
export function useStoryTray(): StoryTrayView {
  const revision = useSocialRevision()
  const [rings, setRings] = useState<readonly StoryRing[]>([])
  const [mine, setMine] = useState<StoryRing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .storyTray()
      .then(async (list) => {
        if (!alive) return
        const me = await currentUserId()
        setMine(list.find((ring) => ring.userId === me) ?? null)
        setRings(sortRings(list.filter((ring) => ring.userId !== me)))
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
  }, [revision, tick])

  const markSeen = useCallback((userId: string) => {
    setRings((current) =>
      current.map((ring) => (ring.userId === userId ? { ...ring, unseen: 0 } : ring)),
    )
    setMine((current) => (current && current.userId === userId ? { ...current, unseen: 0 } : current))
  }, [])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { rings, mine, loading, error, markSeen, reload }
}

/**
 * Quem sou eu, pra separar o próprio anel dos outros.
 *
 * Vem do repositório e não de um `useAuth` aqui porque este hook é chamado
 * dentro de um `then`: ler contexto ali seria ler um valor de outro render.
 */
async function currentUserId(): Promise<string | null> {
  try {
    const session = await container.auth.currentSession()
    return session?.user.id ?? null
  } catch {
    return null
  }
}
