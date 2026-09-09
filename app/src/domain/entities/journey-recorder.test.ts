import { describe, expect, it } from 'vitest'
import { dayKeyOf, type DayKey } from './day'
import { createJourneyEvent, type JourneyEvent } from './journey-event'
import { eventsToRecord, type RecorderInput } from './journey-recorder'
import { reachedMilestones, nextMilestones, type MilestoneTotals } from './milestone'

const today = dayKeyOf(new Date(2026, 8, 7))
const yesterday = dayKeyOf(new Date(2026, 8, 6))

function input(patch: Partial<RecorderInput> = {}): RecorderInput {
  return {
    today,
    momentum: { value: 60, delta: 4 },
    habits: [],
    dayComplete: false,
    dayDone: 0,
    dayTotal: 0,
    dayItems: [],
    focusMinutesToday: 0,
    daysAway: 0,
    objectives: [],
    milestones: [],
    existing: [],
    ...patch,
  }
}

function habit(id: string, done: boolean, dayPart = 'manha') {
  return { id, name: `Hábito ${id}`, axis: 'treino', dayPart, done }
}

function recorded(
  type: JourneyEvent['type'],
  sourceId: string,
  day: DayKey = today,
  momentumAfter?: number,
): JourneyEvent {
  return createJourneyEvent(
    {
      userId: 'user-1',
      type,
      sourceType: 'day',
      sourceId,
      title: 'gravado',
      occurredAt: new Date(`${day}T10:00:00`),
      ...(momentumAfter !== undefined ? { momentumBefore: 0, momentumAfter } : {}),
    },
    `evento-${type}-${sourceId}`,
  )
}

function types(events: readonly { type: string }[]): string[] {
  return events.map((event) => event.type)
}

describe('hábitos e rotina', () => {
  it('grava um momento por hábito concluído, e só pelos concluídos', () => {
    const events = eventsToRecord(input({ habits: [habit('a', true), habit('b', false)] }))
    const done = events.filter((event) => event.type === 'habit_completed')
    expect(done).toHaveLength(1)
    expect(done[0]?.sourceId).toBe('a')
  })

  it('não grava de novo o hábito que já foi gravado hoje', () => {
    const events = eventsToRecord(
      input({ habits: [habit('a', true)], existing: [recorded('habit_completed', 'a')] }),
    )
    expect(types(events)).not.toContain('habit_completed')
  })

  it('grava de novo no dia seguinte: hábito é evento diário', () => {
    const events = eventsToRecord(
      input({
        habits: [habit('a', true)],
        existing: [recorded('habit_completed', 'a', yesterday)],
      }),
    )
    expect(types(events)).toContain('habit_completed')
  })

  it('fecha a rotina quando o bloco inteiro sai', () => {
    const events = eventsToRecord(
      input({ habits: [habit('a', true), habit('b', true)] }),
    )
    expect(types(events)).toContain('routine_completed')
  })

  it('não chama de rotina um bloco com um hábito só', () => {
    const events = eventsToRecord(input({ habits: [habit('a', true)] }))
    expect(types(events)).not.toContain('routine_completed')
  })

  it('não fecha a rotina com um hábito pendente', () => {
    const events = eventsToRecord(
      input({ habits: [habit('a', true), habit('b', false)] }),
    )
    expect(types(events)).not.toContain('routine_completed')
  })
})

