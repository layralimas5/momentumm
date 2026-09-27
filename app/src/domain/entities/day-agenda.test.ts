import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import {
  buildDayAgenda,
  isPastPlannedTime,
  openAgendaItems,
  openAgendaMinutes,
  partOfTime,
  type AgendaItem,
} from './day-agenda'
import type { DayPart, Habit, HabitDayState, HabitStatus } from './habit'
import {
  createRoutineItem,
  type RoutineDayState,
  type RoutineStatus,
} from './routine-item'
import type { Task, TaskStatus } from './task'

const HOJE = parseDayKey('2026-09-27')
const AMANHA = parseDayKey('2026-09-28')

function task(
  id: string,
  options: {
    day?: string
    time?: string | null
    status?: TaskStatus
    main?: boolean
    minutes?: number
  } = {},
): Task {
  return {
    id,
    userId: 'lay',
    title: `Ação ${id}`,
    description: null,
    goalId: null,
    objectiveId: null,
    stageId: null,
    weight: 1,
    isRequired: true,
    axis: null,
    estimatedMin: options.minutes ?? 30,
    effort: 'medio',
    priority: 'media',
    minimalVersion: null,
    day: parseDayKey(options.day ?? HOJE),
    timeOfDay: options.time ?? null,
    order: 0,
    dependsOnId: null,
    isMainPriority: options.main ?? false,
    status: options.status ?? 'pendente',
    completedAt: null,
    createdAt: new Date('2026-09-01'),
  }
}

function habitState(
  id: string,
  options: {
    time?: string | null
    dayPart?: DayPart
    status?: HabitStatus
    target?: number
  } = {},
): HabitDayState {
  const habit = {
    id,
    userId: 'lay',
    name: `Hábito ${id}`,
    description: null,
    icon: 'livro',
    axis: 'estudo',
    objectiveId: null,
    stageId: null,
    priority: 'media',
    frequency: 'diario',
    dayPart: options.dayPart ?? 'qualquer',
    timeOfDay: options.time ?? null,
    weekdays: [],
    timesPerWeek: 7,
    target: options.target ?? 20,
    minimalTarget: 5,
    createdAt: new Date('2026-09-01'),
    pausedAt: null,
    archivedAt: null,
  } satisfies Habit

  return { habit, status: options.status ?? 'pendente', streak: 0 }
}

function routineState(
  id: string,
  options: { title?: string; time?: string | null; status?: RoutineStatus; duration?: number } = {},
): RoutineDayState {
  const item = createRoutineItem(
    {
      userId: 'lay',
      title: options.title ?? `Rotina ${id}`,
      timeOfDay: options.time ?? null,
      durationMin: options.duration ?? null,
    },
    id,
    new Date('2026-09-01'),
  )

  return {
    item,
    status: options.status ?? 'pendente',
    time: options.time ?? null,
    occurrence: null,
    movedFrom: null,
  }
}

function titles(items: readonly AgendaItem[]): string[] {
  return items.map((item) => item.title)
}

describe('partOfTime', () => {
  it('corta o dia em manhã, tarde e noite', () => {
    expect(partOfTime('07:00')).toBe('manha')
    expect(partOfTime('11:59')).toBe('manha')
    expect(partOfTime('12:00')).toBe('tarde')
    expect(partOfTime('17:59')).toBe('tarde')
    expect(partOfTime('18:00')).toBe('noite')
    expect(partOfTime('23:30')).toBe('noite')
  })
})

