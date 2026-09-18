import { describe, expect, it } from 'vitest'
import { assertValidBanner, assertValidStatus, normalizeStatus } from './profile-banner'

describe('capa do perfil', () => {
  it('aceita preset, foto JPEG e ausência', () => {
    expect(() => assertValidBanner(null)).not.toThrow()
    expect(() => assertValidBanner('aurora')).not.toThrow()
    expect(() => assertValidBanner('data:image/jpeg;base64,AAAA')).not.toThrow()
  })

  it('recusa chave desconhecida, PNG e foto grande demais', () => {
    expect(() => assertValidBanner('roxo')).toThrow()
    expect(() => assertValidBanner('data:image/png;base64,AAAA')).toThrow()
    expect(() => assertValidBanner('data:image/jpeg;base64,' + 'A'.repeat(200_001))).toThrow()
  })
})

describe('status do perfil', () => {
  it('status só com espaços vira nulo', () => {
    expect(normalizeStatus({ emoji: ' ', text: '  ' })).toBeNull()
    expect(normalizeStatus(null)).toBeNull()
  })

  it('mantém o que tem e apara o resto', () => {
    expect(normalizeStatus({ emoji: '🔥', text: ' Semana de foco ' })).toEqual({ emoji: '🔥', text: 'Semana de foco' })
    expect(normalizeStatus({ emoji: null, text: 'Só texto' })).toEqual({ emoji: null, text: 'Só texto' })
  })

  it('limita o tamanho', () => {
    expect(() => assertValidStatus({ emoji: null, text: 'a'.repeat(61) })).toThrow()
    expect(() => assertValidStatus({ emoji: '🔥🔥🔥🔥🔥', text: null })).toThrow()
    expect(() => assertValidStatus({ emoji: '🔥', text: 'a'.repeat(60) })).not.toThrow()
  })
})
