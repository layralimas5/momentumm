import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { belongsInCircle, circleFeed, type CircleFeedItem } from './circle-feed'
import {
  createFriendship,
  friendIdsOf,
  isIncoming,
  isOutgoing,
  otherSideOf,
  relationWith,
  type Friendship,
} from './friendship'
import { createJourneyEvent, type JourneyEventType, type JourneyVisibility } from './journey-event'

const EU = 'user-eu'
const AMIGA = 'user-amiga'
const ESTRANHO = 'user-estranho'

function friendship(patch: Partial<Friendship> = {}): Friendship {
  return {
    id: 'f1',
    requesterId: EU,
    addresseeId: AMIGA,
    status: 'aceita',
    createdAt: new Date(),
    respondedAt: new Date(),
    ...patch,
  }
}

describe('amizade', () => {
  it('recusa adicionar a si mesmo', () => {
    expect(() => createFriendship({ requesterId: EU, addresseeId: EU }, 'f1')).toThrow(DomainError)
  })

  it('nasce pendente, nunca aceita', () => {
    const created = createFriendship({ requesterId: EU, addresseeId: AMIGA }, 'f1')
    expect(created.status).toBe('pendente')
    expect(created.respondedAt).toBeNull()
  })

  it('acha o outro lado a partir de qualquer ponta', () => {
    expect(otherSideOf(friendship(), EU)).toBe(AMIGA)
    expect(otherSideOf(friendship(), AMIGA)).toBe(EU)
  })

  it('só conta como amigo quem foi aceito', () => {
    const list = [
      friendship({ id: 'a', addresseeId: AMIGA }),
      friendship({ id: 'b', addresseeId: ESTRANHO, status: 'pendente' }),
    ]
    expect(friendIdsOf(list, EU)).toEqual([AMIGA])
  })

  it('separa pedido recebido de pedido enviado', () => {
    const recebido = friendship({ status: 'pendente', requesterId: AMIGA, addresseeId: EU })
    const enviado = friendship({ status: 'pendente', requesterId: EU, addresseeId: AMIGA })

    expect(isIncoming(recebido, EU)).toBe(true)
    expect(isOutgoing(recebido, EU)).toBe(false)
    expect(isOutgoing(enviado, EU)).toBe(true)
    expect(isIncoming(enviado, EU)).toBe(false)
  })

  it('lê a relação do ponto de vista de quem pergunta', () => {
    const enviado = [friendship({ status: 'pendente', requesterId: EU, addresseeId: AMIGA })]
    expect(relationWith(enviado, EU, AMIGA)).toBe('pedido-enviado')
    expect(relationWith(enviado, AMIGA, EU)).toBe('pedido-recebido')
  })

  it('não sugere relação com quem não tem linha nenhuma', () => {
    expect(relationWith([friendship()], EU, ESTRANHO)).toBe('nenhuma')
  })

  it('reconhece a própria pessoa', () => {
    expect(relationWith([], EU, EU)).toBe('voce')
  })
})

function feedItem(
  type: JourneyEventType,
  visibility: JourneyVisibility,
  day: Date,
): CircleFeedItem {
  return {
    event: createJourneyEvent(
      {
        userId: AMIGA,
        type,
        sourceType: 'routine',
        title: 'momento',
        visibility,
        occurredAt: day,
      },
      `${type}-${day.getTime()}`,
    ),
    author: { id: AMIGA, name: 'Amiga', handle: 'amiga', avatarUrl: null },
    supports: 0,
    supportedByMe: false,
  }
}

describe('feed do círculo', () => {
  it('aceita só o que é assunto entre amigos', () => {
    expect(belongsInCircle('routine_completed')).toBe(true)
    expect(belongsInCircle('goal_completed')).toBe(true)
    expect(belongsInCircle('milestone')).toBe(true)
    expect(belongsInCircle('comeback')).toBe(true)

    // O que encheria o feed sem contar história nova.
    expect(belongsInCircle('habit_completed')).toBe(false)
    expect(belongsInCircle('day_completed')).toBe(false)
    expect(belongsInCircle('momentum_record')).toBe(false)
  })

  it('descarta o que não foi compartilhado, mesmo chegando na lista', () => {
    const items = [
      feedItem('routine_completed', 'privada', new Date(2026, 8, 5)),
      feedItem('milestone', 'amigos', new Date(2026, 8, 6)),
    ]
    const result = circleFeed(items)
    expect(result).toHaveLength(1)
    expect(result[0]?.event.type).toBe('milestone')
  })

  it('descarta tipo que não pertence ao feed, mesmo compartilhado', () => {
    const items = [feedItem('day_completed', 'amigos', new Date(2026, 8, 6))]
    expect(circleFeed(items)).toHaveLength(0)
  })

  it('mostra o mais recente primeiro', () => {
    const items = [
      feedItem('milestone', 'amigos', new Date(2026, 8, 1)),
      feedItem('comeback', 'amigos', new Date(2026, 8, 6)),
      feedItem('weekly_review', 'amigos', new Date(2026, 8, 3)),
    ]
    expect(circleFeed(items).map((item) => item.event.type)).toEqual([
      'comeback',
      'weekly_review',
      'milestone',
    ])
  })
})
