import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  assertValidStoryCaption,
  isLive,
  MAX_STORY_CAPTION,
  sortRings,
  STORY_HOURS,
  timeLeftLabel,
  type Story,
  type StoryRing,
} from './story'

function story(over: Partial<Story> = {}): Story {
  const now = new Date('2026-09-20T12:00:00Z')
  return {
    id: 's1',
    userId: 'u1',
    path: 'u1/stories/a.jpg',
    kind: 'imagem',
    caption: null,
    width: null,
    height: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + STORY_HOURS * 3_600_000),
    seen: false,
    views: 0,
    ...over,
  }
}

function ring(over: Partial<StoryRing> = {}): StoryRing {
  return {
    userId: 'u1',
    name: 'Ana',
    handle: 'ana',
    avatarUrl: null,
    total: 1,
    unseen: 0,
    latest: new Date('2026-09-20T10:00:00Z'),
    ...over,
  }
}

describe('o prazo de 24 horas', () => {
  it('vivo enquanto não vence', () => {
    const now = new Date('2026-09-20T20:00:00Z')
    expect(isLive(story(), now)).toBe(true)
  })

  it('morto depois de vencer', () => {
    const now = new Date('2026-09-21T13:00:00Z')
    expect(isLive(story(), now)).toBe(false)
  })
})

describe('timeLeftLabel', () => {
  it('conta em horas, em minutos e avisa quando está acabando', () => {
    expect(timeLeftLabel(story(), new Date('2026-09-20T13:00:00Z'))).toBe('23 h')
    expect(timeLeftLabel(story(), new Date('2026-09-21T11:20:00Z'))).toBe('40 min')
    expect(timeLeftLabel(story(), new Date('2026-09-21T11:55:00Z'))).toBe('acabando')
    expect(timeLeftLabel(story(), new Date('2026-09-21T13:00:00Z'))).toBe('acabou')
  })
})

describe('legenda do story', () => {
  it('é opcional e tem teto', () => {
    expect(() => assertValidStoryCaption(null)).not.toThrow()
    expect(() => assertValidStoryCaption('a'.repeat(MAX_STORY_CAPTION))).not.toThrow()
    expect(() => assertValidStoryCaption('a'.repeat(MAX_STORY_CAPTION + 1))).toThrow(DomainError)
  })
})

describe('sortRings', () => {
  it('quem tem coisa nova vem primeiro, mesmo sendo mais antigo', () => {
    const visto = ring({ userId: 'visto', unseen: 0, latest: new Date('2026-09-20T11:00:00Z') })
    const novo = ring({ userId: 'novo', unseen: 2, latest: new Date('2026-09-20T09:00:00Z') })

    expect(sortRings([visto, novo]).map((item) => item.userId)).toEqual(['novo', 'visto'])
  })

  it('dentro de cada grupo, o mais recente na frente', () => {
    const antigo = ring({ userId: 'antigo', unseen: 1, latest: new Date('2026-09-20T08:00:00Z') })
    const recente = ring({ userId: 'recente', unseen: 1, latest: new Date('2026-09-20T11:00:00Z') })

    expect(sortRings([antigo, recente]).map((item) => item.userId)).toEqual(['recente', 'antigo'])
  })

  it('não muda a lista de entrada', () => {
    const entrada = [ring({ userId: 'a', unseen: 0 }), ring({ userId: 'b', unseen: 1 })]
    sortRings(entrada)
    expect(entrada.map((item) => item.userId)).toEqual(['a', 'b'])
  })
})
