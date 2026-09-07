import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import type { Activity } from './activity'
import {
  countedDays,
  createChallenge,
  createParticipant,
  describeChallenge,
  doneDaysOf,
  everyoneFinished,
  groupRatio,
  progressOf,
  rankParticipants,
  requiredDays,
  type Challenge,
  type ChallengeParticipant,
} from './challenge'
import { addDays, dayKeyOf, parseDayKey, type DayKey } from './day'
import type { HabitLog } from './habit'

const EU = 'user-eu'
const AMIGA = 'user-amiga'

/*
  Segunda-feira fixa. O modo semanal conta semanas de calendário, e uma data
  variável faria o mesmo teste cobrar duas ou três semanas conforme o dia em
  que ele roda.
*/
const START = parseDayKey('2026-09-07')

function challenge(patch: Partial<Challenge> = {}): Challenge {
  return {
    ...createChallenge(
      {
        ownerId: EU,
        name: 'Treinar 12 dias no mês',
        axis: 'treino',
        mode: 'total',
        target: 12,
        dailyTarget: 20,
        startsOn: START,
        endsOn: addDays(START, 29),
      },
      'c1',
    ),
    ...patch,
  }
}

function participant(patch: Partial<ChallengeParticipant> = {}): ChallengeParticipant {
  return {
    ...createParticipant({ challengeId: 'c1', userId: EU, status: 'ativo' }, 'p1'),
    ...patch,
  }
}

/*
  Literal, e não `createActivity`: a janela do desafio anda pra frente a partir
  de uma segunda-feira fixa, e o construtor recusa data no futuro. O que
  `doneDaysOf` lê é eixo, valor e dia — os três estão aqui.
*/
function activity(day: DayKey, value: number, type = 'treino'): Activity {
  return {
    id: `a-${day}-${value}-${type}`,
    userId: EU,
    type,
    value,
    unit: 'minutos',
    durationMin: value,
    note: null,
    day,
    occurredAt: new Date(`${day}T12:00:00`),
    visibility: 'privada',
    source: 'manual',
  }
}

function log(day: DayKey, habitId = 'h1'): HabitLog {
  return { id: `l-${day}`, userId: EU, habitId, day, status: 'feito', createdAt: new Date() }
}

describe('criação do desafio', () => {
  it('recusa janela curta demais', () => {
    expect(() =>
      createChallenge(
        {
          ownerId: EU,
          name: 'Dois dias',
          axis: 'treino',
          mode: 'diaria',
          startsOn: START,
          endsOn: addDays(START, 1),
        },
        'c1',
      ),
    ).toThrow(DomainError)
  })

  it('recusa meta que não cabe na janela', () => {
    expect(() =>
      createChallenge(
        {
          ownerId: EU,
          name: 'Vinte dias em duas semanas',
          axis: 'treino',
          mode: 'total',
          target: 20,
          startsOn: START,
          endsOn: addDays(START, 13),
        },
        'c1',
      ),
    ).toThrow(DomainError)
  })

  it('no modo diário a meta é a janela inteira, sem ninguém informar', () => {
    const created = challenge({})
    const daily = createChallenge(
      {
        ownerId: EU,
        name: 'Ler todo dia',
        axis: 'leitura',
        mode: 'diaria',
        startsOn: START,
        endsOn: addDays(START, 13),
      },
      'c2',
    )

    expect(daily.target).toBe(14)
    expect(requiredDays(daily)).toBe(14)
    expect(requiredDays(created)).toBe(12)
  })

  it('recusa mais de sete vezes por semana', () => {
    expect(() =>
      createChallenge(
        {
          ownerId: EU,
          name: 'Oito vezes',
          axis: 'treino',
          mode: 'semanal',
          target: 8,
          startsOn: START,
          endsOn: addDays(START, 20),
        },
        'c1',
      ),
    ).toThrow(DomainError)
  })

  it('convidado nasce sem data de entrada; quem entra direto já tem', () => {
    const convidado = createParticipant({ challengeId: 'c1', userId: AMIGA }, 'p2')
    const dono = createParticipant({ challengeId: 'c1', userId: EU, status: 'ativo' }, 'p1')

    expect(convidado.status).toBe('convidado')
    expect(convidado.joinedAt).toBeNull()
    expect(dono.joinedAt).not.toBeNull()
  })
})

