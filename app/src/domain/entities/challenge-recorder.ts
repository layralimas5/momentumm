import {
  isParticipating,
  progressOf,
  requiredDays,
  type Challenge,
  type ChallengeParticipant,
} from './challenge'
import type { DayKey } from './day'
import type { JourneyEvent, NewJourneyEventInput } from './journey-event'

/**
 * O que dos desafios de hoje merece virar momento.
 *
 * Mesma forma do `journey-recorder`, e de propósito: função pura, recebe o
 * estado mais os eventos já gravados e devolve só o que falta. Rodar de novo
 * não duplica nada, e dá pra provar isso sem banco.
 *
 * Ela vive num arquivo separado porque o outro recorder lê o DIA (hábito,
 * rotina, momentum) e este lê um COMBINADO entre pessoas. Juntar os dois faria
 * o gravador do dia depender de participante e de convite pra decidir se o
 * hábito da manhã virou registro.
 *
 * ## As duas chaves, de novo
 *
 * Entrada, marco e conclusão acontecem uma vez na vida do desafio: a chave
 * ignora a data. Avanço é do DIA — a chave inclui a data, e por isso ele sai no
 * máximo uma vez por dia por desafio.
 */

export interface ChallengeRecorderEntry {
  readonly challenge: Challenge
  /** A participação de quem está logado. Só ela vira evento dele. */
  readonly participant: ChallengeParticipant
  /** Essa pessoa fechou um dia do desafio HOJE? */
  readonly closedToday: boolean
  /** Quantas pessoas estão participando. Nunca quem são. */
  readonly people: number
}

export interface ChallengeRecorderInput {
  readonly today: DayKey
  readonly momentum: { readonly value: number; readonly delta: number } | null
  readonly entries: readonly ChallengeRecorderEntry[]
  /** Tudo que já foi gravado. É o que impede a segunda gravação. */
  readonly existing: readonly JourneyEvent[]
}

export type RecordableChallengeEvent = Omit<NewJourneyEventInput, 'userId'>

/**
 * Faixas que valem registro.
 *
 * As mesmas do objetivo, e pelo mesmo motivo: passar de 74% pra 75% é notícia,
 * passar de 74% pra 76% não é. Os 100% saem como conclusão, que é um evento
 * diferente e com outro peso.
 */
const CHALLENGE_MARKS = [0.25, 0.5, 0.75] as const

export function challengeEventsToRecord(
  input: ChallengeRecorderInput,
): RecordableChallengeEvent[] {
  const events: RecordableChallengeEvent[] = []
  const seenToday = dayKeys(input.existing, input.today)
  const seenEver = lifeKeys(input.existing)

  const push = (event: RecordableChallengeEvent, sourceId: string, perDay: boolean): void => {
    const composed = key(event.type, sourceId)
    const seen = perDay ? seenToday : seenEver
    if (seen.has(composed)) return
    events.push(event)
    seen.add(composed)
  }

  for (const entry of input.entries) {
    const { challenge, participant } = entry
    if (!isParticipating(participant)) continue

    const progress = progressOf(challenge, participant, input.today)
    const base = {
      sourceType: 'challenge' as const,
      title: challenge.name,
      metadata: {
        axis: challenge.axis,
        challengeDoneDays: progress.done,
        challengeRequiredDays: requiredDays(challenge),
        challengePeople: entry.people,
      },
      ...momentumOf(input),
    }

    // ---- entrou ----------------------------------------------------------
    push(
      {
        ...base,
        type: 'challenge_joined',
        sourceId: challenge.id,
        completionPercentage: 0,
      },
      challenge.id,
      false,
    )

    // ---- concluiu --------------------------------------------------------
    if (progress.ratio >= 1) {
      push(
        {
          ...base,
          type: 'challenge_completed',
          sourceId: challenge.id,
          completionPercentage: 1,
          progressAfter: 1,
        },
        challenge.id,
        false,
      )
      // Quem fechou não precisa de mais marco nem de mais avanço: a conclusão
      // é o último capítulo, e publicar "avançou" no mesmo dia contaria a
      // mesma coisa duas vezes.
      continue
    }

    // ---- marco -----------------------------------------------------------
    const mark = highestMarkReached(progress.ratio)
    if (mark !== null) {
      const sourceId = `${challenge.id}:${Math.round(mark * 100)}`
      const before = events.length
      push(
        {
          ...base,
          type: 'challenge_milestone',
          sourceId,
          completionPercentage: progress.ratio,
          progressAfter: progress.ratio,
        },
        sourceId,
        false,
      )
      // Marco novo hoje já é a notícia do dia: o avanço seria a versão
      // menor da mesma frase, lado a lado no feed.
      if (events.length > before) continue
    }

    // ---- avançou ---------------------------------------------------------
    if (entry.closedToday) {
      const sourceId = challenge.id
      push(
        {
          ...base,
          type: 'challenge_progress',
          sourceId,
          completionPercentage: progress.ratio,
          progressAfter: progress.ratio,
        },
        sourceId,
        true,
      )
    }
  }

  return events
}

function momentumOf(input: ChallengeRecorderInput): {
  momentumBefore: number | null
  momentumAfter: number | null
} {
  if (!input.momentum) return { momentumBefore: null, momentumAfter: null }
  return {
    momentumBefore: input.momentum.value - input.momentum.delta,
    momentumAfter: input.momentum.value,
  }
}

function key(type: string, sourceId: string): string {
  return `${type}:${sourceId}`
}

function dayKeys(existing: readonly JourneyEvent[], today: DayKey): Set<string> {
  const keys = new Set<string>()
  for (const event of existing) {
    if (event.day === today && event.sourceId) keys.add(key(event.type, event.sourceId))
  }
  return keys
}

function lifeKeys(existing: readonly JourneyEvent[]): Set<string> {
  const keys = new Set<string>()
  for (const event of existing) {
    if (event.sourceId) keys.add(key(event.type, event.sourceId))
  }
  return keys
}

function highestMarkReached(ratio: number): number | null {
  let reached: number | null = null
  for (const mark of CHALLENGE_MARKS) {
    if (ratio >= mark) reached = mark
  }
  return reached
}