describe('dia, retomada e momentum', () => {
  it('grava o dia só quando ele fecha', () => {
    expect(types(eventsToRecord(input({ dayDone: 3, dayTotal: 5 })))).not.toContain('day_completed')
    expect(
      types(eventsToRecord(input({ dayComplete: true, dayDone: 5, dayTotal: 5 }))),
    ).toContain('day_completed')
  })

  it('grava retomada depois de dois dias parados, com movimento hoje', () => {
    expect(types(eventsToRecord(input({ daysAway: 3, dayDone: 1 })))).toContain('comeback')
  })

  it('não chama de retomada um dia sem movimento nenhum', () => {
    expect(types(eventsToRecord(input({ daysAway: 3, dayDone: 0 })))).not.toContain('comeback')
  })

  it('não chama de retomada voltar depois de um dia só', () => {
    expect(types(eventsToRecord(input({ daysAway: 1, dayDone: 2 })))).not.toContain('comeback')
  })

  it('ignora momentum baixo: conta nova não comemora um 12', () => {
    const events = eventsToRecord(input({ momentum: { value: 12, delta: 8 } }))
    expect(types(events)).not.toContain('momentum_record')
  })

  it('grava o primeiro recorde acima do piso', () => {
    expect(types(eventsToRecord(input()))).toContain('momentum_record')
  })

  it('exige margem sobre o recorde anterior', () => {
    const existing = [recorded('momentum_record', yesterday, yesterday, 60)]
    expect(
      types(eventsToRecord(input({ momentum: { value: 61, delta: 1 }, existing }))),
    ).not.toContain('momentum_record')
    expect(
      types(eventsToRecord(input({ momentum: { value: 64, delta: 4 }, existing }))),
    ).toContain('momentum_record')
  })

  it('carrega o antes e o depois do momentum em todo evento', () => {
    const events = eventsToRecord(input({ dayComplete: true, dayDone: 2, dayTotal: 2 }))
    const day = events.find((event) => event.type === 'day_completed')
    expect(day?.momentumBefore).toBe(56)
    expect(day?.momentumAfter).toBe(60)
  })
})

describe('objetivo e marco: acontecem uma vez na vida', () => {
  const objective = { id: 'obj-1', title: 'Lançar meu SaaS', axis: 'estudo', ratio: 0.52 }

  it('grava a faixa mais alta que o objetivo cruzou', () => {
    const events = eventsToRecord(input({ objectives: [objective] }))
    const progress = events.find((event) => event.type === 'goal_progress')
    expect(progress?.sourceId).toBe('obj-1:50')
  })

  it('não grava faixa nenhuma antes dos 25%', () => {
    const events = eventsToRecord(input({ objectives: [{ ...objective, ratio: 0.2 }] }))
    expect(types(events)).not.toContain('goal_progress')
  })

  it('não regrava a mesma faixa em outro dia', () => {
    const events = eventsToRecord(
      input({
        objectives: [objective],
        existing: [recorded('goal_progress', 'obj-1:50', yesterday)],
      }),
    )
    expect(types(events)).not.toContain('goal_progress')
  })

  it('não regrava um marco já conquistado, mesmo em outro dia', () => {
    const milestones = [
      {
        id: 'habitos:10',
        kind: 'habitos' as const,
        count: 10,
        unit: 'hábitos concluídos',
        label: '10 hábitos concluídos',
      },
    ]
    const fresh = eventsToRecord(input({ milestones }))
    expect(types(fresh)).toContain('milestone')

    const again = eventsToRecord(
      input({ milestones, existing: [recorded('milestone', 'habitos:10', yesterday)] }),
    )
    expect(types(again)).not.toContain('milestone')
  })
})

describe('regras de marco', () => {
  const totals: MilestoneTotals = {
    habitsDone: 60,
    activeDays: 31,
    streakRecord: 8,
    objectivesDone: 0,
    focusMinutes: 600,
  }

  it('devolve todas as faixas já atravessadas', () => {
    const ids = reachedMilestones(totals).map((milestone) => milestone.id)
    expect(ids).toContain('habitos:10')
    expect(ids).toContain('habitos:50')
    expect(ids).not.toContain('habitos:100')
    expect(ids).toContain('dias:30')
    expect(ids).toContain('sequencia:7')
    expect(ids).toContain('foco:10')
  })

  it('não inventa marco de objetivo pra quem não concluiu nenhum', () => {
    const ids = reachedMilestones(totals).map((milestone) => milestone.id)
    expect(ids.some((id) => id.startsWith('objetivos:'))).toBe(false)
  })

  it('aponta o próximo de cada trilha, do mais perto pro mais longe', () => {
    const next = nextMilestones(totals)
    expect(next[0]?.ratio).toBeGreaterThanOrEqual(next[1]?.ratio ?? 0)
    const habits = next.find((milestone) => milestone.id.startsWith('habitos:'))
    expect(habits?.count).toBe(100)
    expect(habits?.remaining).toBe(40)
  })

  it('se cala quando a trilha inteira já foi cumprida', () => {
    const maxed = nextMilestones({ ...totals, objectivesDone: 40 })
    expect(maxed.some((milestone) => milestone.id.startsWith('objetivos:'))).toBe(false)
  })
})
