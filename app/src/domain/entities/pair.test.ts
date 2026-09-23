import { describe, expect, it } from 'vitest'
import { addDays, parseDayKey } from './day'
import {
  alreadySent,
  daysAway,
  readPair,
  unreadFor,
  type Pair,
  type PairMember,
} from './pair'

const TODAY = parseDayKey('2026-09-23')
const EU = 'me-1'
const ELA = 'ela-1'

/** `advanced` do mais antigo pro mais recente, como o servidor devolve. */
function member(
  id: string,
  isMe: boolean,
  name: string,
  advanced: readonly boolean[],
): PairMember {
  return {
    userId: id,
    isMe,
    name,
    avatarUrl: null,
    advancedToday: advanced[advanced.length - 1] ?? false,
    days: advanced.map((value, index) => ({
      day: addDays(TODAY, -(advanced.length - 1 - index)),
      advanced: value,
    })),
  }
}

function pair(mine: readonly boolean[], theirs: readonly boolean[], daysTogether = 0): Pair {
  return {
    id: 'pair-1',
    createdAt: new Date('2026-09-01'),
    daysTogether,
    members: [member(EU, true, 'Lay', mine), member(ELA, false, 'Carol', theirs)],
    encouragementsToday: [],
  }
}

const SEMANA_CHEIA = [true, true, true, true, true, true, true]
const SEMANA_VAZIA = [false, false, false, false, false, false, false]

describe('readPair', () => {
  it('as duas avançaram: o tom é de continuidade, com a contagem conjunta', () => {
    const reading = readPair(pair(SEMANA_CHEIA, SEMANA_CHEIA, 4))
    expect(reading?.mood).toBe('as-duas')
    expect(reading?.note).toBe('4 dias seguidos com as duas avançando.')
    expect(reading?.suggested).toBe('mandou_bem')
  })

  it('só a outra avançou: a chamada é pra mim, não cobrança dela', () => {
    const reading = readPair(pair([true, true, true, true, true, true, false], SEMANA_CHEIA))
    expect(reading?.mood).toBe('so-ela')
    expect(reading?.headline).toBe('Carol avançou hoje.')
  })

  it('só eu avancei: o gesto sugerido é o empurrão', () => {
    const reading = readPair(pair(SEMANA_CHEIA, [true, true, true, true, true, true, false]))
    expect(reading?.mood).toBe('so-eu')
    expect(reading?.suggested).toBe('bora')
  })

  it('parceira voltando de uma pausa sugere apoio, nunca cobrança', () => {
    const reading = readPair(pair(SEMANA_CHEIA, [true, true, true, true, false, false, false]))
    expect(reading?.partnerReturning).toBe(true)
    expect(reading?.headline).toBe('Carol está retomando o ritmo.')
    expect(reading?.suggested).toBe('to_contigo')
  })

  it('as duas paradas: o convite é voltar junto com algo pequeno', () => {
    const reading = readPair(pair(SEMANA_VAZIA, SEMANA_VAZIA))
    expect(reading?.bothAway).toBe(true)
    expect(reading?.headline).toBe('Vocês não perderam o progresso.')
  })

  it('nenhuma frase culpa a outra pessoa', () => {
    const cenarios: [readonly boolean[], readonly boolean[]][] = [
      [SEMANA_CHEIA, SEMANA_CHEIA],
      [SEMANA_CHEIA, SEMANA_VAZIA],
      [SEMANA_VAZIA, SEMANA_CHEIA],
      [SEMANA_VAZIA, SEMANA_VAZIA],
      [SEMANA_CHEIA, [true, true, true, true, false, false, false]],
    ]
    const proibido = /falh|perdeu|desistiu|abandonou|atras|culpa/i
    for (const [mine, theirs] of cenarios) {
      const reading = readPair(pair(mine, theirs))
      expect(`${reading?.headline} ${reading?.note}`).not.toMatch(proibido)
    }
  })

  it('dupla incompleta não produz leitura', () => {
    const solo: Pair = { ...pair(SEMANA_CHEIA, SEMANA_CHEIA), members: [member(EU, true, 'Lay', SEMANA_CHEIA)] }
    expect(readPair(solo)).toBeNull()
  })
})

describe('daysAway', () => {
  it('o dia de hoje não conta como dia parado', () => {
    expect(daysAway(member(ELA, false, 'Carol', [true, true, true, true, true, true, false]))).toBe(0)
  })

  it('conta só os dias seguidos antes de hoje', () => {
    expect(daysAway(member(ELA, false, 'Carol', [true, true, true, false, false, false, false]))).toBe(3)
  })

  it('semana inteira parada conta os seis dias anteriores', () => {
    expect(daysAway(member(ELA, false, 'Carol', SEMANA_VAZIA))).toBe(6)
  })
})

describe('incentivos', () => {
  const comReacao: Pair = {
    ...pair(SEMANA_CHEIA, SEMANA_CHEIA),
    encouragementsToday: [
      {
        id: 'e1',
        kind: 'bora',
        senderId: EU,
        recipientId: ELA,
        createdAt: new Date(`${TODAY}T10:00:00Z`),
        readAt: null,
      },
      {
        id: 'e2',
        kind: 'to_contigo',
        senderId: ELA,
        recipientId: EU,
        createdAt: new Date(`${TODAY}T11:00:00Z`),
        readAt: null,
      },
    ],
  }

  it('sabe o que eu já mandei hoje', () => {
    expect(alreadySent(comReacao, EU, 'bora', TODAY)).toBe(true)
    expect(alreadySent(comReacao, EU, 'mandou_bem', TODAY)).toBe(false)
  })

  it('o que a outra mandou não conta como meu', () => {
    expect(alreadySent(comReacao, EU, 'to_contigo', TODAY)).toBe(false)
  })

  it('lista o que chegou pra mim e ainda não foi visto', () => {
    const naoLidos = unreadFor(comReacao, EU)
    expect(naoLidos).toHaveLength(1)
    expect(naoLidos[0]?.kind).toBe('to_contigo')
  })
})
