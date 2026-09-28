import { DomainError } from '@/shared/errors'
import type { ProfileVisibility } from './profile'

/**
 * O laço entre duas pessoas, e o que ele permite.
 *
 * `follow.ts` descreve a LINHA (quem segue quem). Este arquivo descreve o
 * ESTADO que a tela precisa pra desenhar um botão e decidir o que mostrar, que
 * é outra coisa: quatro perguntas que só fazem sentido juntas.
 *
 * ## O que mudou em relação à 0060
 *
 * Quando `follows` nasceu, seguir não abria nada: era contagem. Com o feed,
 * seguir passou a ser a porta do conteúdo, e é por isso que o pedido de
 * aprovação entrou junto. Perfil aberto aceita na hora; perfil fechado
 * responde. Sem a segunda metade, abrir o feed teria transformado toda conta
 * fechada em conta aberta sem ninguém escolher isso.
 */

export interface FollowState {
  /** Eu sigo, e foi aceito. */
  readonly following: boolean
  /** Eu pedi e ainda não responderam. */
  readonly requested: boolean
  /** Essa pessoa me segue. */
  readonly followsMe: boolean
  /** Eu bloqueei essa pessoa. */
  readonly blocked: boolean
}

export const NO_FOLLOW_STATE: FollowState = {
  following: false,
  requested: false,
  followsMe: false,
  blocked: false,
}

export interface SocialCounts {
  readonly followers: number
  readonly following: number
  readonly posts: number
}

export const EMPTY_SOCIAL_COUNTS: SocialCounts = { followers: 0, following: 0, posts: 0 }

/** O cartão de visita de alguém numa lista: busca, seguidores, sugestões. */
export interface ProfileCard {
  readonly id: string
  readonly name: string
  readonly handle: string
  readonly avatarUrl: string | null
  readonly bio?: string | null
}

export interface FollowRequest extends ProfileCard {
  readonly since: Date
}

export type FollowListKind = 'seguidores' | 'seguindo'

/**
 * O rótulo do botão, derivado do estado. Uma função e não quatro `if` na tela,
 * porque o botão aparece no perfil, na busca, na sugestão e na lista, e quatro
 * cópias escreveriam "Solicitado" de quatro jeitos.
 */
export function followButtonLabel(state: FollowState): string {
  if (state.blocked) return 'Desbloquear'
  if (state.following) return 'Seguindo'
  if (state.requested) return 'Solicitado'
  if (state.followsMe) return 'Seguir de volta'
  return 'Seguir'
}

/**
 * Posso ver o conteúdo dessa pessoa?
 *
 * É o espelho de `can_view_content_of` no banco, e existe só pra a tela
 * escolher ENTRE "grade de publicações" e "esse perfil é fechado" sem pedir as
 * publicações e receber uma lista vazia. Quem decide de verdade continua sendo
 * a RLS: se esta função e o banco discordarem, quem ganha é o banco, e a tela
 * mostra o estado vazio em vez de conteúdo.
 */
export function canSeeContent(
  visibility: ProfileVisibility,
  state: FollowState,
  isSelf: boolean,
): boolean {
  if (isSelf) return true
  if (state.blocked) return false
  if (visibility === 'publico') return true
  return state.following
}

/** Perfil fechado é `privado` e `amigos`: os dois exigem aprovação pra seguir. */
export function isClosedProfile(visibility: ProfileVisibility): boolean {
  return visibility !== 'publico'
}

// ---------------------------------------------------------------------------
// bloqueio e denúncia
// ---------------------------------------------------------------------------

export const REPORT_TARGETS = ['publicacao', 'comentario', 'story', 'pessoa'] as const
export type ReportTarget = (typeof REPORT_TARGETS)[number]

export const REPORT_REASONS = [
  'spam',
  'assedio',
  'conteudo-sexual',
  'violencia',
  'desinformacao',
  'outro',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
  spam: 'Spam ou propaganda',
  assedio: 'Assédio ou discurso de ódio',
  'conteudo-sexual': 'Conteúdo sexual',
  violencia: 'Violência',
  desinformacao: 'Informação falsa',
  outro: 'Outro motivo',
}

export const MAX_REPORT_NOTE = 500

export interface NewReportInput {
  readonly targetKind: ReportTarget
  readonly targetId: string
  readonly reason: ReportReason
  readonly note: string | null
}

export function assertValidReport(input: NewReportInput): void {
  if (input.note && input.note.trim().length > MAX_REPORT_NOTE) {
    throw new DomainError(`O relato pode ter no máximo ${MAX_REPORT_NOTE} caracteres.`)
  }
}

export function assertCanBlock(me: string, other: string): void {
  if (me === other) {
    throw new DomainError('Você não pode bloquear você mesmo.')
  }
}
