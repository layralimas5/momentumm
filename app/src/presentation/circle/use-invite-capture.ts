import { useEffect } from 'react'
import { INVITE_STORAGE_KEY, parseInviteCode } from '@/domain/entities/referral'
import type { FriendshipRepository } from '@/domain/repositories/friendship-repository'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'

/**
 * O convite guardado no navegador virando a origem da conta.
 *
 * A pessoa abre o link hoje, cria a conta amanhã, e o código continua lá, é
 * por isso que a captura mora aqui, na casca do app logado, e não no cadastro:
 * o caminho entre clicar no link e existir uma conta tem login social, e-mail
 * de confirmação e troca de aparelho no meio.
 *
 * Gasta uma vez e apaga, qualquer que seja a resposta. Se o servidor recusou
 * (conta velha demais, @ que não existe, o próprio @), tentar de novo amanhã
 * daria o mesmo não, e um código eterno no navegador acabaria atribuindo uma
 * conta criada meses depois.
 *
 * Quando a atribuição vale, sai também um PEDIDO de amizade pra quem convidou.
 * Antes a atribuição era só de análise, e quem mandou o link via a amiga
 * entrar e nunca aparecer no próprio círculo: o convite parecia quebrado. O
 * pedido respeita a regra de que acompanhar alguém é aceite dos dois lados:
 * quem entrou pelo link já disse sim, quem convidou aceita com um toque.
 */
export function useInviteCapture(): void {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const stored = read()
    if (!stored) return

    clear()

    void container.referrals
      .register(stored)
      .then(async (registered) => {
        if (!registered) return
        track('friend_invite_accepted', 'circulo', { result: 'registrado' })
        await requestInviter(container.friendships, user.id, stored)
      })
      .catch((cause: unknown) => console.warn('convite: não consegui ligar ao círculo', cause))
  }, [user])
}

/**
 * O pedido de amizade pra quem mandou o link.
 *
 * A busca exata pelo @ acha qualquer perfil, inclusive privado, que é o caso
 * de quase todo mundo: perfil nasce privado.
 */
export async function requestInviter(
  friendships: FriendshipRepository,
  userId: string,
  handle: string,
): Promise<void> {
  const found = await friendships.search(userId, handle)
  const inviter = found.find((person) => person.handle.toLowerCase() === handle.toLowerCase())
  if (!inviter) return

  const existing = await friendships.listByUser(userId)
  const alreadyLinked = existing.some(
    (row) => row.requesterId === inviter.id || row.addresseeId === inviter.id,
  )
  if (alreadyLinked) return

  await friendships.request({ requesterId: userId, addresseeId: inviter.id })
}

function read(): string | null {
  try {
    return parseInviteCode(window.localStorage.getItem(INVITE_STORAGE_KEY))
  } catch {
    return null
  }
}

function clear(): void {
  try {
    window.localStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    // Sem armazenamento não havia o que apagar.
  }
}
