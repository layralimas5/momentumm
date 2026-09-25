import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { createActivity, describeActivity, formatActivityWindow, totalMinutes } from './activity'

describe('createActivity', () => {
  it('deriva a unidade do eixo', () => {
    const activity = createActivity({ userId: 'u1', type: 'leitura', value: 30 }, 'a1')
    expect(activity.unit).toBe('paginas')
    expect(activity.value).toBe(30)
  })

  it('estima duração quando o eixo é medido em páginas', () => {
    const activity = createActivity({ userId: 'u1', type: 'leitura', value: 30 }, 'a1')
    expect(activity.durationMin).toBe(45)
  })

  it('usa o próprio valor como duração quando o eixo é em minutos', () => {
    const activity = createActivity({ userId: 'u1', type: 'treino', value: 45 }, 'a1')
    expect(activity.durationMin).toBe(45)
  })

  it('respeita a duração informada explicitamente', () => {
    const activity = createActivity(
      { userId: 'u1', type: 'leitura', value: 30, durationMin: 20 },
      'a1',
    )
    expect(activity.durationMin).toBe(20)
  })

  it('guarda o início da sessão quando ele vem do cronômetro', () => {
    const startedAt = new Date('2026-09-25T14:02:00')
    const occurredAt = new Date('2026-09-25T14:27:00')
    const activity = createActivity(
      { userId: 'u1', type: 'estudo', value: 25, startedAt, occurredAt, source: 'timer' },
      'a1',
    )
    expect(activity.startedAt).toEqual(startedAt)
  })

  it('deixa o início nulo no registro manual', () => {
    const activity = createActivity({ userId: 'u1', type: 'estudo', value: 25 }, 'a1')
    expect(activity.startedAt).toBeNull()
  })

  it('recusa sessão que começa depois de terminar', () => {
    expect(() =>
      createActivity(
        {
          userId: 'u1',
          type: 'estudo',
          value: 25,
          startedAt: new Date('2026-09-25T15:00:00'),
          occurredAt: new Date('2026-09-25T14:27:00'),
        },
        'a1',
      ),
    ).toThrow(DomainError)
  })

  it('recusa valor zero ou negativo', () => {
    expect(() => createActivity({ userId: 'u1', type: 'estudo', value: 0 }, 'a1')).toThrow(
      DomainError,
    )
    expect(() => createActivity({ userId: 'u1', type: 'estudo', value: -5 }, 'a1')).toThrow(
      DomainError,
    )
  })

  it('recusa registro no futuro', () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
    expect(() =>
      createActivity({ userId: 'u1', type: 'estudo', value: 10, occurredAt: tomorrow }, 'a1'),
    ).toThrow(DomainError)
  })

  it('limita a duração a 24 horas', () => {
    const activity = createActivity({ userId: 'u1', type: 'estudo', value: 5000 }, 'a1')
    expect(activity.durationMin).toBe(1440)
  })

  it('normaliza nota vazia para null', () => {
    const activity = createActivity({ userId: 'u1', type: 'estudo', value: 10, note: '   ' }, 'a1')
    expect(activity.note).toBeNull()
  })

  it('nasce pública por padrão', () => {
    const activity = createActivity({ userId: 'u1', type: 'estudo', value: 10 }, 'a1')
    expect(activity.visibility).toBe('publica')
  })
})

describe('resumo', () => {
  it('descreve a atividade com o verbo do eixo', () => {
    const activity = createActivity({ userId: 'u1', type: 'leitura', value: 1 }, 'a1')
    expect(describeActivity(activity)).toBe('leu 1 página')
  })

  it('soma minutos de eixos diferentes', () => {
    const total = totalMinutes([
      createActivity({ userId: 'u1', type: 'treino', value: 30 }, 'a1'),
      createActivity({ userId: 'u1', type: 'meditacao', value: 10 }, 'a2'),
    ])
    expect(total).toBe(40)
  })
})

describe('formatActivityWindow', () => {
  const base = { userId: 'u1', type: 'estudo', value: 25 } as const

  it('mostra início e fim quando a sessão foi cronometrada', () => {
    const activity = createActivity(
      {
        ...base,
        startedAt: new Date('2026-09-25T14:02:00'),
        occurredAt: new Date('2026-09-25T14:27:00'),
        source: 'timer',
      },
      'a1',
    )
    expect(formatActivityWindow(activity)).toBe('14:02 → 14:27')
  })

  it('mostra só a hora do registro quando não há início', () => {
    const activity = createActivity(
      { ...base, occurredAt: new Date('2026-09-25T14:27:00') },
      'a1',
    )
    expect(formatActivityWindow(activity)).toBe('14:27')
  })
})
