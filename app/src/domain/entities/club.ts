import { DomainError } from '@/shared/errors'
import { BANNER_PRESETS, type BannerPreset } from './profile-banner'

/**
 * O clube.
 *
 * O produto já tinha as duas pontas do social: o círculo (gente próxima) e o
 * desafio (um combinado com prazo e meta). O clube é o meio — dura mais que um
 * desafio e cabe mais gente que um círculo.
 *
 * ## O que atravessa a fronteira do clube
 *
 * Só o dia cumprido dentro dos desafios DELE, que é um número que cada pessoa
 * já publica ao participar. Nenhum hábito, nenhuma ação, nenhum registro: o
 * clube vê o que foi publicado pra ele, e nada além. Isso não é uma decisão de
 * tela — é o desenho da função que monta o ranking, no banco.
 *
 * ## Criar é do PRO; perder o PRO não apaga nada
 *
 * A assinatura é exigida pra CRIAR e pra ADMINISTRAR. Se ela cair, o clube
 * continua inteiro: membros, histórico e ranking seguem. O dono vira um membro
 * como os outros até voltar. Apagar a comunidade de um grupo de gente porque
 * um boleto venceu seria destruir o trabalho de terceiros por uma dívida que
 * não é deles.
 */

export const CLUB_CATEGORIES = [
  'estudo',
  'treino',
  'leitura',
  'meditacao',
  'trabalho',
  'financas',
  'geral',
] as const
export type ClubCategory = (typeof CLUB_CATEGORIES)[number]

export const CLUB_CATEGORY_LABELS: Readonly<Record<ClubCategory, string>> = {
  estudo: 'Estudo',
  treino: 'Treino',
  leitura: 'Leitura',
  meditacao: 'Meditação',
  trabalho: 'Trabalho',
  financas: 'Finanças',
  geral: 'Geral',
}

export const CLUB_PRIVACIES = ['aberto', 'convite'] as const
export type ClubPrivacy = (typeof CLUB_PRIVACIES)[number]

export const CLUB_PRIVACY_LABELS: Readonly<Record<ClubPrivacy, string>> = {
  aberto: 'Aberto',
  convite: 'Por convite',
}

export const CLUB_PRIVACY_HINTS: Readonly<Record<ClubPrivacy, string>> = {
  aberto: 'Aparece na busca e qualquer pessoa pode entrar.',
  convite: 'Não aparece pra ninguém. Só entra quem você chamar.',
}

export const MAX_CLUB_NAME = 60
export const MIN_CLUB_NAME = 3
export const MAX_CLUB_DESCRIPTION = 280

export type ClubRole = 'dono' | 'membro'

export interface Club {
  readonly id: string
  readonly ownerId: string
  readonly name: string
  readonly description: string | null
  readonly category: ClubCategory
  /** Chave de preset visual: as mesmas capas do perfil. */
  readonly cover: BannerPreset
  readonly privacy: ClubPrivacy
  readonly createdAt: Date
  readonly archivedAt: Date | null
}

export interface ClubMember {
  readonly clubId: string
  readonly userId: string
  readonly role: ClubRole
  readonly joinedAt: Date
}

export interface NewClubInput {
  readonly name: string
  readonly description: string | null
  readonly category: ClubCategory
  readonly cover: BannerPreset
  readonly privacy: ClubPrivacy
}

/** Uma linha do ranking do clube, como o servidor devolve: sem uuid solto na tela. */
export interface ClubRankedMember {
  readonly userId: string
  readonly name: string
  readonly avatarUrl: string | null
  readonly days: number
  /** Começa em 1. Empate recebe a mesma posição. */
  readonly position: number
}

export function assertValidClubName(name: string): void {
  const clean = name.trim()
  if (clean.length < MIN_CLUB_NAME || clean.length > MAX_CLUB_NAME) {
    throw new DomainError(`O nome do clube precisa ter de ${MIN_CLUB_NAME} a ${MAX_CLUB_NAME} caracteres.`)
  }
}

export function assertValidClubDescription(description: string | null): void {
  if (description && description.trim().length > MAX_CLUB_DESCRIPTION) {
    throw new DomainError(`A descrição do clube cabe em ${MAX_CLUB_DESCRIPTION} caracteres.`)
  }
}

export function isClubCategory(value: string): value is ClubCategory {
  return (CLUB_CATEGORIES as readonly string[]).includes(value)
}

export function isClubCover(value: string): value is BannerPreset {
  return (BANNER_PRESETS as readonly string[]).includes(value)
}

export function isClubRunning(club: Club): boolean {
  return club.archivedAt === null
}

/**
 * A posição de cada um, a partir da lista já ordenada pelo servidor.
 *
 * Empate mantém a mesma posição, como no desafio: duas pessoas com nove dias
 * estão no mesmo lugar, e desempatar por horário premiaria quem acordou cedo.
 */
export function rankClubMembers(
  rows: readonly { userId: string; name: string; avatarUrl: string | null; days: number }[],
): ClubRankedMember[] {
  let position = 0
  let previous: number | null = null

  return rows.map((row, index) => {
    if (previous === null || row.days < previous) {
      position = index + 1
      previous = row.days
    }
    return { ...row, position }
  })
}

/**
 * O dono continua dono sem assinatura — o que ele perde é a administração.
 *
 * A tela pergunta isso pra decidir entre mostrar os controles e mostrar o
 * aviso. A garantia de verdade está na política do banco, que recusa a escrita
 * de qualquer jeito.
 */
export function canAdminister(club: Club, userId: string | null, isPro: boolean): boolean {
  return userId !== null && club.ownerId === userId && isPro && isClubRunning(club)
}
