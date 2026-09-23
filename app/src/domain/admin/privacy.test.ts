import { describe, expect, it } from 'vitest'
import { errorModuleFor, MAX_ERROR_MESSAGE, maskEmail, sanitizeErrorMessage } from './privacy'

describe('e-mail mascarado', () => {
  it('deixa só dois caracteres do usuário e do domínio', () => {
    expect(maskEmail('layra.lima@gmail.com')).toBe('la***@gm***.com')
    expect(maskEmail('a@b.co')).toBe('a***@b***.co')
  })

  it('não inventa máscara pra valor que não é e-mail', () => {
    expect(maskEmail('sem-arroba')).toBeNull()
    expect(maskEmail(null)).toBeNull()
  })
})

describe('mensagem de erro sem segredo', () => {
  it('remove e-mail, bearer, JWT e chave de API', () => {
    const raw =
      'Falha para fulana@exemplo.com com Bearer abc.def-ghi e token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x e chave sk-ant-api03-abcdef'
    const clean = sanitizeErrorMessage(raw)
    expect(clean).not.toContain('fulana@exemplo.com')
    expect(clean).not.toContain('abc.def-ghi')
    expect(clean).not.toContain('eyJhbGci')
    expect(clean).not.toContain('sk-ant-')
    expect(clean).toContain('[email]')
    expect(clean).toContain('[jwt]')
    expect(clean).toContain('[chave]')
  })

  it('apaga sequências longas e opacas (hash, token de sessão, segredo do Supabase)', () => {
    const secret = 'sb_secret_' + 'a'.repeat(40)
    expect(sanitizeErrorMessage(`erro ${secret}`)).not.toContain(secret)
    const hash = 'f'.repeat(64)
    expect(sanitizeErrorMessage(`hash ${hash}`)).toBe('hash [opaco]')
  })

  it('corta no tamanho máximo', () => {
    expect(sanitizeErrorMessage('erro de rede '.repeat(100))).toHaveLength(MAX_ERROR_MESSAGE)
  })

  it('não trata texto comum como segredo', () => {
    expect(sanitizeErrorMessage('TypeError: cannot read properties of undefined')).toBe(
      'TypeError: cannot read properties of undefined',
    )
  })
})

describe('módulo do erro', () => {
  it('classifica pela forma do erro', () => {
    expect(errorModuleFor(new Error('JWT expired'))).toBe('auth')
    expect(errorModuleFor(new Error('bucket not found'))).toBe('storage')
    expect(errorModuleFor(new Error('relation "x" does not exist'))).toBe('database')
    expect(errorModuleFor(new Error('qualquer coisa'))).toBe('app')
  })

  it('esconde segredo curto que veio na URL de recuperação de senha', () => {
    const real =
      "Failed to execute 'querySelector' on 'Document': '#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnop&expires_at=1789501550&refresh_token=ytirnzbchiet&token_type=bearer&type=recovery' is not a valid selector"
    const limpo = sanitizeErrorMessage(real)

    expect(limpo).not.toContain('ytirnzbchiet')
    expect(limpo).toContain('refresh_token=[oculto]')
    expect(limpo).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
  })

  it('não estraga mensagem sem segredo', () => {
    expect(sanitizeErrorMessage('column prev.active_user_ids does not exist')).toBe(
      'column prev.active_user_ids does not exist',
    )
  })
})
