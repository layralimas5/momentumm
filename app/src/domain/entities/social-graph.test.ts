import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  assertCanBlock,
  assertValidReport,
  canSeeContent,
  followButtonLabel,
  isClosedProfile,
  MAX_REPORT_NOTE,
  NO_FOLLOW_STATE,
  type FollowState,
} from './social-graph'

function state(over: Partial<FollowState> = {}): FollowState {
  return { ...NO_FOLLOW_STATE, ...over }
}

describe('canSeeContent', () => {
  it('eu sempre vejo o meu, inclusive de perfil fechado', () => {
    expect(canSeeContent('privado', state(), true)).toBe(true)
  })

  it('perfil público é visível mesmo pra quem não segue', () => {
    // É o que "público" significa, e é a diferença entre "não está no meu feed"
    // e "não posso ver".
    expect(canSeeContent('publico', state(), false)).toBe(true)
  })

  it('perfil fechado só abre pra quem foi ACEITO', () => {
    expect(canSeeContent('privado', state(), false)).toBe(false)
    expect(canSeeContent('privado', state({ requested: true }), false)).toBe(false)
    expect(canSeeContent('privado', state({ following: true }), false)).toBe(true)
  })

  it('"somente amigos" também é perfil fechado pra esta camada', () => {
    expect(canSeeContent('amigos', state(), false)).toBe(false)
    expect(canSeeContent('amigos', state({ following: true }), false)).toBe(true)
  })

  it('bloqueio ganha de tudo, inclusive de perfil público', () => {
    expect(canSeeContent('publico', state({ blocked: true }), false)).toBe(false)
    expect(canSeeContent('publico', state({ blocked: true, following: true }), false)).toBe(false)
  })
})

describe('isClosedProfile', () => {
  it('só "publico" é aberto', () => {
    expect(isClosedProfile('publico')).toBe(false)
    expect(isClosedProfile('privado')).toBe(true)
    expect(isClosedProfile('amigos')).toBe(true)
  })
})

describe('followButtonLabel', () => {
  it('cada estado tem um rótulo, e o bloqueio vem antes de todos', () => {
    expect(followButtonLabel(state())).toBe('Seguir')
    expect(followButtonLabel(state({ followsMe: true }))).toBe('Seguir de volta')
    expect(followButtonLabel(state({ requested: true }))).toBe('Solicitado')
    expect(followButtonLabel(state({ following: true }))).toBe('Seguindo')
    expect(followButtonLabel(state({ blocked: true, following: true }))).toBe('Desbloquear')
  })
})

describe('bloqueio', () => {
  it('não dá pra bloquear a si mesma', () => {
    expect(() => assertCanBlock('u1', 'u1')).toThrow(DomainError)
    expect(() => assertCanBlock('u1', 'u2')).not.toThrow()
  })
})

describe('denúncia', () => {
  it('o relato é opcional', () => {
    expect(() =>
      assertValidReport({ targetKind: 'publicacao', targetId: 'p1', reason: 'spam', note: null }),
    ).not.toThrow()
  })

  it('recusa relato acima do teto', () => {
    expect(() =>
      assertValidReport({
        targetKind: 'pessoa',
        targetId: 'u1',
        reason: 'assedio',
        note: 'a'.repeat(MAX_REPORT_NOTE + 1),
      }),
    ).toThrow(DomainError)
  })
})
