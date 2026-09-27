import { DomainError } from '@/shared/errors'
import { assertValidHandle, normalizeHandle } from './profile'

/**
 * O convite de amigo.
 *
 * O código é o @ de quem convida. Ele já é único, já é público, já é o endereço
 * da pessoa no produto, e cabe num link que dá pra ler em voz alta:
 *
 *   momentumm.app/convite/layra
 *
 * Uma tabela de tokens acrescentaria expiração, uso único e limpeza de órfão
 * pra resolver um problema que aqui não existe: este link NÃO é credencial. Ele
 * não dá acesso a nada — diz de onde a pessoa veio, e só.
 *
 * O que o link faz do outro lado é convidar, não conectar. Entrar por ele não
 * torna ninguém amigo de ninguém: a amizade continua sendo pedido e aceite, dos
 * dois lados, porque acompanhar o progresso de alguém é coisa que se combina.
 */

export const INVITE_PATH = '/convite'

/** O código guardado até a conta existir. Depois disso ele não serve mais. */
export const INVITE_STORAGE_KEY = 'momentumm.convite.v1'

export interface Referral {
  readonly inviteeId: string
  readonly inviterId: string
  readonly createdAt: Date
}

export function inviteCodeOf(handle: string): string {
  return handle.trim().toLowerCase()
}

/** O endereço completo pra compartilhar. A origem vem de quem chama (o app sabe a dele). */
export function inviteUrl(origin: string, handle: string): string {
  return `${origin}${INVITE_PATH}/${inviteCodeOf(handle)}`
}

/**
 * O que veio na URL vira um @ válido, ou nada.
 *
 * Link torto, com espaço, com maiúscula ou com @ na frente é coisa de quem
 * copiou errado — e nada disso deveria virar erro na cara de alguém que está
 * abrindo o produto pela primeira vez. Inválido vira `null`, e a tela de
 * convite simplesmente se comporta como se não houvesse convite.
 */
export function parseInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null

  // `normalizeHandle` limpa (acento, maiúscula, caractere estranho) mas não
  // julga: quem diz se o que sobrou é um @ de verdade é a validação.
  const handle = normalizeHandle(raw.replace(/^@+/, ''))
  try {
    assertValidHandle(handle)
    return handle
  } catch (cause) {
    if (cause instanceof DomainError) return null
    throw cause
  }
}

/** A mensagem que acompanha o link quando a pessoa compartilha. */
export function inviteMessage(name: string, url: string): string {
  return `${name} está usando o Momentumm pra manter a constância. Bora junto? ${url}`
}
