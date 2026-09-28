import { describe, expect, it } from 'vitest'
import {
  buildCalendar,
  filledCount,
  monthSummary,
  type CalendarEntry,
} from './calendar-day'
import type { DayKey } from './day'

/*
  O calendário visual é a parte do pedido que mais depende de uma decisão pura:
  "qual estado este dia tem". Ela mora no domínio justamente pra ser provada
  sem montar componente nem servidor.
*/

const MONTH = '2026-09-01' as DayKey
const TODAY = '2026-09-20' as DayKey

function entry(day: string, over: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    day: day as DayKey,
    postId: 'post-1',
    coverPath: 'uid/posts/a.jpg',
    total: 1,
    fromAlbum: false,
    ...over,
  }
}

function grid(days: readonly string[]): DayKey[] {
  return days as DayKey[]
}

describe('buildCalendar', () => {
  it('publicação com foto vira célula de foto, com a publicação que ela abre', () => {
    const cells = buildCalendar(
      grid(['2026-09-10']),
      MONTH,
      TODAY,
      new Map([['2026-09-10' as DayKey, entry('2026-09-10')]]),
      new Set(),
    )

    expect(cells[0]?.kind).toBe('publicacao')
    expect(cells[0]?.coverPath).toBe('uid/posts/a.jpg')
    expect(cells[0]?.postId).toBe('post-1')
  })

  it('a publicação ganha do álbum: ela tem legenda, objetivo e conversa', () => {
    const cells = buildCalendar(
      grid(['2026-09-10']),
      MONTH,
      TODAY,
      new Map([['2026-09-10' as DayKey, entry('2026-09-10', { fromAlbum: false })]]),
      new Set(),
    )

    expect(cells[0]?.kind).toBe('publicacao')
  })

  it('dia sem publicação e com foto guardada vira célula de álbum', () => {
    const cells = buildCalendar(
      grid(['2026-09-11']),
      MONTH,
      TODAY,
      new Map([
        [
          '2026-09-11' as DayKey,
          entry('2026-09-11', { fromAlbum: true, postId: null, total: 0, coverPath: 'uid/fotos/x.jpg' }),
        ],
      ]),
      new Set(),
    )

    expect(cells[0]?.kind).toBe('album')
    expect(cells[0]?.postId).toBeNull()
  })

  it('publicação SEM foto conta como movimento, não como vazio', () => {
    const cells = buildCalendar(
      grid(['2026-09-12']),
      MONTH,
      TODAY,
      new Map([['2026-09-12' as DayKey, entry('2026-09-12', { coverPath: null })]]),
      new Set(),
    )

    expect(cells[0]?.kind).toBe('movimento')
    // O dia continua abrindo a publicação, mesmo sem imagem.
    expect(cells[0]?.postId).toBe('post-1')
  })

  it('dia sem imagem mas com registro no Momentumm vira movimento', () => {
    const cells = buildCalendar(
      grid(['2026-09-13']),
      MONTH,
      TODAY,
      new Map(),
      new Set(['2026-09-13' as DayKey]),
    )

    expect(cells[0]?.kind).toBe('movimento')
    expect(cells[0]?.coverPath).toBeNull()
  })

  it('dia sem nada é neutro, e nada mais', () => {
    const cells = buildCalendar(grid(['2026-09-14']), MONTH, TODAY, new Map(), new Set())

    expect(cells[0]?.kind).toBe('vazio')
    expect(cells[0]?.coverPath).toBeNull()
    expect(cells[0]?.postCount).toBe(0)
  })

  it('várias publicações no mesmo dia mostram a contagem', () => {
    const cells = buildCalendar(
      grid(['2026-09-15']),
      MONTH,
      TODAY,
      new Map([['2026-09-15' as DayKey, entry('2026-09-15', { total: 3 })]]),
      new Set(),
    )

    expect(cells[0]?.postCount).toBe(3)
  })

  it('marca hoje, o que é de outro mês e o que ainda não chegou', () => {
    const cells = buildCalendar(
      grid(['2026-08-31', '2026-09-20', '2026-09-21']),
      MONTH,
      TODAY,
      new Map(),
      new Set(),
    )

    expect(cells[0]?.inMonth).toBe(false)
    expect(cells[1]?.isToday).toBe(true)
    expect(cells[2]?.ahead).toBe(true)
    expect(cells[1]?.ahead).toBe(false)
  })
})

describe('monthSummary', () => {
  it('conta o que houve, nunca o que faltou', () => {
    const cells = buildCalendar(
      grid(['2026-09-01', '2026-09-02', '2026-09-03']),
      MONTH,
      TODAY,
      new Map([['2026-09-01' as DayKey, entry('2026-09-01')]]),
      new Set(['2026-09-02' as DayKey]),
    )

    const summary = monthSummary(cells)
    expect(summary).toContain('1 dia com foto')
    expect(summary).toContain('1 em movimento')
    // A frase nunca fala de ausência.
    expect(summary).not.toMatch(/falt|perd|sem registro em/i)
  })

  it('mês vazio diz que está vazio, sem cobrar', () => {
    const cells = buildCalendar(grid(['2026-09-01']), MONTH, TODAY, new Map(), new Set())
    expect(monthSummary(cells)).toBe('Nenhum registro neste mês ainda.')
  })

  it('só movimento, sem foto nenhuma, tem frase própria', () => {
    const cells = buildCalendar(
      grid(['2026-09-01', '2026-09-02']),
      MONTH,
      TODAY,
      new Map(),
      new Set(['2026-09-01' as DayKey, '2026-09-02' as DayKey]),
    )
    expect(monthSummary(cells)).toBe('2 dias em movimento')
  })
})

describe('filledCount', () => {
  it('conta só as células do mês mostrado', () => {
    const cells = buildCalendar(
      grid(['2026-08-31', '2026-09-01']),
      MONTH,
      TODAY,
      new Map([
        ['2026-08-31' as DayKey, entry('2026-08-31')],
        ['2026-09-01' as DayKey, entry('2026-09-01')],
      ]),
      new Set(),
    )

    expect(filledCount(cells)).toBe(1)
  })
})
