import { describe, expect, it } from 'vitest'
import {
  computeJourney,
  LEVEL_NAMES,
  XP,
  xpThresholdForLevel,
  type JourneySnapshot,
} from './journey'

/** Snapshot vazio; cada teste sobrescreve só o que importa. */
function snapshot(over: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    habits: [],
    missionDates: [],
    diaryDates: [],
    goals: [],
    books: [],
    today: '2026-07-22',
    ...over,
  }
}

describe('xpThresholdForLevel', () => {
  it('segue a curva 50·(n−1)·n', () => {
    expect(xpThresholdForLevel(1)).toBe(0)
    expect(xpThresholdForLevel(2)).toBe(100)
    expect(xpThresholdForLevel(3)).toBe(300)
    expect(xpThresholdForLevel(4)).toBe(600)
    expect(xpThresholdForLevel(5)).toBe(1000)
  })

  it('é monotônica crescente', () => {
    for (let n = 1; n < 12; n += 1) {
      expect(xpThresholdForLevel(n + 1)).toBeGreaterThan(xpThresholdForLevel(n))
    }
  })
})

describe('computeJourney — jornada zerada', () => {
  const j = computeJourney(snapshot())

  it('começa sem XP, no nível 1 Semente', () => {
    expect(j.totalXp).toBe(0)
    expect(j.level).toBe(1)
    expect(j.levelName).toBe('Semente')
  })

  it('mostra o caminho pro nível 2', () => {
    expect(j.xpIntoLevel).toBe(0)
    expect(j.xpForNextLevel).toBe(100)
    expect(j.progressPercent).toBe(0)
    expect(j.isMaxLevel).toBe(false)
  })

  it('não tem sequência', () => {
    expect(j.streak).toBe(0)
  })
})

describe('computeJourney — breakdown de XP', () => {
  const j = computeJourney(
    snapshot({
      habits: [{ completedDates: ['2026-07-22', '2026-07-21', '2026-07-20'] }, { completedDates: ['2026-07-22', '2026-07-21'] }],
      missionDates: ['2026-07-22', '2026-07-21', '2026-07-20', '2026-07-19'],
      diaryDates: ['2026-07-22', '2026-07-21', '2026-07-20', '2026-07-19', '2026-07-18'],
      goals: [{ progress: 100, status: 'completed' }],
      books: [{ status: 'read' }, { status: 'read' }],
    }),
  )

  it('pontua cada fonte pela sua tabela', () => {
    expect(j.breakdown.habits).toBe(5 * XP.habitCompletion) // 50
    expect(j.breakdown.missions).toBe(4 * XP.missionCompletion) // 60
    expect(j.breakdown.diary).toBe(5 * XP.diaryEntry) // 40
    expect(j.breakdown.goals).toBe(1 * XP.goalCompleted) // 100
    expect(j.breakdown.books).toBe(2 * XP.bookRead) // 120
  })

  it('soma tudo no total', () => {
    expect(j.totalXp).toBe(370)
  })

  it('coloca no nível certo com o progresso proporcional', () => {
    // 370 XP: passou de 300 (nível 3), falta chegar a 600 (nível 4).
    expect(j.level).toBe(3)
    expect(j.levelName).toBe('Em movimento')
    expect(j.xpIntoLevel).toBe(70)
    expect(j.xpForNextLevel).toBe(300)
    expect(j.progressPercent).toBe(23) // round(70/300*100)
  })
})

describe('computeJourney — sequência global', () => {
  it('une hábitos, missões e diário num só streak', () => {
    const j = computeJourney(
      snapshot({
        habits: [{ completedDates: ['2026-07-22'] }],
        missionDates: ['2026-07-21'],
        diaryDates: ['2026-07-20'],
      }),
    )
    expect(j.streak).toBe(3)
  })

  it('não conta metas nem livros como dia ativo', () => {
    const j = computeJourney(
      snapshot({
        goals: [{ progress: 100, status: 'completed' }],
        books: [{ status: 'read' }],
      }),
    )
    expect(j.streak).toBe(0)
  })

  it('não dupla-conta o mesmo dia vindo de fontes diferentes', () => {
    const j = computeJourney(
      snapshot({
        habits: [{ completedDates: ['2026-07-22'] }],
        missionDates: ['2026-07-22'],
        diaryDates: ['2026-07-22'],
      }),
    )
    expect(j.streak).toBe(1)
  })
})

describe('computeJourney — regras de conclusão de meta', () => {
  it('conta meta com 100% mesmo se o status ainda for active', () => {
    const j = computeJourney(snapshot({ goals: [{ progress: 100, status: 'active' }] }))
    expect(j.breakdown.goals).toBe(XP.goalCompleted)
  })

  it('não conta meta arquivada com progresso parcial', () => {
    const j = computeJourney(snapshot({ goals: [{ progress: 40, status: 'archived' }] }))
    expect(j.breakdown.goals).toBe(0)
  })
})

describe('computeJourney — nível máximo', () => {
  const huge = computeJourney(snapshot({ goals: Array.from({ length: 100 }, () => ({ progress: 100, status: 'completed' as const })) }))

  it('trava no último nível nomeado', () => {
    expect(huge.level).toBe(LEVEL_NAMES.length)
    expect(huge.levelName).toBe(LEVEL_NAMES[LEVEL_NAMES.length - 1])
    expect(huge.isMaxLevel).toBe(true)
  })

  it('não oferece "próximo nível" no topo', () => {
    expect(huge.xpForNextLevel).toBe(0)
    expect(huge.progressPercent).toBe(100)
  })
})
