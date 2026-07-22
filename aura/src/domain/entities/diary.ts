/**
 * Entrada de diário — um registro livre da usuária sobre o dia dela.
 * Camada de domínio: pura, sem dependências externas.
 */

export interface DiaryEntry {
  readonly id: string
  readonly userId: string
  content: string
  readonly createdAt: string
}

export interface NewDiaryEntry {
  content: string
}

export const DiaryRules = {
  minLength: 1,
  maxLength: 5000,

  isValid(content: string): boolean {
    const c = content.trim()
    return c.length >= this.minLength && c.length <= this.maxLength
  },
} as const
