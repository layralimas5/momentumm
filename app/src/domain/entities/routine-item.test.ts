import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import {
  createRoutineItem,
  isRoutineScheduledOn,
  planOccurrenceMove,
  routineExecutionFor,
  routineTimeline,
  routineRateBetween,
  routineDayStates,
  routineStatusOf,
  routineWeek,
  weekdaysOf,
  type RoutineItem,
  type RoutineOccurrence,
  type RoutineStatus,
} from './routine-item'
import { DomainError } from '@/shared/errors'

const NASCIMENTO = new Date('2026-09-01T08:00:00')

// 2026-09-27 é domingo; 28 segunda, 29 terça, 30 quarta, 01/10 quinta.
const DOMINGO = parseDayKey('2026-09-27')
const SEGUNDA = parseDayKey('2026-09-28')
const TERCA = parseDayKey('2026-09-29')
const QUARTA = parseDayKey('2026-09-30')
const SABADO = parseDayKey('2026-10-03')

function item(id: string, input: Partial<Parameters<typeof createRoutineItem>[0]> = {}): RoutineItem {
  return createRoutineItem(
    { userId: 'lay', title: `Item ${id}`, ...input },
    id,
    NASCIMENTO,
  )
}

function occurrence(
  itemId: string,
  day: string,
  options: {
    status?: RoutineStatus
    movedToDay?: string
    timeOverride?: string
  } = {},
): RoutineOccurrence {
  return {
    id: `o-${itemId}-${day}`,
    userId: 'lay',
    itemId,
    day: parseDayKey(day),
    status: options.status ?? 'feito',
    plannedTime: null,
    timeOverride: options.timeOverride ?? null,
    movedToDay: options.movedToDay ? parseDayKey(options.movedToDay) : null,
    completedAt: null,
    createdAt: new Date('2026-09-28T09:00:00'),
  }
}

describe('createRoutineItem', () => {
  it('nome e dias já bastam', () => {
    const treino = item('t', { title: 'Treino', weekdays: [1, 3, 5] })

    expect(treino.recurrence).toBe('dias-semana')
    expect(treino.weekdays).toEqual([1, 3, 5])
    expect(treino.timeOfDay).toBeNull()
    expect(treino.durationMin).toBeNull()
    expect(treino.objectiveId).toBeNull()
  })

  it('sem dias marcados, nasce diário', () => {
    expect(item('a', { title: 'Acordar' }).recurrence).toBe('diario')
  })

  it('recusa dias específicos sem nenhum dia', () => {
    expect(() => item('x', { recurrence: 'dias-semana', weekdays: [] })).toThrow(DomainError)
  })

  it('recusa horário fora do formato', () => {
    expect(() => item('x', { timeOfDay: '7h' })).toThrow(DomainError)
  })

  it('item de uma vez só nasce com a data', () => {
    const dentista = item('d', { title: 'Dentista', recurrence: 'unica', day: TERCA })

    expect(dentista.day).toBe(TERCA)
    expect(dentista.weekdays).toEqual([])
  })

  it('recorrente não guarda data', () => {
    expect(item('t', { weekdays: [1] }).day).toBeNull()
  })
})

describe('isRoutineScheduledOn', () => {
  it('diário cai todo dia', () => {
    const acordar = item('a', { recurrence: 'diario' })

    expect(isRoutineScheduledOn(acordar, DOMINGO)).toBe(true)
    expect(isRoutineScheduledOn(acordar, QUARTA)).toBe(true)
  })

  it('dias específicos caem só nos dias marcados', () => {
    const treino = item('t', { weekdays: [1, 3, 5] })

    expect(isRoutineScheduledOn(treino, SEGUNDA)).toBe(true)
    expect(isRoutineScheduledOn(treino, TERCA)).toBe(false)
    expect(isRoutineScheduledOn(treino, QUARTA)).toBe(true)
  })

  it('dias úteis excluem o fim de semana', () => {
    const trabalho = item('w', { recurrence: 'uteis' })

    expect(weekdaysOf(trabalho)).toEqual([1, 2, 3, 4, 5])
    expect(isRoutineScheduledOn(trabalho, SEGUNDA)).toBe(true)
    expect(isRoutineScheduledOn(trabalho, DOMINGO)).toBe(false)
    expect(isRoutineScheduledOn(trabalho, SABADO)).toBe(false)
  })

  it('fim de semana é sábado e domingo', () => {
    const feira = item('f', { recurrence: 'fim-semana' })

    expect(isRoutineScheduledOn(feira, SABADO)).toBe(true)
    expect(isRoutineScheduledOn(feira, DOMINGO)).toBe(true)
    expect(isRoutineScheduledOn(feira, SEGUNDA)).toBe(false)
  })

  it('uma vez só cai no dia dela', () => {
    const dentista = item('d', { recurrence: 'unica', day: TERCA })

    expect(isRoutineScheduledOn(dentista, TERCA)).toBe(true)
    expect(isRoutineScheduledOn(dentista, QUARTA)).toBe(false)
  })

  it('não cobra dia anterior à criação', () => {
    const novo = createRoutineItem(
      { userId: 'lay', title: 'Novo' },
      'n',
      new Date('2026-09-29T10:00:00'),
    )

    expect(isRoutineScheduledOn(novo, SEGUNDA)).toBe(false)
    expect(isRoutineScheduledOn(novo, TERCA)).toBe(true)
  })
})

