import { describe, expect, it } from 'vitest'
import { msUntilNextDay } from './day'

describe('msUntilNextDay', () => {
  it('conta até a meia-noite local mais um segundo', () => {
    expect(msUntilNextDay(new Date(2026, 8, 29, 23, 59, 0, 0))).toBe(61_000)
  })

  it('logo depois da meia-noite espera o dia inteiro', () => {
    expect(msUntilNextDay(new Date(2026, 8, 30, 0, 0, 1, 0))).toBe(86_400_000)
  })

  it('atravessa a virada do mês', () => {
    expect(msUntilNextDay(new Date(2026, 8, 30, 23, 0, 0, 0))).toBe(3_601_000)
  })
})
