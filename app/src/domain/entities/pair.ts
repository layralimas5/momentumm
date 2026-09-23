import type { DayKey } from './day'

/**
 * Juntos — a dupla de accountability.
 *
 * O produto inteiro é sobre alguém avançar nos próprios objetivos. A dupla
 * existe pra testar UMA hipótese: ter outra pessoa vendo que você avançou faz
 * você voltar amanhã. Tudo que não ajuda a testar isso ficou de fora — feed,
 * comentário, ranking, descoberta, chat.
 *
 * ## O contrato de privacidade, do lado do app
 *
 * O que chega aqui do servidor JÁ É só isto: nome curto, avatar, e um booleano
 * por dia. Não existe campo pra título de ação, objetivo, nota ou XP, e não é
 * porque a tela não mostra — é porque a função do banco não devolve (ver a
 * migration 0049). Esse tipo é o contrato: se um dia alguém precisar mostrar
 * mais, vai precisar mudar o banco, e aí a decisão aparece numa revisão.
 */

export const ENCOURAGEMENT_KINDS = ['bora', 'mandou_bem', 'to_contigo'] as const
export type EncouragementKind = (typeof ENCOURAGEMENT_KINDS)[number]

export interface EncouragementSpec {
  readonly kind: EncouragementKind
  readonly emoji: string
  readonly label: string
  /** O que a pessoa está dizendo. Aparece como legenda do botão. */
  readonly hint: string
}

/**
 * Três gestos, e a escolha de cada um tem motivo.
 *
 * "Bora" chama pra ação, "mandou bem" reconhece o que já saiu e "tô contigo"
 * é o único que serve pro dia ruim — e é ele que o app sugere quando a outra
 * pessoa está retomando, porque cobrar quem já está voltando é o jeito mais
 * rápido de fazer ela parar de novo.
 */
export const ENCOURAGEMENTS: readonly EncouragementSpec[] = [
  { kind: 'bora', emoji: '🔥', label: 'Bora', hint: 'Um empurrão pro dia de hoje' },
  { kind: 'mandou_bem', emoji: '👏', label: 'Mandou bem', hint: 'Reconhece o que já saiu' },
  { kind: 'to_contigo', emoji: '❤️', label: 'Tô contigo', hint: 'Pro dia que não foi fácil' },
]

export function encouragementSpec(kind: EncouragementKind): EncouragementSpec {
  return ENCOURAGEMENTS.find((item) => item.kind === kind) ?? ENCOURAGEMENTS[0]!
}

export interface PairDay {
  readonly day: DayKey
  readonly advanced: boolean
}

export interface PairMember {
  readonly userId: string
  readonly isMe: boolean
  /** Primeiro nome. O sobrenome não atravessa a dupla. */
  readonly name: string
  readonly avatarUrl: string | null
  readonly advancedToday: boolean
  /** Os últimos sete dias, do mais antigo pro mais recente. */
  readonly days: readonly PairDay[]
}

export interface Encouragement {
  readonly id: string
  readonly kind: EncouragementKind
  readonly senderId: string
  readonly recipientId: string
  readonly createdAt: Date
  readonly readAt: Date | null
}

export interface Pair {
  readonly id: string
  readonly createdAt: Date
  /** Dias seguidos em que as DUAS avançaram. Nunca diz qual das duas parou. */
  readonly daysTogether: number
  readonly members: readonly PairMember[]
  readonly encouragementsToday: readonly Encouragement[]
}

export interface PairInvite {
  readonly id: string
  /** O token em claro. O servidor devolve UMA vez, na criação. */
  readonly token: string
  readonly expiresAt: Date
}

export const INVITE_STATUSES = [
  'pendente',
  'aceito',
  'recusado',
  'expirado',
  'cancelado',
  'invalido',
] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]

export interface InvitePreview {
  readonly status: InviteStatus
  readonly inviterName: string | null
  readonly inviterAvatar: string | null
  readonly expiresAt: Date | null
  /** Falso quando não há sessão, ou quando é o próprio convite. */
  readonly canAccept: boolean
}

// ---------------------------------------------------------------------------
// leitura da dupla
// ---------------------------------------------------------------------------

/** O estado da dupla hoje. É ele que decide o que a tela oferece. */
export type PairMood =
  /** As duas avançaram hoje. */
  | 'as-duas'
  /** Só quem está olhando avançou. */
  | 'so-eu'
  /** Só a outra pessoa avançou. */
  | 'so-ela'
  /** Nenhuma das duas avançou ainda hoje. */
  | 'nenhuma'

