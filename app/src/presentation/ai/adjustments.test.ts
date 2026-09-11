import { describe, expect, it } from 'vitest'
import type { AiRefs } from '@/domain/ai/ai-context'
import { addDays, parseDayKey } from '@/domain/entities/day'
import { createHabit } from '@/domain/entities/habit'
import { createObjective } from '@/domain/entities/objective'
import { createTask } from '@/domain/entities/task'
import { adjustmentDay, editAdjustment, resolveAdjustment, type AdjustmentTargets } from './adjustments'

const TODAY = parseDayKey('2026-09-11')

const task = createTask(
  { userId: 'u1', title: 'Ler o capítulo 4', day: TODAY, estimatedMin: 25, minimalVersion: 'Ler 5 páginas' },
  't1',
)
const bare = createTask({ userId: 'u1', title: 'Sem mínima', day: TODAY }, 't2')
const objective = createObjective(
  { userId: 'u1', title: 'Ler 6 livros', axis: 'leitura', target: 1800, startedOn: TODAY, deadline: addDays(TODAY, 30) },
  'o1',
)
const habit = createHabit(
  { userId: 'u1', name: 'Ler antes de dormir', icon: 'livro', axis: 'leitura', dayPart: 'noite', target: 20 },
  'h1',
)

const refs: AiRefs = {
  tasks: new Map([
    ['a1', 't1'],
    ['a2', 't2'],
  ]),
  objectives: new Map([['o1', 'o1']]),
  habits: new Map([['h1', 'h1']]),
}

const targets: AdjustmentTargets = {
  refs,
  tasks: [task, bare],
  objectives: [objective],
  habits: [habit],
  today: TODAY,
}

describe('resolveAdjustment', () => {
  it('traduz o ref pro título e diz o que muda', () => {
    const resolved = resolveAdjustment(
      { type: 'move_action', ref: 'a1', toDay: addDays(TODAY, 1), reason: 'Dia cheio.' },
      targets,
    )
    expect(resolved.target).toBe('Ler o capítulo 4')
    expect(resolved.label).toContain('Mover pra')
    expect(resolved.blocked).toBeNull()
    expect(resolved.editable).toBe('day')
  })

  it('bloqueia ref que a IA inventou, em vez de escrever em qualquer linha', () => {
    const resolved = resolveAdjustment(
      { type: 'set_main_priority', ref: 'a99', reason: 'x' },
      targets,
    )
    expect(resolved.target).toBeNull()
    expect(resolved.blocked).toMatch(/não está mais na conta/)
  })

  it('bloqueia data no passado e encolher sem versão mínima', () => {
    expect(
      resolveAdjustment(
        { type: 'move_action', ref: 'a1', toDay: addDays(TODAY, -1), reason: 'x' },
        targets,
      ).blocked,
    ).toMatch(/já passou/)
    expect(
      resolveAdjustment({ type: 'shrink_action', ref: 'a2', reason: 'x' }, targets).blocked,
    ).toMatch(/versão mínima/)
    expect(
      resolveAdjustment({ type: 'shrink_action', ref: 'a1', reason: 'x' }, targets).blocked,
    ).toBeNull()
  })

  it('descreve prazo, frequência e ação nova com o alvo certo', () => {
    const deadline = resolveAdjustment(
      { type: 'extend_deadline', ref: 'o1', toDay: addDays(TODAY, 45), reason: 'x' },
      targets,
    )
    expect(deadline.target).toBe('Ler 6 livros')
    expect(deadline.label).toContain('Prazo pra')

    const frequency = resolveAdjustment(
      { type: 'change_habit_frequency', ref: 'h1', timesPerWeek: 3, weekdays: [1, 3, 5], reason: 'x' },
      targets,
    )
    expect(frequency.target).toBe('Ler antes de dormir')
    expect(frequency.label).toBe('Frequência: seg, qua, sex')

    const created = resolveAdjustment(
      {
        type: 'create_action',
        title: 'Dez minutos de leitura',
        day: TODAY,
        estimatedMin: 10,
        minimalVersion: null,
        objectiveRef: 'o1',
        reason: 'x',
      },
      targets,
    )
    expect(created.target).toBe('Ler 6 livros')
    expect(created.label).toContain('Nova ação')
  })
})

describe('editAdjustment', () => {
  it('troca a data ou a duração conforme o tipo, e ignora o que não se edita', () => {
    const moved = editAdjustment(
      { type: 'move_action', ref: 'a1', toDay: TODAY, reason: 'x' },
      { day: addDays(TODAY, 3) },
    )
    expect(adjustmentDay(moved)).toBe(addDays(TODAY, 3))

    const timed = editAdjustment(
      { type: 'set_minutes', ref: 'a1', estimatedMin: 25, reason: 'x' },
      { minutes: 15 },
    )
    expect(timed.type === 'set_minutes' && timed.estimatedMin).toBe(15)

    const untouched = editAdjustment({ type: 'shrink_action', ref: 'a1', reason: 'x' }, { day: TODAY })
    expect(untouched).toEqual({ type: 'shrink_action', ref: 'a1', reason: 'x' })
  })
})