describe('de onde vem o dia cumprido', () => {
  it('conta o dia em que o volume do eixo alcança o alvo', () => {
    const alvo = challenge({ dailyTarget: 30 })
    const days = doneDaysOf(alvo, participant(), {
      activities: [
        activity(START, 30),
        activity(addDays(START, 1), 20),
        activity(addDays(START, 2), 15),
        activity(addDays(START, 2), 15),
      ],
      habitLogs: [],
    })

    // O primeiro dia bate sozinho; o terceiro bate somando duas sessões; o
    // segundo fica de fora.
    expect(days).toEqual([START, addDays(START, 2)])
  })

  it('ignora atividade de outro eixo e fora da janela', () => {
    const days = doneDaysOf(challenge(), participant(), {
      activities: [
        activity(START, 40, 'leitura'),
        activity(addDays(START, -1), 40),
        activity(addDays(START, 40), 40),
      ],
      habitLogs: [],
    })

    expect(days).toEqual([])
  })

  it('com hábito vinculado, o hábito manda e a atividade não conta', () => {
    const days = doneDaysOf(challenge(), participant({ habitId: 'h1' }), {
      // Volume de sobra no segundo dia, e ele não entra: quem vinculou hábito
      // combinou cumprir o hábito.
      activities: [activity(addDays(START, 1), 90)],
      habitLogs: [log(START)],
    })

    expect(days).toEqual([START])
  })

  it('a versão mínima do hábito conta como dia cumprido', () => {
    const days = doneDaysOf(challenge(), participant({ habitId: 'h1' }), {
      activities: [],
      habitLogs: [{ ...log(START), status: 'minimo' }, { ...log(addDays(START, 1)), status: 'pulado' }],
    })

    expect(days).toEqual([START])
  })
})

describe('a cota semanal', () => {
  const semanal = challenge({ mode: 'semanal', target: 3 })

  it('cobra por semana de calendário, não pela divisão por sete', () => {
    // Três semanas tocadas: 07/09 a 27/09.
    const tres = challenge({ mode: 'semanal', target: 3, endsOn: addDays(START, 20) })
    expect(requiredDays(tres)).toBe(9)
  })

  it('não deixa uma semana inteira valer pela seguinte', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(START, offset))
    // Sete dias numa semana de cota três valem três, e não sete.
    expect(countedDays(semanal, days)).toBe(3)
  })

  it('soma as cotas de semanas diferentes', () => {
    const days = [0, 1, 7, 8, 9].map((offset) => addDays(START, offset))
    expect(countedDays(semanal, days)).toBe(5)
  })

  it('nos outros modos o teto é a meta, e nunca passa dela', () => {
    const total = challenge({ mode: 'total', target: 2 })
    const days = [0, 1, 2, 3].map((offset) => addDays(START, offset))
    expect(countedDays(total, days)).toBe(2)
  })
})

describe('progresso', () => {
  it('não cobra ritmo antes de o desafio começar', () => {
    const futuro = challenge({ startsOn: addDays(START, 5), endsOn: addDays(START, 34) })
    const progress = progressOf(futuro, participant(), START)

    expect(progress.status).toBe('nao-comecou')
    expect(progress.ratio).toBe(0)
  })

  it('quem está no ritmo do tempo decorrido não aparece atrasado', () => {
    // Metade da janela, metade dos dias.
    const progress = progressOf(challenge(), participant({ doneDays: 6 }), addDays(START, 14))
    expect(progress.status).toBe('no-ritmo')
  })

  it('marca atraso quando o avanço fica muito atrás do tempo', () => {
    const progress = progressOf(challenge(), participant({ doneDays: 1 }), addDays(START, 25))
    expect(progress.status).toBe('atrasado')
  })

  it('conclui ao bater a meta, mesmo com prazo sobrando', () => {
    const progress = progressOf(challenge(), participant({ doneDays: 12 }), addDays(START, 10))

    expect(progress.status).toBe('concluido')
    expect(progress.ratio).toBe(1)
    expect(progress.remaining).toBe(0)
  })

  it('não deixa o avanço passar de 100% nem o texto prometer o impossível', () => {
    const progress = progressOf(challenge(), participant({ doneDays: 40 }), addDays(START, 10))

    expect(progress.ratio).toBe(1)
    expect(progress.done).toBe(12)
  })

  it('quando não dá mais pra fechar, o resumo reconhece o que já saiu', () => {
    const progress = progressOf(challenge(), participant({ doneDays: 2 }), addDays(START, 27))

    expect(progress.status).toBe('atrasado')
    expect(progress.summary).toContain('2 dias')
    expect(progress.summary).not.toContain('Atrasado:')
  })
})

