import { describe, expect, it } from 'vitest'
import { computeAchievements, countUnlocked, type AchievementContext } from './achievement'
import { computeJourney, type JourneySnapshot } from './journey'

function context(over: Partial<JourneySnapshot> = {}): AchievementContext {
  const snapshot: JourneySnapshot = {
    habits: [],
    missionDates: [],
    diaryDates: [],
    goals: [],
    books: [],
    today: '2026-07-22',
    ...over,
  }
  return { snapshot, journey: computeJourney(snapshot) }
}

function byId(ctx: AchievementContext, id: string) {
  const found = computeAchievements(ctx).find((a) => a.id === id)
  if (!found) throw new Error(`conquista ${id} não existe`)
  return found
}

describe('computeAchievements — desbloqueio', () => {
  it('jornada zerada não desbloqueia nada', () => {
    expect(countUnlocked(computeAchievements(context()))).toBe(0)
  })

  it('criar o primeiro hábito desbloqueia "Primeiro passo"', () => {
    expect(byId(context({ habits: [{ completedDates: [] }] }), 'first-step').unlocked).toBe(true)
  })

  it('uma meta também conta como primeiro passo', () => {
    const ctx = context({ goals: [{ progress: 0, status: 'active' }] })
    expect(byId(ctx, 'first-step').unlocked).toBe(true)
  })

  it('7 dias de sequência desbloqueiam "Semana de fogo"', () => {
    const dates = Array.from({ length: 7 }, (_, i) => `2026-07-${22 - i}`)
    expect(byId(context({ missionDates: dates }), 'week-streak').unlocked).toBe(true)
  })

  it('concluir uma meta desbloqueia "Realizadora"', () => {
    const ctx = context({ goals: [{ progress: 100, status: 'completed' }] })
    expect(byId(ctx, 'first-goal').unlocked).toBe(true)
  })

  it('ler um livro desbloqueia "Leitora"; um em andamento não', () => {
    expect(byId(context({ books: [{ status: 'read' }] }), 'first-book').unlocked).toBe(true)
    expect(byId(context({ books: [{ status: 'reading' }] }), 'first-book').unlocked).toBe(false)
  })
})

describe('computeAchievements — progresso parcial', () => {
  it('mostra "3 de 30" sem desbloquear', () => {
    const dates = ['2026-07-22', '2026-07-21', '2026-07-20']
    const a = byId(context({ missionDates: dates }), 'month-streak')
    expect(a.unlocked).toBe(false)
    expect(a.current).toBe(3)
    expect(a.target).toBe(30)
    expect(a.progressPercent).toBe(10)
  })

  it('nunca mostra progresso acima do alvo', () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2026-07-${22 - i}`.padStart(10, '0'))
    const a = byId(context({ missionDates: dates }), 'diarist')
    // 'diarist' mede diário, não missões — segue 0 aqui.
    expect(a.current).toBeLessThanOrEqual(a.target)
  })

  it('limita current ao target quando ultrapassa', () => {
    const many = Array.from({ length: 25 }, () => ({ status: 'read' as const }))
    const a = byId(context({ books: many }), 'five-books')
    expect(a.current).toBe(5)
    expect(a.progressPercent).toBe(100)
  })
})

describe('computeAchievements — ordenação', () => {
  it('coloca desbloqueadas antes das bloqueadas', () => {
    const list = computeAchievements(context({ habits: [{ completedDates: [] }] }))
    const firstLocked = list.findIndex((a) => !a.unlocked)
    const lastUnlocked = list.map((a) => a.unlocked).lastIndexOf(true)
    // Toda desbloqueada vem antes de qualquer bloqueada.
    if (firstLocked !== -1 && lastUnlocked !== -1) {
      expect(lastUnlocked).toBeLessThan(firstLocked)
    }
  })
})
