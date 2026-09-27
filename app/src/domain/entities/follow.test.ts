import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { assertCanFollow, createFollow, followersLabel } from './follow'

describe('follow', () => {
  it('guarda a direção: quem segue e quem é seguido', () => {
    const follow = createFollow({ followerId: 'bia', followingId: 'lay' })

    expect(follow.followerId).toBe('bia')
    expect(follow.followingId).toBe('lay')
  })

  it('recusa seguir a si mesmo', () => {
    expect(() => createFollow({ followerId: 'lay', followingId: 'lay' })).toThrow(DomainError)
    expect(() => assertCanFollow('lay', 'lay')).toThrow(DomainError)
  })

  it('escreve seguidor no singular quando é um só', () => {
    expect(followersLabel(1)).toBe('Seguidor')
    expect(followersLabel(0)).toBe('Seguidores')
    expect(followersLabel(132)).toBe('Seguidores')
  })
})