describe('ranking dentro do desafio', () => {
  const alvo = challenge()

  it('ordena por dias cumpridos e mantém a posição no empate', () => {
    const ranked = rankParticipants(
      alvo,
      [
        participant({ id: 'p1', userId: EU, doneDays: 4 }),
        participant({ id: 'p2', userId: AMIGA, doneDays: 9 }),
        participant({ id: 'p3', userId: 'user-3', doneDays: 4 }),
      ],
      addDays(START, 14),
    )

    expect(ranked.map((item) => item.position)).toEqual([1, 2, 2])
    expect(ranked[0]?.progress.participant.userId).toBe(AMIGA)
  })

  it('deixa de fora quem só foi convidado, quem recusou e quem saiu', () => {
    const ranked = rankParticipants(
      alvo,
      [
        participant({ id: 'p1', doneDays: 3 }),
        participant({ id: 'p2', userId: AMIGA, status: 'convidado' }),
        participant({ id: 'p3', userId: 'user-3', status: 'saiu', doneDays: 10 }),
        participant({ id: 'p4', userId: 'user-4', status: 'recusado' }),
      ],
      addDays(START, 14),
    )

    expect(ranked).toHaveLength(1)
  })

  it('o avanço do grupo é a média de quem está dentro', () => {
    const ratio = groupRatio(
      alvo,
      [
        participant({ id: 'p1', doneDays: 12 }),
        participant({ id: 'p2', userId: AMIGA, doneDays: 0 }),
        participant({ id: 'p3', userId: 'user-3', status: 'convidado', doneDays: 12 }),
      ],
      addDays(START, 14),
    )

    expect(ratio).toBe(0.5)
  })

  it('só está fechado quando TODO mundo fechou', () => {
    const quase = [
      participant({ id: 'p1', doneDays: 12 }),
      participant({ id: 'p2', userId: AMIGA, doneDays: 11 }),
    ]
    const todos = [
      participant({ id: 'p1', doneDays: 12 }),
      participant({ id: 'p2', userId: AMIGA, doneDays: 12 }),
    ]

    expect(everyoneFinished(alvo, quase, addDays(START, 20))).toBe(false)
    expect(everyoneFinished(alvo, todos, addDays(START, 20))).toBe(true)
  })

  it('desafio sem ninguém dentro não está concluído', () => {
    expect(everyoneFinished(alvo, [], addDays(START, 20))).toBe(false)
  })
})

describe('a regra em uma linha', () => {
  it('descreve pelo hábito quando existe um vinculado', () => {
    expect(describeChallenge(challenge({ mode: 'diaria', target: 14 }), 'Treino da manhã')).toBe(
      'Treino da manhã por dia, durante 30 dias',
    )
  })

  it('descreve pela unidade do eixo quando não há hábito', () => {
    expect(describeChallenge(challenge({ mode: 'semanal', target: 4 }))).toBe(
      '20 minutos, 4x por semana',
    )
  })
})

describe('o dia é sempre local', () => {
  it('usa o calendário de quem registrou, não o UTC', () => {
    const tarde = new Date(2026, 8, 7, 22, 30)
    expect(dayKeyOf(tarde)).toBe('2026-09-07')
  })
})
