import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { assertMediaAllowed, assertOwnsMediaPath, mediaPath } from './media-policy'

describe('assertMediaAllowed', () => {
  it('aceita foto jpeg dentro do teto e recusa o resto', () => {
    expect(() => assertMediaAllowed({ kind: 'fotos', mimeType: 'image/jpeg', size: 1024 })).not.toThrow()
    expect(() => assertMediaAllowed({ kind: 'fotos', mimeType: 'application/x-msdownload', size: 10 })).toThrow(DomainError)
    expect(() => assertMediaAllowed({ kind: 'fotos', mimeType: 'audio/webm', size: 10 })).toThrow(/não é aceito/)
    expect(() => assertMediaAllowed({ kind: 'audios', mimeType: 'audio/webm', size: 10 })).not.toThrow()
  })

  it('recusa vazio e acima do tamanho', () => {
    expect(() => assertMediaAllowed({ kind: 'fotos', mimeType: 'image/png', size: 0 })).toThrow(/vazio/)
    expect(() => assertMediaAllowed({ kind: 'fotos', mimeType: 'image/png', size: 6 * 1024 * 1024 })).toThrow(/5MB/)
    expect(() => assertMediaAllowed({ kind: 'audios', mimeType: 'audio/mpeg', size: 9 * 1024 * 1024 })).not.toThrow()
  })
})

describe('mediaPath', () => {
  it('começa pelo dono, passa pela pasta do tipo e nunca usa o nome original', () => {
    expect(mediaPath('u1', 'fotos', 'image/webp', 'abc')).toBe('u1/fotos/abc.webp')
    expect(() => mediaPath('u1', 'fotos', 'text/plain', 'abc')).toThrow(DomainError)
  })
})

describe('assertOwnsMediaPath', () => {
  it('só deixa pedir link da própria pasta, sem escapar com ..', () => {
    expect(() => assertOwnsMediaPath('u1', 'u1/fotos/a.jpg')).not.toThrow()
    expect(() => assertOwnsMediaPath('u1', 'u2/fotos/a.jpg')).toThrow(/não é seu/)
    expect(() => assertOwnsMediaPath('u1', 'u1/../u2/a.jpg')).toThrow(/não é seu/)
  })
})
