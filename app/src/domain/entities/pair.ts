import { dayKeyOf, type DayKey } from './day'

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

/**
 * Os dias que a dupla enxerga: uma semana.
 *
 * O número mora aqui porque três lugares precisam concordar com ele: a função
 * do banco que monta a faixa (`pair_overview`, migration 0049), o desenho da
 * faixa e o limite do plano. O gratuito vê menos que isso (ver `pairDays` em
 * `plan.ts`), nunca mais.
 */
export const PAIR_DAYS = 7

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

/**
 * Todas as duplas de quem está olhando, numa resposta.
 *
 * `pairs` é sempre uma lista, e é ela que faz a tela do gratuito e a do PRO
 * serem a mesma tela: uma com um item, a outra com vários. `room` vem do
 * servidor pronto, porque quem sabe o teto de cada plano é ele — a tela só
 * precisa saber se ainda pode oferecer o convite.
 */
export interface PairOverview {
  readonly pairs: readonly Pair[]
  /** Quantas duplas o plano permite. `null` é sem teto. */
  readonly max: number | null
  readonly room: boolean
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

/**
 * Já mandei esse gesto hoje? A tela usa pra marcar o botão como enviado.
 *
 * O dia sai de `dayKeyOf`, que lê o calendário LOCAL, e não de
 * `toISOString()`, que lê UTC. A diferença aparece toda noite: às 21h de
 * Brasília o UTC já virou, e um incentivo mandado às 21h30 era contado como de
 * amanhã — o botão voltava a dizer "Bora" como se nada tivesse sido enviado,
 * e o teto do plano dava vaga nova. `local_day_of` no servidor usa o fuso da
 * pessoa, então é esse o dia com que essa conta precisa concordar.
 */
export function alreadySent(
  pair: Pair,
  myId: string,
  kind: EncouragementKind,
  today: DayKey,
): boolean {
  return pair.encouragementsToday.some(
    (item) => item.senderId === myId && item.kind === kind && dayKeyOf(item.createdAt) === today,
  )
}

/**
 * Quantos incentivos eu já mandei hoje, somando os três gestos.
 *
 * É o que o teto do plano conta. Diferente de `alreadySent`, que responde por
 * um gesto só, esta olha o dia inteiro: no gratuito o dia tem uma vaga, e ela
 * pode ser gasta com qualquer um dos três.
 */
export function sentTodayCount(pair: Pair, myId: string, today: DayKey): number {
  return pair.encouragementsToday.filter(
    (item) => item.senderId === myId && dayKeyOf(item.createdAt) === today,
  ).length
}

/** Os incentivos que a outra pessoa mandou e eu ainda não vi. */
export function unreadFor(pair: Pair, myId: string): readonly Encouragement[] {
  return pair.encouragementsToday.filter(
    (item) => item.recipientId === myId && item.readAt === null,
  )
}
