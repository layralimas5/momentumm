import { describe, expect, it, vi } from 'vitest'
import type { Friendship, NewFriendshipInput } from '@/domain/entities/friendship'
import type { FriendshipRepository } from '@/domain/repositories/friendship-repository'
import { requestInviter } from './use-invite-capture'

vi.mock('@/infrastructure/container', () => ({ container: {} }))
vi.mock('@/infrastructure/analytics/track', () => ({ track: () => undefined }))

const LAY = { id: 'lay', name: 'Lay', handle: 'layra', avatarUrl: null }

function repo(existing: Friendship[] = []) {
  const requests: NewFriendshipInput[] = []
  const friendships: FriendshipRepository = {
    listByUser: async () => existing,
    listPeople: async () => [],
    search: async (_userId, term) => (term.toLowerCase() === 'layra' ? [LAY] : []),
    request: async (input) => {
      requests.push(input)
      return { id: 'f1', ...input, status: 'pendente', createdAt: new Date(), respondedAt: null } as Friendship
    },
    respond: async () => {
      throw new Error('não usado')
    },
    remove: async () => undefined,
  }
  return { friendships, requests }
}

describe('requestInviter', () => {
  it('manda pedido de quem entrou pelo link pra quem convidou', async () => {
    const { friendships, requests } = repo()
    await requestInviter(friendships, 'gab', 'layra')
    expect(requests).toEqual([{ requesterId: 'gab', addresseeId: 'lay' }])
  })

  it('não duplica quando já existe pedido ou amizade entre as duas', async () => {
    const { friendships, requests } = repo([
      {
        id: 'f0',
        requesterId: 'lay',
        addresseeId: 'gab',
        status: 'pendente',
        createdAt: new Date(),
        respondedAt: null,
      } as Friendship,
    ])
    await requestInviter(friendships, 'gab', 'layra')
    expect(requests).toEqual([])
  })

  it('não faz nada quando o @ não bate exatamente', async () => {
    const { friendships, requests } = repo()
    await requestInviter(friendships, 'gab', 'lay')
    expect(requests).toEqual([])
  })
})
