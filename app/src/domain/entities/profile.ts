import { DomainError } from '@/shared/errors'
import type { ActivityVisibility } from './activity'
import { MAX_REST_WEEKDAYS, normalizeRestWeekdays } from './momentum'
import type { PlanTier } from './plan'
import type { ProfileStatus } from './profile-banner'

/**
 * Quem enxerga o teu perfil.
 *
 * Três degraus, e o padrão é o mais fechado. A escolha é sobre o PERFIL — os
 * números da evolução, as conquistas, os objetivos ativos —, não sobre cada
 * momento: momento continua tendo a visibilidade dele, e um perfil público não
 * torna público nada que a pessoa não marcou.
 *
 * `privado` e `amigos` continuam achaveis pelo @ EXATO. É o que o Instagram
 * faz com conta fechada, e por um motivo prático: sem isso, ninguém consegue
 * mandar pedido de amizade pra quem nasceu privado — que é todo mundo — e o
 * Círculo viraria uma tela que nunca sai do zero. Quem busca pelo @ exato vê
 * nome, @ e foto; o resto do perfil continua fechado.
 */
export const PROFILE_VISIBILITIES = ['privado', 'amigos', 'publico'] as const
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number]

export const PROFILE_VISIBILITY_LABELS: Readonly<Record<ProfileVisibility, string>> = {
  privado: 'Perfil privado',
  amigos: 'Somente amigos',
  publico: 'Público',
}

export const PROFILE_VISIBILITY_HINTS: Readonly<Record<ProfileVisibility, string>> = {
  privado: 'Só você vê teus números e conquistas. Quem tem teu @ ainda consegue te encontrar pra te adicionar.',
  amigos: 'Quem já está no teu círculo vê teu perfil completo. As outras pessoas veem só nome, @ e foto.',
  publico: 'Qualquer pessoa do Momentumm pode encontrar e ver teu perfil. Nada do que você não compartilhou aparece.',
}

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = 'privado'

export interface Profile {
  readonly id: string
  /** Identificador público, usado na URL do perfil. */
  readonly handle: string
  readonly name: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly defaultVisibility: ActivityVisibility
  /** Quem vê o perfil. Nasce `privado` e só muda por escolha explícita. */
  readonly visibility: ProfileVisibility
  /** Plano da conta. Decide limites, nunca acesso às telas. */
  readonly plan: PlanTier
  /** Um emoji e uma frase curta sobre o momento: "🔥 Semana de foco". */
  readonly status: ProfileStatus | null
  /** Capa atrás do avatar: chave de preset ou foto em data URL. `null` usa o preset padrão. */
  readonly banner: string | null
  /**
   * Dias da semana de descanso planejado (0 = domingo). Vazio é o padrão:
   * ninguém nasce com folga marcada, e o Momentumm só tira da conta o que a
   * pessoa declarou. No máximo `MAX_REST_WEEKDAYS`.
   */
  readonly restWeekdays: readonly number[]
  readonly createdAt: Date
}

export const WEEKDAY_LABELS: readonly string[] = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

export function assertValidRestWeekdays(weekdays: readonly number[]): void {
  if (weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new DomainError('Dia da semana inválido pro descanso.')
  }
  if (new Set(weekdays).size > MAX_REST_WEEKDAYS) {
    throw new DomainError(
      `Até ${MAX_REST_WEEKDAYS} dias de descanso por semana. Acima disso o descanso vira a regra, e o ritmo deixa de ser medido.`,
    )
  }
}

/** Os dias válidos, ordenados e dentro do limite. */
export function normalizedRestWeekdays(weekdays: readonly number[]): number[] {
  assertValidRestWeekdays(weekdays)
  return normalizeRestWeekdays(weekdays)
}

/**
 * Há quanto tempo a pessoa está no Momentumm, em semanas.
 *
 * Semanas, e não dias: "12 semanas" conta uma história de constância que "84
 * dias" não conta, e a primeira semana já vale 1 — quem entrou ontem não está
 * há "zero semanas" no app.
 */
export function weeksSince(createdAt: Date, now = new Date()): number {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000)
  return Math.max(1, Math.floor(days / 7) + 1)
}

/** "12 semanas no Momentumm", já no plural certo. */
export function membershipLabel(createdAt: Date, now = new Date()): string {
  const weeks = weeksSince(createdAt, now)
  return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} no Momentumm`
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
