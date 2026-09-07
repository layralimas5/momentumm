import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { dayKeyOf } from './day'
import {
  createJourneyEvent,
  journeyEventKey,
  sortEventsByRecent,
  type NewJourneyEventInput,
} from './journey-event'

const base: NewJourneyEventInput = {
  userId: 'user-1',
  type: 'day_completed',
  sourceType: 'day',
  title: 'Hoje',
}

describe('createJourneyEvent', () => {
  it('nasce privado mesmo sem ninguém pedir', () => {
    expect(createJourneyEvent(base, 'e1').visibility).toBe('privada')
  })

  it('respeita a visibilidade quando ela é escolhida de propósito', () => {
    expect(createJourneyEvent({ ...base, visibility: 'amigos' }, 'e1').visibility).toBe('amigos')
  })

  it('deriva a variação de momentum dos dois lados', () => {
    const event = createJourneyEvent({ ...base, momentumBefore: 76, momentumAfter: 81 }, 'e1')
    expect(event.momentumChange).toBe(5)
  })

  it('não inventa variação quando só um lado existe', () => {
    const event = createJourneyEvent({ ...base, momentumAfter: 81 }, 'e1')
    expect(event.momentumChange).toBeNull()
  })

  it('prende percentual entre 0 e 1', () => {
    const event = createJourneyEvent({ ...base, completionPercentage: 1.4 }, 'e1')
    expect(event.completionPercentage).toBe(1)
  })

  it('prende o momentum entre 0 e 100', () => {
    expect(createJourneyEvent({ ...base, momentumAfter: 140 }, 'e1').momentumAfter).toBe(100)
    expect(createJourneyEvent({ ...base, momentumAfter: -8 }, 'e1').momentumAfter).toBe(0)
  })

  it('recusa título vazio', () => {
    expect(() => createJourneyEvent({ ...base, title: '   ' }, 'e1')).toThrow(DomainError)
  })

  it('descarta item sem rótulo e limita a lista', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      label: index === 0 ? '  ' : `Item ${index}`,
      done: true,
    }))
    const event = createJourneyEvent({ ...base, metadata: { items } }, 'e1')
    expect(event.metadata.items).toHaveLength(12)
    expect(event.metadata.items?.[0]?.label).toBe('Item 1')
  })

  it('usa o dia local de quando o momento aconteceu', () => {
    const occurredAt = new Date(2026, 8, 7, 22, 40)
    const event = createJourneyEvent({ ...base, occurredAt }, 'e1')
    expect(event.day).toBe(dayKeyOf(occurredAt))
  })
})

describe('journeyEventKey', () => {
  it('é igual pra mesma transição no mesmo dia', () => {
    const first = createJourneyEvent({ ...base, sourceId: '2026-09-07' }, 'e1')
    const second = createJourneyEvent({ ...base, sourceId: '2026-09-07' }, 'e2')
    expect(journeyEventKey(first)).toBe(journeyEventKey(second))
  })

  it('separa origens diferentes', () => {
    const day = createJourneyEvent({ ...base, sourceId: '2026-09-07' }, 'e1')
    const other = createJourneyEvent({ ...base, sourceId: '2026-09-08' }, 'e2')
    expect(journeyEventKey(day)).not.toBe(journeyEventKey(other))
  })
})

describe('sortEventsByRecent', () => {
  it('coloca o momento mais recente na frente', () => {
    const older = createJourneyEvent({ ...base, occurredAt: new Date(2026, 8, 1) }, 'e1')
    const newer = createJourneyEvent({ ...base, occurredAt: new Date(2026, 8, 5) }, 'e2')
    expect(sortEventsByRecent([older, newer]).map((event) => event.id)).toEqual(['e2', 'e1'])
  })
})
