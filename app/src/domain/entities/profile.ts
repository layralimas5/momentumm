import { DomainError } from '@/shared/errors'
import type { ActivityVisibility } from './activity'

export interface Profile {
  readonly id: string
  /** Identificador público, usado na URL do perfil. */
  readonly handle: string
  readonly name: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly defaultVisibility: ActivityVisibility
  readonly createdAt: Date
}

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/
/** Diacríticos combinantes, separados da string NFD por normalizeHandle. */
const COMBINING_MARKS = /[̀-ͯ]/g

export const MAX_NAME_LENGTH = 60
export const MAX_BIO_LENGTH = 160

export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}

export function assertValidHandle(handle: string): void {
  if (!HANDLE_PATTERN.test(handle)) {
    throw new DomainError('O @ precisa ter de 3 a 20 caracteres, só letras, números e _.')
  }
}

export function assertValidName(name: string): void {
  const trimmed = name.trim()
  if (trimmed.length < 2) {
    throw new DomainError('Escreve teu nome com pelo menos 2 letras.')
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new DomainError(`O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`)
  }
}

export function assertValidBio(bio: string | null): void {
  if (bio && bio.trim().length > MAX_BIO_LENGTH) {
    throw new DomainError(`A bio pode ter no máximo ${MAX_BIO_LENGTH} caracteres.`)
  }
}

/** Handle inicial sugerido a partir do e-mail, sempre validado depois. */
export function suggestHandle(email: string): string {
  const base = normalizeHandle(email.split('@')[0] ?? '')
  return base.length >= 3 ? base : `momentum${base}`.slice(0, 20)
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
