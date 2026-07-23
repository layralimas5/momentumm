import { describe, expect, it } from 'vitest'
import { dailyMission, MissionRules } from './mission'

describe('dailyMission', () => {
  it('é determinística — o mesmo dia devolve a mesma missão', () => {
    const day = new Date(2026, 6, 22)
    expect(dailyMission(day)).toBe(dailyMission(day))
  })

  it('sempre devolve um texto não-vazio', () => {
    for (let d = 1; d <= 31; d += 1) {
      expect(dailyMission(new Date(2026, 0, d))).toBeTruthy()
    }
  })

  it('varia ao longo dos dias', () => {
    const missions = new Set(
      Array.from({ length: 10 }, (_, i) => dailyMission(new Date(2026, 0, i + 1))),
    )
    expect(missions.size).toBeGreaterThan(1)
  })
})

describe('MissionRules.isDoneOn', () => {
  it('reconhece um dia concluído', () => {
    expect(MissionRules.isDoneOn(['2026-07-22'], '2026-07-22')).toBe(true)
  })

  it('nega um dia não concluído', () => {
    expect(MissionRules.isDoneOn(['2026-07-21'], '2026-07-22')).toBe(false)
  })
})

describe('MissionRules.streak', () => {
  it('conta a sequência de missões terminando hoje', () => {
    const dates = ['2026-07-20', '2026-07-21', '2026-07-22']
    expect(MissionRules.streak(dates, '2026-07-22')).toBe(3)
  })

  it('é tolerante com hoje ainda não concluído', () => {
    expect(MissionRules.streak(['2026-07-20', '2026-07-21'], '2026-07-22')).toBe(2)
  })
})
