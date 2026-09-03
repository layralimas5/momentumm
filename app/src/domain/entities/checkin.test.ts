import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  averageEnergy,
  capacityOf,
  checkInOfDay,
  createCheckIn,
  type CheckIn,
} from './checkin'
import { parseDayKey } from './day'

const DAY = parseDayKey('2026-09-03')

function checkIn(overrides: Partial<Parameters<typeof createCheckIn>[0]> = {}): CheckIn {
  return createCheckIn(
    { userId: 'u1', day: DAY, mood: 'estavel', energy: 3, focus: 'oscilando', ...overrides },
    'c1',
  )
}

describe('createCheckIn', () => {
  it('guarda a observação sem espaço sobrando', () => {
    expect(checkIn({ note: '  dormi mal  ' }).note).toBe('dormi mal')
  })

  it('trata observação vazia como ausência de observação', () => {
    expect(checkIn({ note: '   ' }).note).toBeNull()
  })

  it('recusa observação longa demais', () => {
    expect(() => checkIn({ note: 'x'.repeat(200) })).toThrow(DomainError)
  })

  it('recusa energia fora da escala', () => {
    expect(() => checkIn({ energy: 9 as never })).toThrow(DomainError)
  })
})

describe('capacityOf', () => {
  it('trata dia sem check-in como moderado', () => {
    // Nem presumir que a pessoa está mal, nem cobrar como se estivesse ótima.
    expect(capacityOf(null).capacity).toBe('moderada')
  })

  it('reconhece dia de baixa energia e prefere a versão mínima', () => {
    const day = capacityOf(checkIn({ mood: 'sem-energia', energy: 1, focus: 'disperso' }))
    expect(day.capacity).toBe('minima')
    expect(day.preferMinimal).toBe(true)
    expect(day.suggestedActions).toBe(1)
  })

  it('reconhece dia cheio', () => {
    const day = capacityOf(checkIn({ mood: 'em-alta', energy: 5, focus: 'afiado' }))
    expect(day.capacity).toBe('plena')
    expect(day.preferMinimal).toBe(false)
  })

  it('vontade não compensa energia: motivada e sem energia continua dia mínimo', () => {
    // O estado não manda sozinho. Quem está animada mas exausta recebe o plano
    // mínimo, não o plano cheio — é o que evita o ciclo de prometer e falhar.
    expect(capacityOf(checkIn({ mood: 'motivado', energy: 1, focus: 'disperso' })).capacity).toBe(
      'minima',
    )
  })

  it('energia alta com estado ruim ainda dá um dia moderado', () => {
    expect(capacityOf(checkIn({ mood: 'sem-energia', energy: 5, focus: 'afiado' })).capacity).toBe(
      'moderada',
    )
  })
})

describe('checkInOfDay', () => {
  it('acha o check-in do dia pedido', () => {
    expect(checkInOfDay([checkIn()], DAY)?.day).toBe(DAY)
    expect(checkInOfDay([checkIn()], parseDayKey('2026-09-04'))).toBeNull()
  })
})

describe('averageEnergy', () => {
  it('devolve null sem check-in', () => {
    expect(averageEnergy([])).toBeNull()
  })

  it('calcula a média com uma casa', () => {
    expect(averageEnergy([checkIn({ energy: 2 }), checkIn({ energy: 3 })])).toBe(2.5)
  })
})
