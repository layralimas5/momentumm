import { describe, expect, it } from 'vitest'
import { createActivity, type Activity } from './activity'
import { parseDayKey, type DayKey } from './day'
import { calculateStreak, daysToRecord } from './streak'

const TODAY = parseDayKey('2026-08-13')

function activityOn(day: string, type: 'leitura' | 'treino' = 'leitura'): Activity {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return createActivity(
    {
      userId: 'u1',
      type,
      value: 10,
      occurredAt: new Date(year, month - 1, date, 9, 0, 0),
    },
    `id-${day}-${type}`,
  )
}

describe('calculateStreak', () => {
  it('retorna vazio sem atividade', () => {
    const streak = calculateStreak([], TODAY)
    expect(streak.current).toBe(0)
    expect(streak.record).toBe(0)
    expect(streak.lastDay).toBeNull()
  })

  it('conta dias consecutivos terminando hoje', () => {
    const streak = calculateStreak(
      [activityOn('2026-08-11'), activityOn('2026-08-12'), activityOn('2026-08-13')],
      TODAY,
    )
    expect(streak.current).toBe(3)
    expect(streak.atRisk).toBe(false)
  })

  it('mantém a sequência viva quando o último registro foi ontem', () => {
    const streak = calculateStreak([activityOn('2026-08-11'), activityOn('2026-08-12')], TODAY)
    expect(streak.current).toBe(2)
    expect(streak.atRisk).toBe(true)
  })

  it('zera a sequência quando passou mais de um dia sem registro', () => {
    const streak = calculateStreak([activityOn('2026-08-09'), activityOn('2026-08-10')], TODAY)
    expect(streak.current).toBe(0)
    expect(streak.record).toBe(2)
  })

  it('ignora duplicatas no mesmo dia', () => {
    const streak = calculateStreak(
      [activityOn('2026-08-13'), activityOn('2026-08-13', 'treino')],
      TODAY,
    )
    expect(streak.current).toBe(1)
  })

  it('guarda o recorde mesmo depois de quebrar', () => {
    const streak = calculateStreak(
      [
        activityOn('2026-08-01'),
        activityOn('2026-08-02'),
        activityOn('2026-08-03'),
        activityOn('2026-08-04'),
        activityOn('2026-08-13'),
      ],
      TODAY,
    )
    expect(streak.current).toBe(1)
    expect(streak.record).toBe(4)
  })

  it('filtra por eixo quando o tipo é informado', () => {
    const streak = calculateStreak(
      [
        activityOn('2026-08-12', 'treino'),
        activityOn('2026-08-13', 'treino'),
        activityOn('2026-08-13', 'leitura'),
      ],
      TODAY,
      'treino',
    )
    expect(streak.current).toBe(2)
  })

  it('sabe quantos dias faltam pra bater o recorde', () => {
    const streak = calculateStreak(
      [activityOn('2026-08-12'), activityOn('2026-08-13')],
      TODAY,
    )
    expect(daysToRecord({ ...streak, record: 5 })).toBe(4)
  })
})

describe('dia local', () => {
  it('usa o calendário local e não UTC ao registrar tarde da noite', () => {
    // 23h no fuso do Brasil já é o dia seguinte em UTC. O streak não pode pular.
    const lateNight = new Date(2026, 7, 12, 23, 30, 0)
    const activity = createActivity(
      { userId: 'u1', type: 'leitura', value: 12, occurredAt: lateNight },
      'late',
    )
    expect(activity.day).toBe('2026-08-12' as DayKey)
    expect(lateNight.toISOString().slice(0, 10)).toBe('2026-08-13')
  })
})
