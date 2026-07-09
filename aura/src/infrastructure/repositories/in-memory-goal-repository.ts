import type { GoalRepository } from '@/domain/repositories/goal-repository'
import { GoalRules, type Goal, type NewGoal } from '@/domain/entities/goal'

/**
 * Repositório em memória — usado como demo quando o Supabase ainda não está
 * configurado, pra app subir e ser navegável. NÃO persiste entre reloads.
 */
export class InMemoryGoalRepository implements GoalRepository {
  private goals: Goal[]

  constructor(seed: Goal[] = defaultSeed()) {
    this.goals = [...seed]
  }

  async listByUser(userId: string): Promise<Goal[]> {
    return this.goals.filter((g) => g.userId === userId)
  }

  async create(userId: string, data: NewGoal): Promise<Goal> {
    const goal: Goal = {
      id: crypto.randomUUID(),
      userId,
      title: data.title.trim(),
      description: data.description ?? null,
      progress: 0,
      status: 'active',
      dueDate: data.dueDate ?? null,
      createdAt: new Date().toISOString(),
    }
    this.goals = [goal, ...this.goals]
    return goal
  }

  async updateProgress(id: string, progress: number): Promise<Goal> {
    return this.mutate(id, (g) => {
      const clamped = GoalRules.clampProgress(progress)
      g.progress = clamped
      g.status = clamped >= 100 ? 'completed' : 'active'
    })
  }

  async complete(id: string): Promise<Goal> {
    return this.mutate(id, (g) => {
      g.progress = 100
      g.status = 'completed'
    })
  }

  async remove(id: string): Promise<void> {
    this.goals = this.goals.filter((g) => g.id !== id)
  }

  private mutate(id: string, fn: (goal: Goal) => void): Goal {
    const goal = this.goals.find((g) => g.id === id)
    if (!goal) throw new Error(`Meta ${id} não encontrada`)
    fn(goal)
    return goal
  }
}

function defaultSeed(): Goal[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'seed-goal-1',
      userId: 'demo',
      title: 'Ler 12 livros este ano',
      description: 'Um por mês — constância acima de intensidade.',
      progress: 66,
      status: 'active',
      dueDate: null,
      createdAt: now,
    },
    {
      id: 'seed-goal-2',
      userId: 'demo',
      title: 'Estabelecer rotina de manhã',
      description: 'Acordar 6h, 20 min de leitura antes do celular.',
      progress: 40,
      status: 'active',
      dueDate: null,
      createdAt: now,
    },
    {
      id: 'seed-goal-3',
      userId: 'demo',
      title: 'Lançar o meu primeiro produto',
      description: null,
      progress: 15,
      status: 'active',
      dueDate: null,
      createdAt: now,
    },
  ]
}