export interface PairReading {
  readonly mood: PairMood
  /** O cabeçalho da tela. */
  readonly headline: string
  readonly note: string
  /** O gesto que faz mais sentido agora. A tela destaca esse. */
  readonly suggested: EncouragementKind
  /** A outra pessoa está voltando de uma pausa: muda o tom de tudo. */
  readonly partnerReturning: boolean
  /** As duas pararam: o convite é voltar junto, com uma ação pequena. */
  readonly bothAway: boolean
}

/** A partir de quantos dias sem avanço a pessoa conta como "retomando". */
export const PARTNER_AWAY_DAYS = 2

/**
 * O que a tela do Juntos diz hoje.
 *
 * Nenhuma frase aqui aponta o dedo. "Carol falhou" não existe; o mais perto
 * disso que o app chega é "Carol está retomando o ritmo", que é uma descrição
 * do que está acontecendo e não um julgamento de quem ela é.
 */
export function readPair(pair: Pair): PairReading | null {
  const me = pair.members.find((member) => member.isMe)
  const partner = pair.members.find((member) => !member.isMe)
  if (!me || !partner) return null

  const partnerReturning = daysAway(partner) >= PARTNER_AWAY_DAYS
  const bothAway = partnerReturning && daysAway(me) >= PARTNER_AWAY_DAYS

  if (bothAway) {
    return {
      mood: 'nenhuma',
      headline: 'Vocês não perderam o progresso.',
      note: 'Que tal voltarem com uma ação pequena hoje? Uma de cada lado já recomeça a contagem.',
      suggested: 'to_contigo',
      partnerReturning,
      bothAway,
    }
  }

  if (partnerReturning) {
    return {
      mood: me.advancedToday ? 'so-eu' : 'nenhuma',
      headline: `${partner.name} está retomando o ritmo.`,
      note: 'Um recado agora vale mais do que em qualquer outro dia.',
      suggested: 'to_contigo',
      partnerReturning,
      bothAway,
    }
  }

  if (me.advancedToday && partner.advancedToday) {
    return {
      mood: 'as-duas',
      headline: 'Vocês estão em movimento juntas.',
      note:
        pair.daysTogether > 1
          ? `${pair.daysTogether} dias seguidos com as duas avançando.`
          : 'As duas avançaram hoje.',
      suggested: 'mandou_bem',
      partnerReturning,
      bothAway,
    }
  }

  if (partner.advancedToday) {
    return {
      mood: 'so-ela',
      headline: `${partner.name} avançou hoje.`,
      note: 'Sua vez: uma ação pequena já mantém as duas em movimento.',
      suggested: 'mandou_bem',
      partnerReturning,
      bothAway,
    }
  }

  if (me.advancedToday) {
    return {
      mood: 'so-eu',
      headline: 'Você avançou hoje.',
      note: `${partner.name} ainda não. Um empurrão ajuda.`,
      suggested: 'bora',
      partnerReturning,
      bothAway,
    }
  }

  return {
    mood: 'nenhuma',
    headline: 'O dia ainda está aberto pras duas.',
    note: 'Quem começar primeiro puxa a outra.',
    suggested: 'bora',
    partnerReturning,
    bothAway,
  }
}

/**
 * Dias sem avanço imediatamente antes de hoje.
 *
 * O dia de hoje não conta: ele ainda está acontecendo, e tratar uma manhã sem
 * movimento como "um dia parado" faria o app cobrar às oito da manhã.
 */
export function daysAway(member: PairMember): number {
  const anteriores = member.days.slice(0, -1)
  let gap = 0
  for (let index = anteriores.length - 1; index >= 0; index -= 1) {
    if (anteriores[index]?.advanced) break
    gap += 1
  }
  return gap
}

/** Já mandei esse gesto hoje? A tela usa pra marcar o botão como enviado. */
export function alreadySent(
  pair: Pair,
  myId: string,
  kind: EncouragementKind,
  today: DayKey,
): boolean {
  return pair.encouragementsToday.some(
    (item) =>
      item.senderId === myId &&
      item.kind === kind &&
      item.createdAt.toISOString().slice(0, 10) === today,
  )
}

/** Os incentivos que a outra pessoa mandou e eu ainda não vi. */
export function unreadFor(pair: Pair, myId: string): readonly Encouragement[] {
  return pair.encouragementsToday.filter(
    (item) => item.recipientId === myId && item.readAt === null,
  )
}
