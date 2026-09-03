import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import { addDays, parseDayKey } from './day'
import {
  createTask,
  groupPendingTasks,
  mainPriorityOf,
  nextTaskForGoal,
  postponeTask,
  shrinkToMinimal,
  supportingTasksOf,
  type Task,
} from './task'

const TODAY = parseDayKey('2026-09-03')

function task(overrides: Partial<Parameters<typeof createTask>[0]> = {}, id = 't1'): Task {
  return createTask({ userId: 'u1', title: 'Treinar 45 minutos', day: TODAY, ...overrides }, id)
}

describe('createTask', () => {
  it('nasce pendente e com estimativa padrão', () => {
    expect(task()).toMatchObject({ status: 'pendente', estimatedMin: 25, effort: 'medio' })
  })

  it('recusa título curto demais', () => {
    expect(() => task({ title: 'a' })).toThrow(DomainError)
  })

  it('recusa uma ação de mais de oito horas', () => {
    expect(() => task({ estimatedMin: 600 })).toThrow(DomainError)
  })

  it('trata versão mínima em branco como ausente', () => {
    expect(task({ minimalVersion: '  ' }).minimalVersion).toBeNull()
  })
})

describe('mainPriorityOf', () => {
  it('devolve a ação marcada como principal', () => {
    const tasks = [task({}, 'a'), task({ isMainPriority: true }, 'b')]
    expect(mainPriorityOf(tasks, TODAY)?.id).toBe('b')
  })

  it('sem nenhuma marcada, elege a primeira pendente', () => {
    // A tela não pode ficar sem resposta pra "o que eu faço agora?".
    expect(mainPriorityOf([task({}, 'a'), task({}, 'b')], TODAY)?.id).toBe('a')
  })

  it('ignora ação já concluída', () => {
    const done: Task = { ...task({}, 'a'), status: 'feita' }
    expect(mainPriorityOf([done, task({}, 'b')], TODAY)?.id).toBe('b')
  })

  it('devolve null quando não há nada pendente hoje', () => {
    expect(mainPriorityOf([task({ day: addDays(TODAY, 1) })], TODAY)).toBeNull()
  })
})

describe('supportingTasksOf', () => {
  it('não repete a prioridade principal na lista de apoio', () => {
    const tasks = [task({ isMainPriority: true }, 'a'), task({}, 'b')]
    expect(supportingTasksOf(tasks, TODAY).map((item) => item.id)).toEqual(['b'])
  })
})

describe('groupPendingTasks', () => {
  it('mantém a ação atrasada dentro de hoje', () => {
    // Esconder o atrasado não resolve o atrasado.
    const late = task({ day: addDays(TODAY, -2) }, 'late')
    const groups = groupPendingTasks([late], TODAY)
    expect(groups[0]?.key).toBe('hoje')
  })

  it('separa hoje, semana e depois', () => {
    const tasks = [
      task({}, 'hoje'),
      task({ day: addDays(TODAY, 1) }, 'semana'),
      task({ day: addDays(TODAY, 30) }, 'depois'),
    ]
    expect(groupPendingTasks(tasks, TODAY).map((group) => group.key)).toEqual([
      'hoje',
      'semana',
      'depois',
    ])
  })

  it('não devolve grupo vazio', () => {
    expect(groupPendingTasks([task()], TODAY)).toHaveLength(1)
  })
})

describe('shrinkToMinimal', () => {
  it('troca a ação pela versão mínima e alivia o esforço', () => {
    const original = task({ minimalVersion: 'Fazer 10 minutos', estimatedMin: 45, effort: 'pesado' })
    const smaller = shrinkToMinimal(original)
    expect(smaller).toMatchObject({
      title: 'Fazer 10 minutos',
      minimalVersion: null,
      estimatedMin: 15,
      effort: 'leve',
    })
  })

  it('recusa encolher ação sem versão mínima', () => {
    expect(() => shrinkToMinimal(task())).toThrow(DomainError)
  })
})

describe('postponeTask', () => {
  it('adia a partir de hoje quando a ação está atrasada', () => {
    const late = task({ day: addDays(TODAY, -3) })
    expect(postponeTask(late, TODAY).day).toBe(addDays(TODAY, 1))
  })

  it('adiar mantém a ação viva, não a marca como falha', () => {
    expect(postponeTask(task(), TODAY).status).toBe('pendente')
  })
})

describe('nextTaskForGoal', () => {
  it('devolve a pendente mais próxima da meta', () => {
    const tasks = [
      task({ goalId: 'g1', day: addDays(TODAY, 5) }, 'longe'),
      task({ goalId: 'g1' }, 'perto'),
      task({ goalId: 'g2' }, 'outra'),
    ]
    expect(nextTaskForGoal(tasks, 'g1')?.id).toBe('perto')
  })

  it('devolve null quando a meta não tem ação', () => {
    expect(nextTaskForGoal([], 'g1')).toBeNull()
  })
})
