import { describe, expect, it } from 'vitest'
import {
  createChallenge,
  createParticipant,
  type Challenge,
  type ChallengeParticipant,
} from './challenge'
import {
  challengeEventsToRecord,
  type ChallengeRecorderEntry,
} from './challenge-recorder'
import { addDays, parseDayKey } from './day'
import { createJourneyEvent, type JourneyEvent, type NewJourneyEventInput } from './journey-event'

const EU = 'user-eu'
const TODAY = parseDayKey('2026-09-07')

const CHALLENGE: Challenge = createChallenge(
  {
    ownerId: EU,
    name: 'Treinar 20 dias no mês',
    axis: 'treino',
    mode: 'total',
    target: 20,
    dailyTarget: 20,
    startsOn: addDays(TODAY, -10),
    endsOn: addDays(TODAY, 19),
  },
  'c1',
)

function entry(patch: {
  doneDays?: number
  closedToday?: boolean
  participant?: Partial<ChallengeParticipant>
} = {}): ChallengeRecorderEntry {
  const participant = {
    ...createParticipant({ challengeId: 'c1', userId: EU, status: 'ativo' }, 'p1'),
    doneDays: patch.doneDays ?? 0,
    ...patch.participant,
  }

  return {
    challenge: CHALLENGE,
    participant,
    closedToday: patch.closedToday ?? false,
    people: 3,
  }
}

function recorded(input: NewJourneyEventInput, day = TODAY): JourneyEvent {
  return {
    ...createJourneyEvent(input, `e-${input.type}-${input.sourceId}`),
    day,
  }
}

function run(entries: readonly ChallengeRecorderEntry[], existing: readonly JourneyEvent[] = []) {
  return challengeEventsToRecord({ today: TODAY, momentum: null, entries, existing })
}

describe('entrar no desafio', () => {
  it('grava a entrada uma vez só, em qualquer dia', () => {
    const first = run([entry()])
    expect(first.map((event) => event.type)).toContain('challenge_joined')

    const already = recorded(
      { userId: EU, type: 'challenge_joined', sourceType: 'challenge', sourceId: 'c1', title: 'x' },
      // Outro dia de propósito: entrada é evento de VIDA, e a chave dela ignora
      // a data. Gravar de novo amanhã seria "entrou no desafio" toda manhã.
      addDays(TODAY, -3),
    )

    const second = run([entry()], [already])
    expect(second.map((event) => event.type)).not.toContain('challenge_joined')
  })

  it('ignora quem só foi convidado e ainda não respondeu', () => {
    const events = run([entry({ participant: { status: 'convidado' } })])
    expect(events).toEqual([])
  })

  it('ignora quem saiu', () => {
    const events = run([entry({ participant: { status: 'saiu' }, doneDays: 12 })])
    expect(events).toEqual([])
  })
})

describe('avançar', () => {
  it('grava o avanço só no dia em que um dia do desafio fechou', () => {
    const parado = run([entry({ doneDays: 4, closedToday: false })])
    expect(parado.map((event) => event.type)).not.toContain('challenge_progress')

    const andou = run([entry({ doneDays: 4, closedToday: true })])
    expect(andou.map((event) => event.type)).toContain('challenge_progress')
  })

  it('não grava dois avanços no mesmo dia', () => {
    const already = recorded({
      userId: EU,
      type: 'challenge_progress',
      sourceType: 'challenge',
      sourceId: 'c1',
      title: 'x',
    })

    const events = run([entry({ doneDays: 4, closedToday: true })], [already])
    expect(events.map((event) => event.type)).not.toContain('challenge_progress')
  })

  it('leva os dois lados da fração, e nunca só o percentual', () => {
    const [event] = run([entry({ doneDays: 4, closedToday: true })]).filter(
      (item) => item.type === 'challenge_progress',
    )

    expect(event?.metadata?.challengeDoneDays).toBe(4)
    expect(event?.metadata?.challengeRequiredDays).toBe(20)
  })
})

describe('marco', () => {
  it('grava a faixa cruzada e não repete no dia seguinte', () => {
    const events = run([entry({ doneDays: 10, closedToday: true })])
    const marco = events.find((event) => event.type === 'challenge_milestone')

    expect(marco?.sourceId).toBe('c1:50')

    const already = recorded(
      {
        userId: EU,
        type: 'challenge_milestone',
        sourceType: 'challenge',
        sourceId: 'c1:50',
        title: 'x',
      },
      addDays(TODAY, -1),
    )

    const again = run([entry({ doneDays: 10, closedToday: true })], [already])
    expect(again.map((event) => event.type)).not.toContain('challenge_milestone')
  })

  it('o marco do dia cala o avanço: a mesma notícia não sai duas vezes', () => {
    const events = run([entry({ doneDays: 10, closedToday: true })])
    expect(events.map((event) => event.type)).not.toContain('challenge_progress')
  })

  it('quando o marco já foi gravado, o avanço do dia volta a valer', () => {
    const already = recorded(
      {
        userId: EU,
        type: 'challenge_milestone',
        sourceType: 'challenge',
        sourceId: 'c1:50',
        title: 'x',
      },
      addDays(TODAY, -1),
    )

    const events = run([entry({ doneDays: 11, closedToday: true })], [already])
    expect(events.map((event) => event.type)).toContain('challenge_progress')
  })
})

describe('concluir', () => {
  it('fecha com a conclusão, sem marco nem avanço junto', () => {
    const types = run([entry({ doneDays: 20, closedToday: true })]).map((event) => event.type)

    expect(types).toContain('challenge_completed')
    expect(types).not.toContain('challenge_milestone')
    expect(types).not.toContain('challenge_progress')
  })

  it('não grava a conclusão duas vezes', () => {
    const already = recorded(
      {
        userId: EU,
        type: 'challenge_completed',
        sourceType: 'challenge',
        sourceId: 'c1',
        title: 'x',
      },
      addDays(TODAY, -2),
    )

    const events = run([entry({ doneDays: 20, closedToday: true })], [already])
    expect(events.map((event) => event.type)).not.toContain('challenge_completed')
  })
})

describe('privacidade', () => {
  it('todo evento de desafio nasce privado', () => {
    const events = run([entry({ doneDays: 10, closedToday: true })])
    expect(events.every((event) => event.visibility === undefined)).toBe(true)
  })

  it('não carrega momentum: o desafio não compara score entre pessoas', () => {
    const events = run([entry({ doneDays: 4, closedToday: true })])
    expect(events.every((event) => event.momentumAfter === null)).toBe(true)
  })

  it('conta quantas pessoas estão dentro, nunca quem são', () => {
    const [event] = run([entry({ doneDays: 4, closedToday: true })])
    expect(event?.metadata?.challengePeople).toBe(3)
    expect(JSON.stringify(event?.metadata)).not.toContain('user-')
  })
})

describe('rodar de novo', () => {
  it('não duplica nada quando o estado não mudou', () => {
    const first = run([entry({ doneDays: 4, closedToday: true })])
    const saved = first.map((event) =>
      recorded({ ...event, userId: EU } as NewJourneyEventInput),
    )

    expect(run([entry({ doneDays: 4, closedToday: true })], saved)).toEqual([])
  })
})
