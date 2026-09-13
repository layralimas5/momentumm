import { describe, expect, it } from 'vitest'
import { ADMIN_CAPABILITIES, ADMIN_ROLES, can, isAdminRole } from './admin-role'

describe('matriz de permissões do painel', () => {
  it('sem papel não pode nada', () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(can(null, capability)).toBe(false)
    }
  })

  it('owner pode tudo', () => {
    for (const capability of ADMIN_CAPABILITIES) {
      expect(can('owner', capability)).toBe(true)
    }
  })

  it('analista só lê métricas agregadas e erros', () => {
    expect(can('analyst', 'metrics.read')).toBe(true)
    expect(can('analyst', 'errors.read')).toBe(true)
    expect(can('analyst', 'users.read')).toBe(false)
    expect(can('analyst', 'users.act')).toBe(false)
    expect(can('analyst', 'requests.read')).toBe(false)
    expect(can('analyst', 'requests.act')).toBe(false)
    expect(can('analyst', 'settings.read')).toBe(false)
    expect(can('analyst', 'audit.read')).toBe(false)
    expect(can('analyst', 'cancellations.comment')).toBe(false)
  })

  it('suporte não altera plano, configuração nem papéis, e não age sobre contas', () => {
    expect(can('support', 'requests.read')).toBe(true)
    expect(can('support', 'requests.act')).toBe(true)
    expect(can('support', 'users.read')).toBe(true)
    expect(can('support', 'users.act')).toBe(false)
    expect(can('support', 'users.logs')).toBe(false)
    expect(can('support', 'settings.read')).toBe(false)
    expect(can('support', 'settings.write')).toBe(false)
    expect(can('support', 'admins.write')).toBe(false)
    expect(can('support', 'ai.block')).toBe(false)
    expect(can('support', 'cancellations.comment')).toBe(false)
  })

  it('admin opera, mas não escreve configuração nem gere administradores', () => {
    expect(can('admin', 'users.act')).toBe(true)
    expect(can('admin', 'settings.read')).toBe(true)
    expect(can('admin', 'settings.write')).toBe(false)
    expect(can('admin', 'admins.read')).toBe(true)
    expect(can('admin', 'admins.write')).toBe(false)
  })

  it('reconhece só os quatro papéis', () => {
    for (const role of ADMIN_ROLES) expect(isAdminRole(role)).toBe(true)
    expect(isAdminRole('root')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })
})
