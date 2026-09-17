import { describe, expect, it } from 'vitest'
import { parseDayKey } from '@/domain/entities/day'
import { calculateMomentum } from '@/domain/entities/momentum'
import { momentumEvent } from './journey-event-builders'

const TODAY = parseDayKey('2026-09-17')

describe('momentumEvent', () => {
  it('sem uma semana de história o card não mostra "antes → agora"', () => {
    const momentum = calculateMomentum({
      activities: [],
      habits: [],
      habitLogs: [],
      tasks: [],
      today: TODAY,
    })
    expect(momentum.hasEnoughData).toBe(false)

    const event = momentumEvent({ userId: 'u1', today: TODAY, momentum, streakDays: 3 })
    expect(event.momentumBefore).toBeNull()
    expect(event.momentumAfter).toBe(momentum.value)
  })
})
