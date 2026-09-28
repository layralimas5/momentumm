import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import type { DayKey } from './day'
import { dayKeyOf } from './day'
import {
  assertPhotoCount,
  assertValidCaption,
  assertValidPost,
  assertValidProgress,
  coverOf,
  DEFAULT_POST_VISIBILITY,
  MAX_CAPTION_LENGTH,
  MAX_POST_PHOTOS,
  progressLabel,
  progressRatio,
  shortAgo,
  type Post,
} from './post'

const TODAY = dayKeyOf(new Date())

function post(over: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: { id: 'u1', name: 'Ana', handle: 'ana', avatarUrl: null },
    caption: null,
    day: TODAY,
    visibility: 'seguidores',
    objectiveId: null,
    objectiveTitle: null,
    progress: null,
    media: [],
    likeCount: 0,
    commentCount: 0,
    liked: false,
    saved: false,
    createdAt: new Date(),
    editedAt: null,
    ...over,
  }
}

describe('a publicação nasce com o alcance do perfil', () => {
  it('o padrão é "seguidores", nunca "privada"', () => {
    // Publicar já é um ato de contar: nascer privada faria o gesto não fazer
    // nada, e a pessoa descobriria isso depois de publicar.
    expect(DEFAULT_POST_VISIBILITY).toBe('seguidores')
  })
})

describe('legenda', () => {
  it('aceita vazia: a foto pode falar sozinha', () => {
    expect(() => assertValidCaption(null)).not.toThrow()
  })

  it('recusa acima do teto', () => {
    expect(() => assertValidCaption('a'.repeat(MAX_CAPTION_LENGTH + 1))).toThrow(DomainError)
    expect(() => assertValidCaption('a'.repeat(MAX_CAPTION_LENGTH))).not.toThrow()
  })
})

describe('o dia da publicação', () => {
  it('recusa dia que ainda não chegou', () => {
    const amanha = dayKeyOf(new Date(Date.now() + 86_400_000 * 2))
    expect(() =>
      assertValidPost({
        userId: 'u1',
        caption: null,
        day: amanha,
        visibility: 'seguidores',
        objectiveId: null,
        progress: null,
      }),
    ).toThrow(DomainError)
  })

  it('aceita hoje e o passado', () => {
    const ontem = dayKeyOf(new Date(Date.now() - 86_400_000))
    for (const day of [TODAY, ontem] as DayKey[]) {
      expect(() =>
        assertValidPost({
          userId: 'u1',
          caption: null,
          day,
          visibility: 'seguidores',
          objectiveId: null,
          progress: null,
        }),
      ).not.toThrow()
    }
  })
})

describe('progresso congelado', () => {
  it('recusa feito maior que o alvo', () => {
    expect(() => assertValidProgress({ done: 31, goal: 30, unit: null })).toThrow(DomainError)
  })

  it('recusa alvo zero', () => {
    expect(() => assertValidProgress({ done: 0, goal: 0, unit: null })).toThrow(DomainError)
  })

  it('recusa número quebrado: progresso é contagem', () => {
    expect(() => assertValidProgress({ done: 1.5, goal: 30, unit: null })).toThrow(DomainError)
  })

  it('aceita nada: o progresso é opcional', () => {
    expect(() => assertValidProgress(null)).not.toThrow()
  })

  it('escreve a frase com a unidade, e sem ela quando não tem', () => {
    expect(progressLabel({ done: 1240, goal: 1800, unit: 'páginas' })).toBe(
      '1.240 de 1.800 páginas',
    )
    expect(progressLabel({ done: 8, goal: 30, unit: null })).toBe('8 de 30')
    expect(progressLabel(null)).toBeNull()
  })

  it('a razão nunca passa de 1 nem fica indefinida', () => {
    expect(progressRatio({ done: 15, goal: 30, unit: null })).toBe(0.5)
    expect(progressRatio(null)).toBe(0)
  })
})

describe('quantas fotos', () => {
  it('exige pelo menos uma', () => {
    expect(() => assertPhotoCount(0)).toThrow(DomainError)
  })

  it('recusa acima do teto do carrossel', () => {
    expect(() => assertPhotoCount(MAX_POST_PHOTOS + 1)).toThrow(DomainError)
    expect(() => assertPhotoCount(MAX_POST_PHOTOS)).not.toThrow()
  })
})

describe('coverOf', () => {
  it('a capa é a primeira foto: é ela que vai pro calendário e pra grade', () => {
    const p = post({
      media: [
        { id: 'm2', path: 'b.jpg', position: 1, width: null, height: null },
        { id: 'm1', path: 'a.jpg', position: 0, width: null, height: null },
      ],
    })
    // A lista chega ordenada pela posição; a capa é o índice zero.
    expect(coverOf({ ...p, media: [...p.media].sort((a, b) => a.position - b.position) })?.path).toBe(
      'a.jpg',
    )
  })

  it('publicação sem foto não tem capa', () => {
    expect(coverOf(post())).toBeNull()
  })
})

describe('shortAgo', () => {
  const now = new Date('2026-09-20T12:00:00Z')

  it('escreve o tempo curto que o card aguenta', () => {
    expect(shortAgo(new Date('2026-09-20T11:59:40Z'), now)).toBe('agora')
    expect(shortAgo(new Date('2026-09-20T11:48:00Z'), now)).toBe('12 min')
    expect(shortAgo(new Date('2026-09-20T09:00:00Z'), now)).toBe('3 h')
    expect(shortAgo(new Date('2026-09-19T10:00:00Z'), now)).toBe('ontem')
    expect(shortAgo(new Date('2026-09-17T10:00:00Z'), now)).toBe('3 d')
  })

  it('passada uma semana, volta pra data', () => {
    expect(shortAgo(new Date('2026-09-01T10:00:00Z'), now)).toMatch(/set/)
  })

  it('data no futuro não vira número negativo', () => {
    expect(shortAgo(new Date('2026-09-20T12:05:00Z'), now)).toBe('agora')
  })
})