describe('routineDayStates', () => {
  it('sem ocorrência, o item está pendente', () => {
    const states = routineDayStates([item('a')], [], SEGUNDA)

    expect(states).toHaveLength(1)
    expect(states[0]?.status).toBe('pendente')
    expect(states[0]?.occurrence).toBeNull()
  })

  it('o cenário 1: concluir a segunda não conclui a quarta', () => {
    const treino = item('t', { title: 'Treino', weekdays: [1, 3, 5], timeOfDay: '18:30' })
    const logs = [occurrence('t', '2026-09-28', { status: 'feito' })]

    expect(routineStatusOf(logs, 't', SEGUNDA)).toBe('feito')
    expect(routineStatusOf(logs, 't', QUARTA)).toBe('pendente')
    expect(routineDayStates([treino], logs, SEGUNDA)[0]?.status).toBe('feito')
    expect(routineDayStates([treino], logs, QUARTA)[0]?.status).toBe('pendente')
  })

  it('pular a quarta não mexe na sexta', () => {
    const treino = item('t', { weekdays: [1, 3, 5] })
    const logs = [occurrence('t', '2026-09-30', { status: 'pulado' })]

    expect(routineDayStates([treino], logs, QUARTA)[0]?.status).toBe('pulado')
    expect(routineDayStates([treino], logs, parseDayKey('2026-10-02'))[0]?.status).toBe('pendente')
  })

  it('ordena pelo relógio, e sem horário vai pro fim', () => {
    const states = routineDayStates(
      [
        item('c', { title: 'Café', timeOfDay: '07:30' }),
        item('l', { title: 'Ler' }),
        item('a', { title: 'Acordar', timeOfDay: '07:00' }),
      ],
      [],
      SEGUNDA,
    )

    expect(states.map((state) => state.item.title)).toEqual(['Acordar', 'Café', 'Ler'])
  })

  it('o horário trocado vale só naquele dia', () => {
    const treino = item('t', { timeOfDay: '18:30' })
    const logs = [occurrence('t', '2026-09-28', { status: 'pendente', timeOverride: '20:00' })]

    expect(routineDayStates([treino], logs, SEGUNDA)[0]?.time).toBe('20:00')
    expect(routineDayStates([treino], logs, TERCA)[0]?.time).toBe('18:30')
  })

  it('reagendado some da origem e aparece no destino', () => {
    const treino = item('t', { title: 'Treino', weekdays: [1] })
    const logs = [occurrence('t', '2026-09-28', { status: 'reagendado', movedToDay: '2026-09-29' })]

    expect(routineDayStates([treino], logs, SEGUNDA)).toHaveLength(0)

    const destino = routineDayStates([treino], logs, TERCA)
    expect(destino).toHaveLength(1)
    expect(destino[0]?.movedFrom).toBe(SEGUNDA)
    expect(destino[0]?.status).toBe('pendente')
  })

  it('item diário movido pro dia seguinte não aparece duas vezes', () => {
    const acordar = item('a', { recurrence: 'diario' })
    const logs = [occurrence('a', '2026-09-28', { status: 'reagendado', movedToDay: '2026-09-29' })]

    expect(routineDayStates([acordar], logs, TERCA)).toHaveLength(1)
  })

  it('concluir no destino não escreve no dia de origem', () => {
    const treino = item('t', { weekdays: [1] })
    const logs = [
      occurrence('t', '2026-09-28', { status: 'reagendado', movedToDay: '2026-09-29' }),
      occurrence('t', '2026-09-29', { status: 'feito' }),
    ]

    expect(routineDayStates([treino], logs, TERCA)[0]?.status).toBe('feito')
    expect(routineStatusOf(logs, 't', SEGUNDA)).toBe('reagendado')
  })

  it('item pausado sai do dia sem sumir da rotina', () => {
    const pausado: RoutineItem = { ...item('p'), pausedAt: new Date('2026-09-20') }

    expect(routineDayStates([pausado], [], SEGUNDA)).toHaveLength(0)
  })

  it('item arquivado sai do dia', () => {
    const arquivado: RoutineItem = { ...item('a'), archivedAt: new Date('2026-09-20') }

    expect(routineDayStates([arquivado], [], SEGUNDA)).toHaveLength(0)
  })
})

