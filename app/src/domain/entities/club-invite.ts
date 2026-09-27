import type { BannerPreset } from './profile-banner'
import type { ClubCategory } from './club'

/**
 * O convite de clube, nas duas formas que ele existe.
 *
 * ## O nominal
 *
 * O dono chama alguém que já tem conta. O convite NÃO coloca a pessoa dentro:
 * ele chega como aviso, e quem entra é quem aceita. Entrar em grupo sem ter
 * dito sim é a definição de spam, e um produto que faz isso uma vez perde a
 * confiança que a comunidade inteira depende.
 *
 * ## O link
 *
 * Um endereço por clube, que o dono manda pra qualquer lugar. Ele vale
 * inclusive no clube por convite: ter o link É o convite. Um link que só
 * funcionasse em clube aberto não resolveria nada que o botão "entrar" já não
 * resolvesse.
 */
export interface ClubInvitation {
  readonly id: string
  readonly clubId: string
  readonly clubName: string
  readonly clubCategory: ClubCategory
  readonly clubCover: BannerPreset
  readonly inviterName: string
  readonly inviterAvatar: string | null
  readonly createdAt: Date
}

export type ClubInviteStatus = 'valido' | 'arquivado' | 'invalido'

/** O que quem abre o link vê antes de entrar, com ou sem conta. */
export interface ClubInvitePreview {
  readonly status: ClubInviteStatus
  readonly clubId: string | null
  readonly name: string | null
  readonly description: string | null
  readonly category: ClubCategory | null
  readonly cover: BannerPreset | null
  readonly members: number
  readonly alreadyMember: boolean
  /** Falso sem sessão: a tela manda criar conta antes, sem perder o link. */
  readonly canJoin: boolean
}

/** O endereço do link, montado no cliente a partir do token. */
export function clubInviteUrl(origin: string, token: string): string {
  return `${origin}/clube/${token}`
}

/**
 * O texto que acompanha o link quando ele é compartilhado.
 *
 * Fica no domínio porque a folha nativa e a área de transferência precisam da
 * mesma frase, e duas cópias viram duas mensagens diferentes na primeira
 * edição.
 */
export function clubInviteMessage(clubName: string, url: string): string {
  return `Entra no ${clubName} comigo no Momentumm: ${url}`
}