describe('buildDayAgenda', () => {
  it('junta ação e hábito na mesma lista, em ordem de relógio', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [task('t1', { time: '14:00' }), task('t2', { time: '09:00' })],
        habitStates: [habitState('h1', { time: '18:30' })],
        routineStates: [],
      },
      HOJE,
    )

    expect(titles(agenda.items)).toEqual(['Ação t2', 'Ação t1', 'Hábito h1'])
    expect(agenda.total).toBe(3)
  })

  it('agrupa por trecho do dia e não cria seção vazia', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [task('t1', { time: '08:00' }), task('t2', { time: '21:00' })],
        habitStates: [], routineStates: [] ,
      },
      HOJE,
    )

    expect(agenda.groups.map((group) => group.part)).toEqual(['manha', 'noite'])
  })

  it('manda o item sem horário pro fim, no trecho de "algum momento"', () => {
    const agenda = buildDayAgenda(
      { tasks: [task('t1'), task('t2', { time: '07:00' })], habitStates: [], routineStates: []  },
      HOJE,
    )

    expect(titles(agenda.items)).toEqual(['Ação t2', 'Ação t1'])
    const last = agenda.groups.at(-1)
    expect(last?.part).toBe('qualquer')
    expect(last?.label).toBe('Em algum momento de hoje')
  })

  it('respeita o trecho declarado pelo hábito sem horário', () => {
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [habitState('h1', { dayPart: 'noite' })], routineStates: [] },
      HOJE,
    )

    expect(agenda.groups[0]?.part).toBe('noite')
  })

  it('não deixa o item concluído descer pro fim da lista', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [
          task('t1', { time: '07:00', status: 'feita' }),
          task('t2', { time: '09:00' }),
        ],
        habitStates: [], routineStates: [] ,
      },
      HOJE,
    )

    expect(titles(agenda.items)).toEqual(['Ação t1', 'Ação t2'])
    expect(agenda.done).toBe(1)
    expect(agenda.ratio).toBeCloseTo(0.5)
  })

  it('ignora ação de outro dia e ação cancelada', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [
          task('t1', { day: AMANHA }),
          task('t2', { status: 'cancelada' }),
          task('t3'),
        ],
        habitStates: [], routineStates: [] ,
      },
      HOJE,
    )

    expect(titles(agenda.items)).toEqual(['Ação t3'])
  })

  it('não puxa ação atrasada pro dia', () => {
    const agenda = buildDayAgenda(
      { tasks: [task('t1', { day: '2026-09-20' })], habitStates: [], routineStates: []  },
      HOJE,
    )

    expect(agenda.empty).toBe(true)
  })

  it('conta hábito na versão mínima como concluído', () => {
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [habitState('h1', { status: 'minimo' })], routineStates: [] },
      HOJE,
    )

    expect(agenda.done).toBe(1)
  })

  it('mantém na lista, sem cobrar, o que foi pulado', () => {
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [habitState('h1', { status: 'pulado' })], routineStates: [] },
      HOJE,
    )

    expect(agenda.total).toBe(1)
    expect(agenda.items[0]?.skipped).toBe(true)
    expect(agenda.done).toBe(0)
    expect(openAgendaItems(agenda)).toHaveLength(0)
  })

  it('dia sem nada é vazio, e a razão não é NaN', () => {
    const agenda = buildDayAgenda({ tasks: [], habitStates: [], routineStates: []  }, HOJE)

    expect(agenda.empty).toBe(true)
    expect(agenda.ratio).toBe(0)
    expect(agenda.groups).toHaveLength(0)
  })

  it('aponta pro registro original em vez de copiar', () => {
    const original = task('t1')
    const agenda = buildDayAgenda({ tasks: [original], habitStates: [], routineStates: []  }, HOJE)

    expect(agenda.items[0]?.task).toBe(original)
  })

  it('o cenário 5 do produto: dez itens do dia, todos na lista', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [
          task('p1', { main: true, time: '09:00' }),
          task('p2', { time: '10:00' }),
          task('r1', { time: '14:00' }),
          task('r2', { time: '15:00' }),
          task('r3', { time: '16:00' }),
          task('r4' ),
          task('c1', { time: '10:30' }),
        ],
        habitStates: [
          habitState('h1', { time: '07:00' }),
          habitState('h2', { time: '19:00' }),
          habitState('h3'),
        ],
        routineStates: [],
      },
      HOJE,
    )

    expect(agenda.total).toBe(10)
    expect(agenda.groups.map((group) => group.part)).toEqual([
      'manha',
      'tarde',
      'noite',
      'qualquer',
    ])
  })
})

