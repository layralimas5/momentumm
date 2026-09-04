import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { createActivity, type Activity } from './activity'
import { addDays, parseDayKey } from './day'
import {
  createObjective,
  deadlineFrom,
  deadlineLabelOf,
  describeObjective,
  progressOfObjective,
} from './objective'

const START = parseDayKey('2026-06-01')
const TODAY = parseDayKey('2026-07-01')
const DEADLINE = parseDayKey('2026-08-29')

function objective(target: number, start = START, deadline = DEADLINE) {
  return createObjective(
    { userId: 'u1', title: 'Ler 6 livros', axis: 'leitura', target, startedOn: start, deadline },
    'o1',
  )
}

function reading(day: string, value: number): Activity {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return createActivity(
    { userId: 'u1', type: 'leitura', value, occurredAt: new Date(year, month - 1, date, 9) },
    `id-${day}-${value}`,
  )
}

describe('createObjective', () => {
  it('recusa prazo curto demais pra virar plano', () => {
    expect(() => objective(100, START, addDays(START, 3))).toThrow(DomainError)
  })

  it('recusa prazo maior que um ano', () => {
    expect(() => objective(100, START, addDays(START, 400))).toThrow(DomainError)
  })

  it('recusa alvo zerado', () => {
    expect(() => objective(0)).toThrow(DomainError)
  })

  it('descreve o objetivo com alvo e data', () => {
    expect(describeObjective(objective(1800))).toContain('1800 páginas até')
  })
})

describe('progressOfObjective', () => {
  it('soma só as atividades do eixo dentro da janela', () => {
    const activities = [
      reading('2026-06-10', 100),
      // Antes do começo e depois do prazo: nenhuma das duas conta.
      reading('2026-05-20', 500),
      reading('2026-08-31', 500),
    ]

    expect(progressOfObjective(objective(1000), activities, TODAY).done).toBe(100)
  })

  it('ignora atividade de outro eixo', () => {
    const treino = createActivity(
      { userId: 'u1', type: 'treino', value: 60, occurredAt: new Date(2026, 5, 10, 9) },
      'a-treino',
    )

    expect(progressOfObjective(objective(1000), [treino], TODAY).done).toBe(0)
  })

  it('quem está na frente do prazo consumido está no prazo', () => {
    // Um terço do prazo passou; metade do alvo feito.
    const progress = progressOfObjective(objective(1000), [reading('2026-06-10', 500)], TODAY)
    expect(progress.status).toBe('no-prazo')
  })

  it('quem está muito atrás do prazo consumido está atrasado', () => {
    const progress = progressOfObjective(objective(1000), [reading('2026-06-10', 10)], TODAY)
    expect(progress.status).toBe('atrasado')
  })

  it('alvo batido fecha o objetivo mesmo com prazo sobrando', () => {
    const progress = progressOfObjective(objective(100), [reading('2026-06-10', 120)], TODAY)
    expect(progress.status).toBe('concluido')
    expect(progress.ratio).toBe(1)
    expect(progress.remaining).toBe(0)
  })

  it('prazo passado sem alvo batido vence', () => {
    const past = objective(1000, START, parseDayKey('2026-06-20'))
    const progress = progressOfObjective(past, [reading('2026-06-10', 100)], TODAY)
    expect(progress.status).toBe('vencido')
  })

  it('o ritmo diário divide o que falta pelos dias restantes incluindo hoje', () => {
    const short = objective(100, START, addDays(TODAY, 9))
    const progress = progressOfObjective(short, [], TODAY)
    // 100 restantes em 9 dias de sobra mais hoje.
    expect(progress.dailyPace).toBe(10)
  })
})

describe('deadlineLabelOf', () => {
  it('diz quantos dias faltam', () => {
    const progress = progressOfObjective(objective(1000, START, addDays(TODAY, 2)), [], TODAY)
    expect(deadlineLabelOf(progress)).toBe('Faltam 2 dias')
  })

  it('último dia fecha hoje', () => {
    const progress = progressOfObjective(objective(1000, START, TODAY), [], TODAY)
    expect(deadlineLabelOf(progress)).toBe('Fecha hoje')
  })
})

describe('deadlineFrom', () => {
  it('conta o dia de hoje dentro do prazo', () => {
    expect(deadlineFrom(START, 30)).toBe('2026-06-30')
  })
})
