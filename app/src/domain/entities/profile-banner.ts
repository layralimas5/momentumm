import { DomainError } from '@/shared/errors'

/**
 * A capa do perfil.
 *
 * Ou um preset (chave curta que a apresentação transforma em gradiente), ou
 * uma foto reduzida no aparelho, guardada como data URL na própria coluna,
 * exatamente como o avatar. O domínio conhece as chaves e o formato; a cor de
 * cada preset é decisão de tela.
 */
export const BANNER_PRESETS = ['aurora', 'brasa', 'mar', 'floresta', 'noite', 'areia'] as const
export type BannerPreset = (typeof BANNER_PRESETS)[number]

export const BANNER_PRESET_LABELS: Readonly<Record<BannerPreset, string>> = {
  aurora: 'Aurora',
  brasa: 'Brasa',
  mar: 'Mar',
  floresta: 'Floresta',
  noite: 'Noite',
  areia: 'Areia',
}

export const DEFAULT_BANNER: BannerPreset = 'aurora'

/** Teto da coluna: uma foto 1024x360 em JPEG fica bem abaixo disso. */
export const MAX_BANNER_LENGTH = 200_000

export function isBannerPreset(value: string): value is BannerPreset {
  return (BANNER_PRESETS as readonly string[]).includes(value)
}

export function isBannerPhoto(value: string): boolean {
  return value.startsWith('data:image/jpeg;base64,')
}

export function assertValidBanner(banner: string | null): void {
  if (banner === null) return
  if (isBannerPreset(banner)) return
  if (isBannerPhoto(banner) && banner.length <= MAX_BANNER_LENGTH) return
  throw new DomainError('Essa capa não é válida. Escolhe um dos temas ou uma foto.')
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export const MAX_STATUS_LENGTH = 60
export const MAX_STATUS_EMOJI_LENGTH = 8

export interface ProfileStatus {
  readonly emoji: string | null
  readonly text: string | null
}

/** Status vazio dos dois lados vira ausência de status, não um status em branco. */
export function normalizeStatus(input: ProfileStatus | null): ProfileStatus | null {
  if (!input) return null
  const emoji = input.emoji?.trim() || null
  const text = input.text?.trim() || null
  if (!emoji && !text) return null
  return { emoji, text }
}

export function assertValidStatus(status: ProfileStatus | null): void {
  if (!status) return
  if (status.text && status.text.length > MAX_STATUS_LENGTH) {
    throw new DomainError(`O status pode ter no máximo ${MAX_STATUS_LENGTH} caracteres.`)
  }
  if (status.emoji && status.emoji.length > MAX_STATUS_EMOJI_LENGTH) {
    throw new DomainError('Escolhe um emoji só pro status.')
  }
}