describe('routineWeek', () => {
  it('devolve um dia por posição, com o estado de cada um', () => {
    const treino = item('t', { title: 'Treino', weekdays: [1, 3] })
    const semana = routineWeek([treino], [], [SEGUNDA, TERCA, QUARTA])

    expect(semana.map((dia) => dia.states.length)).toEqual([1, 0, 1])
  })
})

/**
 * As datas, que é onde recorrência costuma quebrar.
 *
 * Todo cálculo de dia passa por `dayKeyToDate`, que ancora ao MEIO-DIA local
 * justamente pra aritmética de dias sobreviver a horário de verão. Estes casos
 * são o contrato disso valendo pra rotina também: sem eles, uma mudança em
 * `day.ts` passaria a repetir ou pular um dia e ninguém descobriria até alguém
 * reclamar que o treino de quarta sumiu.
 */
describe('recorrência ao longo do tempo', () => {
  it('dias específicos caem o número exato de vezes em duas semanas', () => {
    const treino = item('t', { weekdays: [1, 3, 5] })
    const dias = Array.from({ length: 14 }, (_, index) => {
      const base = new Date(2026, 8, 28 + index, 12)
      return parseDayKey(
        `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`,
      )
    })

    const caem = dias.filter((day) => isRoutineScheduledOn(treino, day))
    expect(caem).toHaveLength(6)
  })

  it('atravessa a virada do mês sem pular nem repetir', () => {
    const diario = item('d', { recurrence: 'diario' })
    const dias = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map(parseDayKey)

    expect(dias.every((day) => isRoutineScheduledOn(diario, day))).toBe(true)
  })

  it('atravessa a virada do ano', () => {
    const antigo = createRoutineItem(
      { userId: 'lay', title: 'Acordar' },
      'a',
      new Date('2026-12-30T08:00:00'),
    )
    const dias = ['2026-12-31', '2027-01-01', '2027-01-02'].map(parseDayKey)

    expect(dias.every((day) => isRoutineScheduledOn(antigo, day))).toBe(true)
  })

  it('o dia da semana sai do calendário local, não de UTC', () => {
    // 2026-10-05 é segunda. Quem calculasse por `toISOString` num fuso a oeste
    // leria domingo aqui, e o treino de segunda apareceria no dia errado.
    const segunda = item('s', { weekdays: [1] })

    expect(isRoutineScheduledOn(segunda, parseDayKey('2026-10-05'))).toBe(true)
    expect(isRoutineScheduledOn(segunda, parseDayKey('2026-10-04'))).toBe(false)
    expect(isRoutineScheduledOn(segunda, parseDayKey('2026-10-06'))).toBe(false)
  })

  it('a semana inteira de um item de fim de semana são dois dias', () => {
    const feira = item('f', { recurrence: 'fim-semana' })
    const semana = routineWeek(
      [feira],
      [],
      ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map(
        parseDayKey,
      ),
    )

    expect(semana.filter((dia) => dia.states.length > 0)).toHaveLength(2)
  })
})

