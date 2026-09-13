import { describe, expect, it } from 'vitest'
import { adminGateFor, minutesLeft, type AdminSession } from './admin-session'

const base: AdminSession = {
  role: 'admin',
  aal: 'aal2',
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
  sessionValid: true,
  sessionExpiresAt: new Date(Date.now() + 30 * 60_000),
  stepUpValid: true,
  stepUpExpiresAt: new Date(Date.now() + 4 * 60_000),
}

describe('porta do painel', () => {
  it('sem sessão ou sem papel é proibido, mesmo com MFA', () => {
    expect(adminGateFor(null, true)).toBe('forbidden')
    expect(adminGateFor({ ...base, role: null }, true)).toBe('forbidden')
  })

  it('com papel e sem fator registrado, cadastra antes de entrar', () => {
    expect(adminGateFor(base, false)).toBe('enroll_mfa')
  })

  it('admin sem MFA na sessão (aal1) é barrado na verificação', () => {
    expect(adminGateFor({ ...base, aal: 'aal1', sessionValid: false }, true)).toBe('verify_mfa')
  })

  it('sessão administrativa vencida cai na verificação de novo', () => {
    expect(adminGateFor({ ...base, sessionValid: false }, true)).toBe('verify_mfa')
  })

  it('só abre com papel, fator e sessão válida', () => {
    expect(adminGateFor(base, true)).toBe('open')
  })

  it('com a exigência de MFA desligada, papel basta (e sem papel continua proibido)', () => {
    const relaxed = { ...base, mfaRequired: false, aal: 'aal1' as const, sessionValid: true }
    expect(adminGateFor(relaxed, false)).toBe('open')
    expect(adminGateFor({ ...relaxed, role: null }, false)).toBe('forbidden')
  })

  it('conta os minutos que faltam sem ir abaixo de zero', () => {
    const now = new Date('2026-09-11T10:00:00Z')
    expect(minutesLeft(new Date('2026-09-11T10:30:00Z'), now)).toBe(30)
    expect(minutesLeft(new Date('2026-09-11T09:30:00Z'), now)).toBe(0)
    expect(minutesLeft(null, now)).toBe(0)
  })
})
