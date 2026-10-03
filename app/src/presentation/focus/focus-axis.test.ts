import { describe, expect, it } from 'vitest'
import { parseDayKey } from '@/domain/entities/day'
import { createTask } from '@/domain/entities/task'
import { focusAxisOf, plannedMinutesOf } from './use-objective-focus'

const task = createTask({ userId: 'u1', title: 'Ler o capítulo 4', day: parseDayKey('2026-10-03') }, 't1')

describe('focusAxisOf', () => {
  it('keeps the task axis when it has one', () => {
    expect(focusAxisOf({ ...task, axis: 'treino' }, 'leitura')).toBe('treino')
  })

  it('falls back to the objective axis so the session counts for it', () => {
    expect(focusAxisOf({ ...task, axis: null }, 'leitura')).toBe('leitura')
  })

  it('uses a free session on the objective axis when there is no task', () => {
    expect(focusAxisOf(null, 'meditacao')).toBe('meditacao')
  })
})

describe('plannedMinutesOf', () => {
  it('keeps the session between 15 and 60 minutes', () => {
    expect(plannedMinutesOf({ ...task, estimatedMin: 5 })).toBe(15)
    expect(plannedMinutesOf({ ...task, estimatedMin: 120 })).toBe(60)
  })
})