describe('planOccurrenceMove', () => {
  const base = { from: SEGUNDA, currentTime: '07:00', ruleTime: '07:00' }

  it('no mesmo dia vira só horário trocado', () => {
    expect(planOccurrenceMove({ ...base, to: SEGUNDA, time: '19:30' })).toEqual({
      kind: 'mesmo-dia',
      time: '19:30',
    })
  })

  it('no mesmo dia exige um horário diferente do atual', () => {
    expect(() => planOccurrenceMove({ ...base, to: SEGUNDA, time: '07:00' })).toThrow(DomainError)
    expect(() => planOccurrenceMove({ ...base, to: SEGUNDA, time: null })).toThrow(DomainError)
  })

  it('não volta pro passado', () => {
    expect(() => planOccurrenceMove({ ...base, to: DOMINGO, time: '08:00' })).toThrow(DomainError)
  })

  it('em outro dia guarda o horário só quando ele difere da regra', () => {
    expect(planOccurrenceMove({ ...base, to: QUARTA, time: '07:00' })).toEqual({
      kind: 'outro-dia',
      day: QUARTA,
      time: null,
    })
    expect(planOccurrenceMove({ ...base, to: QUARTA, time: '21:00' })).toEqual({
      kind: 'outro-dia',
      day: QUARTA,
      time: '21:00',
    })
  })

  it('recusa horário malformado', () => {
    expect(() => planOccurrenceMove({ ...base, to: QUARTA, time: '25:00' })).toThrow(DomainError)
  })
})

describe('routineExecutionFor', () => {
  const treino = item('t', { objectiveId: 'correr', timeOfDay: '18:30', recurrence: 'dias-semana', weekdays: [1, 3, 5] })
  const alongar = item('a', { objectiveId: 'correr' })
  const outro = item('x', { objectiveId: 'ler' })

  it('conta só o feito do objetivo, dentro da janela', () => {
    const logs = [
      occurrence('t', '2026-09-28'),
      occurrence('t', '2026-09-30'),
      occurrence('t', '2026-09-27', { status: 'pulado' }),
      occurrence('x', '2026-09-28'),
      occurrence('t', '2026-10-03'),
    ]
    const result = routineExecutionFor('correr', [treino, alongar, outro], logs, SEGUNDA, QUARTA)
    expect(result.map((row) => [row.itemId, row.done])).toEqual([
      ['t', 2],
      ['a', 0],
    ])
  })

  it('reagendado conta no dia em que foi feito', () => {
    const logs = [
      occurrence('t', '2026-09-28', { status: 'reagendado', movedToDay: '2026-09-29' }),
      occurrence('t', '2026-09-29'),
    ]
    expect(routineExecutionFor('correr', [treino], logs, SEGUNDA, TERCA)[0]?.done).toBe(1)
  })
})

describe('routineTimeline', () => {
  const acordar = item('acordar', { timeOfDay: '07:00' })
  const treino = item('treino', { timeOfDay: '18:30' })
  const ler = item('ler')
  const states = routineDayStates([acordar, treino, ler], [], SEGUNDA)

  it('separa o que tem horário do que fica pra algum momento', () => {
    const timeline = routineTimeline(states, null)
    expect(timeline.timed.map((s) => s.item.id)).toEqual(['acordar', 'treino'])
    expect(timeline.untimed.map((s) => s.item.id)).toEqual(['ler'])
    expect(timeline.nowIndex).toBeNull()
  })

  it('o agora entra antes do primeiro item que ainda não chegou', () => {
    expect(routineTimeline(states, '12:00').nowIndex).toBe(1)
    expect(routineTimeline(states, '06:00').nowIndex).toBe(0)
  })

  it('depois do último horário, o agora vai pro fim', () => {
    expect(routineTimeline(states, '23:00').nowIndex).toBe(2)
  })
})

describe('routineRateBetween', () => {
  const acordar = item('acordar')
  const treino = item('treino')

  it('conta o feito sobre o que a rotina pôs nos dias, sem o pulado', () => {
    const logs = [
      occurrence('acordar', '2026-09-28'),
      occurrence('treino', '2026-09-28', { status: 'pulado' }),
      occurrence('acordar', '2026-09-29'),
    ]
    // Dois dias × dois itens = 4, menos 1 pulado = 3. Feitos: 2.
    expect(routineRateBetween([acordar, treino], logs, SEGUNDA, TERCA)).toEqual({ done: 2, total: 3 })
  })

  it('sem rotina, sem total', () => {
    expect(routineRateBetween([], [], SEGUNDA, QUARTA)).toEqual({ done: 0, total: 0 })
  })
})