describe('a rotina dentro do dia', () => {
  it('entra na mesma lista de ação e hábito, em ordem de relógio', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [task('t1', { time: '09:00' })],
        habitStates: [habitState('h1', { time: '18:30' })],
        routineStates: [
          routineState('r1', { title: 'Acordar', time: '07:00' }),
          routineState('r2', { title: 'Almoço', time: '12:00' }),
        ],
      },
      HOJE,
    )

    expect(titles(agenda.items)).toEqual(['Acordar', 'Ação t1', 'Almoço', 'Hábito h1'])
    expect(agenda.total).toBe(4)
  })

  it('aponta pro estado original, pra o check escrever na mesma ocorrência', () => {
    const state = routineState('r1')
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [], routineStates: [state] },
      HOJE,
    )

    expect(agenda.items[0]?.routineState).toBe(state)
    expect(agenda.items[0]?.kind).toBe('rotina')
  })

  it('pulado fica na lista, sem contar como feito nem como pendente', () => {
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [], routineStates: [routineState('r1', { status: 'pulado' })] },
      HOJE,
    )

    expect(agenda.total).toBe(1)
    expect(agenda.done).toBe(0)
    expect(agenda.items[0]?.skipped).toBe(true)
    expect(openAgendaItems(agenda)).toHaveLength(0)
  })

  it('concluído conta no progresso do dia', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [],
        habitStates: [],
        routineStates: [routineState('r1', { status: 'feito' }), routineState('r2')],
      },
      HOJE,
    )

    expect(agenda.done).toBe(1)
    expect(agenda.ratio).toBeCloseTo(0.5)
  })

  it('a categoria da pessoa vira o papel da linha', () => {
    const state = routineState('r1')
    const comCategoria: RoutineDayState = {
      ...state,
      item: { ...state.item, category: 'Saúde' },
    }
    const agenda = buildDayAgenda(
      { tasks: [], habitStates: [], routineStates: [comCategoria] },
      HOJE,
    )

    expect(agenda.items[0]?.role).toBe('Saúde')
  })

  it('a duração do item entra na soma do que falta', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [],
        habitStates: [],
        routineStates: [routineState('r1', { duration: 45 })],
      },
      HOJE,
    )

    expect(openAgendaMinutes(agenda)).toBe(45)
  })
})

describe('openAgendaMinutes', () => {
  it('soma só o que está em aberto', () => {
    const agenda = buildDayAgenda(
      {
        tasks: [
          task('t1', { minutes: 30 }),
          task('t2', { minutes: 45, status: 'feita' }),
        ],
        habitStates: [], routineStates: [] ,
      },
      HOJE,
    )

    expect(openAgendaMinutes(agenda)).toBe(30)
  })

  it('devolve null quando nada em aberto tem estimativa', () => {
    const agenda = buildDayAgenda({ tasks: [], habitStates: [], routineStates: []  }, HOJE)

    expect(openAgendaMinutes(agenda)).toBeNull()
  })
})

describe('isPastPlannedTime', () => {
  const agenda = buildDayAgenda(
    {
      tasks: [task('t1', { time: '18:00' }), task('t2', { time: '22:00' })],
      habitStates: [], routineStates: [] ,
    },
    HOJE,
  )
  const [dezoito, vinteEDuas] = agenda.items

  it('diz que o horário passou sem chamar de atraso', () => {
    expect(isPastPlannedTime(dezoito as AgendaItem, new Date('2026-09-27T19:20:00'))).toBe(true)
    expect(isPastPlannedTime(vinteEDuas as AgendaItem, new Date('2026-09-27T19:20:00'))).toBe(false)
  })

  it('item sem horário nunca passa da hora', () => {
    const semHora = buildDayAgenda({ tasks: [task('t3')], habitStates: [], routineStates: []  }, HOJE).items[0]
    expect(isPastPlannedTime(semHora as AgendaItem, new Date('2026-09-27T23:00:00'))).toBe(false)
  })
})
