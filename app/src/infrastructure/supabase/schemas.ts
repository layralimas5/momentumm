import { z } from 'zod'
import { ACTIVITY_SOURCES, ACTIVITY_VISIBILITIES, type Activity } from '@/domain/entities/activity'
import { CUSTOM_AXIS_COLORS, type ActivityType } from '@/domain/entities/activity-type'
import {
  FOCUS_CAPACITIES,
  MOOD_STATES,
  type CheckIn,
  type EnergyLevel,
} from '@/domain/entities/checkin'
import {
  DAY_PARTS,
  HABIT_FREQUENCIES,
  HABIT_ICONS,
  HABIT_STATUSES,
  type Habit,
  type HabitIcon,
  type HabitLog,
} from '@/domain/entities/habit'
import { TASK_EFFORTS, TASK_STATUSES, type Task } from '@/domain/entities/task'
import type { Win } from '@/domain/entities/win'
import { parseDayKey } from '@/domain/entities/day'
import { GOAL_PERIODS, type Goal } from '@/domain/entities/goal'
import type { Objective } from '@/domain/entities/objective'
import { PLAN_TIERS } from '@/domain/entities/plan'
import { STAGE_STATUSES, type PlanStage } from '@/domain/entities/plan-stage'
import { PRIORITIES } from '@/domain/entities/priority'
import type { Profile } from '@/domain/entities/profile'
import { REVIEW_STEPS, type WeeklyReview } from '@/domain/entities/weekly-review'
import { ParseError } from '@/shared/errors'

/**
 * Fronteira com o banco. Nada entra no domínio sem passar por aqui: coluna
 * renomeada ou enum novo vira erro explícito em vez de `undefined` na tela.
 */

const activityRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type_slug: z.string(),
  value: z.number().int(),
  unit: z.enum(['paginas', 'minutos']),
  duration_min: z.number().int(),
  note: z.string().nullable(),
  day: z.string(),
  occurred_at: z.string(),
  visibility: z.enum(ACTIVITY_VISIBILITIES),
  source: z.enum(ACTIVITY_SOURCES),
})

const goalRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type_slug: z.string(),
  target: z.number().int(),
  period: z.enum(GOAL_PERIODS),
  created_at: z.string(),
  archived_at: z.string().nullable(),
})

const objectiveRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  axis_slug: z.string(),
  motive: z.string().nullable(),
  target: z.number().int(),
  started_on: z.string(),
  deadline: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  // Colunas do V1. `nullish` de propósito: um banco que ainda não rodou a
  // migration 0005 devolve a linha sem elas, e a lista não pode quebrar por isso.
  description: z.string().nullish(),
  priority: z.enum(PRIORITIES).nullish(),
  paused_at: z.string().nullish(),
})

const profileRowSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  default_visibility: z.enum(ACTIVITY_VISIBILITIES),
  // Conta criada antes da migration de planos não tem a coluna preenchida.
  plan: z.enum(PLAN_TIERS).nullish(),
  created_at: z.string(),
})

const customAxisRowSchema = z.object({
  slug: z.string(),
  label: z.string(),
  verb: z.string(),
  unit: z.enum(['paginas', 'minutos']),
  color: z.string().nullish(),
  sort_order: z.number().int().nullish(),
})

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ParseError(`Formato inesperado ao ler ${label}.`, result.error.issues)
  }
  return result.data
}

export function toActivity(row: unknown): Activity {
  const parsed = parseOrThrow(activityRowSchema, row, 'atividade')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    type: parsed.type_slug,
    value: parsed.value,
    unit: parsed.unit,
    durationMin: parsed.duration_min,
    note: parsed.note,
    day: parseDayKey(parsed.day.slice(0, 10)),
    occurredAt: new Date(parsed.occurred_at),
    visibility: parsed.visibility,
    source: parsed.source,
  }
}

export function toGoal(row: unknown): Goal {
  const parsed = parseOrThrow(goalRowSchema, row, 'meta')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    type: parsed.type_slug,
    target: parsed.target,
    period: parsed.period,
    createdAt: new Date(parsed.created_at),
    archivedAt: parsed.archived_at ? new Date(parsed.archived_at) : null,
  }
}

export function toObjective(row: unknown): Objective {
  const parsed = parseOrThrow(objectiveRowSchema, row, 'objetivo')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    title: parsed.title,
    axis: parsed.axis_slug,
    description: parsed.description ?? null,
    motive: parsed.motive,
    priority: parsed.priority ?? 'media',
    target: parsed.target,
    startedOn: parseDayKey(parsed.started_on.slice(0, 10)),
    deadline: parseDayKey(parsed.deadline.slice(0, 10)),
    createdAt: new Date(parsed.created_at),
    completedAt: parsed.completed_at ? new Date(parsed.completed_at) : null,
    pausedAt: parsed.paused_at ? new Date(parsed.paused_at) : null,
    archivedAt: parsed.archived_at ? new Date(parsed.archived_at) : null,
  }
}

export function toCustomAxis(row: unknown): ActivityType {
  const parsed = parseOrThrow(customAxisRowSchema, row, 'área')
  const order = parsed.sort_order ?? 0
  const fallback = CUSTOM_AXIS_COLORS[Math.abs(order) % CUSTOM_AXIS_COLORS.length]

  return {
    slug: parsed.slug,
    label: parsed.label,
    verb: parsed.verb,
    unit: parsed.unit,
    unitLabel:
      parsed.unit === 'paginas'
        ? { one: 'página', many: 'páginas' }
        : { one: 'minuto', many: 'minutos' },
    colorToken: parsed.color ?? fallback ?? 'var(--color-brand)',
    quickValues: parsed.unit === 'paginas' ? [10, 20, 30, 50] : [10, 20, 30, 45],
    builtin: false,
  }
}

export function toProfile(row: unknown): Profile {
  const parsed = parseOrThrow(profileRowSchema, row, 'perfil')
  return {
    id: parsed.id,
    handle: parsed.handle,
    name: parsed.name,
    bio: parsed.bio,
    avatarUrl: parsed.avatar_url,
    defaultVisibility: parsed.default_visibility,
    plan: parsed.plan ?? 'free',
    createdAt: new Date(parsed.created_at),
  }
}

const checkInRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  day: z.string(),
  mood: z.enum(MOOD_STATES),
  energy: z.number().int().min(1).max(5),
  focus: z.enum(FOCUS_CAPACITIES),
  note: z.string().nullable(),
  created_at: z.string(),
})

const habitRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  // Ícone desconhecido não pode derrubar a lista de hábitos: cai no padrão.
  icon: z.string(),
  axis_slug: z.string(),
  day_part: z.enum(DAY_PARTS),
  weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
  target: z.number().int(),
  minimal_target: z.number().int(),
  created_at: z.string(),
  archived_at: z.string().nullable(),
  description: z.string().nullish(),
  objective_id: z.string().nullish(),
  priority: z.enum(PRIORITIES).nullish(),
  frequency: z.enum(HABIT_FREQUENCIES).nullish(),
  time_of_day: z.string().nullish(),
  times_per_week: z.number().int().min(1).max(7).nullish(),
  paused_at: z.string().nullish(),
  stage_id: z.string().nullish(),
})

const habitLogRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  habit_id: z.string(),
  day: z.string(),
  status: z.enum(HABIT_STATUSES),
  created_at: z.string(),
})

const taskRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  goal_id: z.string().nullable(),
  axis_slug: z.string().nullable(),
  estimated_min: z.number().int(),
  effort: z.enum(TASK_EFFORTS),
  minimal_version: z.string().nullable(),
  day: z.string(),
  is_main_priority: z.boolean(),
  status: z.enum(TASK_STATUSES),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  description: z.string().nullish(),
  objective_id: z.string().nullish(),
  priority: z.enum(PRIORITIES).nullish(),
  time_of_day: z.string().nullish(),
  sort_order: z.number().int().nullish(),
  depends_on_id: z.string().nullish(),
  // Colunas da hierarquia (migration 0007). `nullish` porque um banco que ainda
  // não rodou a migration devolve a linha sem elas, e o plano inteiro não pode
  // sumir da tela por causa disso.
  stage_id: z.string().nullish(),
  weight: z.number().int().nullish(),
  is_required: z.boolean().nullish(),
})

const planStageRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  objective_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  weight: z.number().int(),
  status: z.enum(STAGE_STATUSES),
  due_on: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
})

const winRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  day: z.string(),
  text: z.string(),
  created_at: z.string(),
})

function isHabitIcon(value: string): value is HabitIcon {
  return (HABIT_ICONS as readonly string[]).includes(value)
}

export function toCheckIn(row: unknown): CheckIn {
  const parsed = parseOrThrow(checkInRowSchema, row, 'check-in')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    day: parseDayKey(parsed.day.slice(0, 10)),
    mood: parsed.mood,
    energy: parsed.energy as EnergyLevel,
    focus: parsed.focus,
    note: parsed.note,
    createdAt: new Date(parsed.created_at),
  }
}

export function toHabit(row: unknown): Habit {
  const parsed = parseOrThrow(habitRowSchema, row, 'hábito')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    name: parsed.name,
    description: parsed.description ?? null,
    icon: isHabitIcon(parsed.icon) ? parsed.icon : 'livro',
    axis: parsed.axis_slug,
    objectiveId: parsed.objective_id ?? null,
    stageId: parsed.stage_id ?? null,
    priority: parsed.priority ?? 'media',
    // Hábito criado antes da frequência existir: dias marcados viram
    // "dias específicos", sem dias marcados vira diário. É a mesma inferência
    // que `createHabit` faz, e as duas precisam concordar.
    frequency: parsed.frequency ?? ((parsed.weekdays ?? []).length > 0 ? 'dias-semana' : 'diario'),
    dayPart: parsed.day_part,
    timeOfDay: parsed.time_of_day ?? null,
    weekdays: parsed.weekdays ?? [],
    timesPerWeek: parsed.times_per_week ?? 7,
    target: parsed.target,
    minimalTarget: parsed.minimal_target,
    createdAt: new Date(parsed.created_at),
    pausedAt: parsed.paused_at ? new Date(parsed.paused_at) : null,
    archivedAt: parsed.archived_at ? new Date(parsed.archived_at) : null,
  }
}

export function toHabitLog(row: unknown): HabitLog {
  const parsed = parseOrThrow(habitLogRowSchema, row, 'registro de hábito')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    habitId: parsed.habit_id,
    day: parseDayKey(parsed.day.slice(0, 10)),
    status: parsed.status,
    createdAt: new Date(parsed.created_at),
  }
}

export function toTask(row: unknown): Task {
  const parsed = parseOrThrow(taskRowSchema, row, 'ação')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    title: parsed.title,
    description: parsed.description ?? null,
    goalId: parsed.goal_id,
    objectiveId: parsed.objective_id ?? null,
    stageId: parsed.stage_id ?? null,
    // Linha anterior à 0007: peso 1 e obrigatória são exatamente o que ela já
    // significava, então o default preserva o sentido em vez de inventar um novo.
    weight: parsed.weight ?? 1,
    isRequired: parsed.is_required ?? true,
    axis: parsed.axis_slug,
    estimatedMin: parsed.estimated_min,
    effort: parsed.effort,
    priority: parsed.priority ?? 'media',
    minimalVersion: parsed.minimal_version,
    day: parseDayKey(parsed.day.slice(0, 10)),
    timeOfDay: parsed.time_of_day ?? null,
    order: parsed.sort_order ?? 0,
    dependsOnId: parsed.depends_on_id ?? null,
    isMainPriority: parsed.is_main_priority,
    status: parsed.status,
    completedAt: parsed.completed_at ? new Date(parsed.completed_at) : null,
    createdAt: new Date(parsed.created_at),
  }
}

export function toWin(row: unknown): Win {
  const parsed = parseOrThrow(winRowSchema, row, 'vitória')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    day: parseDayKey(parsed.day.slice(0, 10)),
    text: parsed.text,
    createdAt: new Date(parsed.created_at),
  }
}

const weeklyReviewRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  week_start: z.string(),
  achievements: z.string().nullable(),
  difficulties: z.string().nullable(),
  learnings: z.string().nullable(),
  adjustments: z.string().nullable(),
  priorities: z.array(z.string()).nullable(),
  ai_summary: z.string().nullable(),
  last_step: z.enum(REVIEW_STEPS),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export function toWeeklyReview(row: unknown): WeeklyReview {
  const parsed = parseOrThrow(weeklyReviewRowSchema, row, 'review da semana')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    weekStart: parseDayKey(parsed.week_start.slice(0, 10)),
    achievements: parsed.achievements,
    difficulties: parsed.difficulties,
    learnings: parsed.learnings,
    adjustments: parsed.adjustments,
    priorities: parsed.priorities ?? [],
    aiSummary: parsed.ai_summary,
    lastStep: parsed.last_step,
    completedAt: parsed.completed_at ? new Date(parsed.completed_at) : null,
    createdAt: new Date(parsed.created_at),
    updatedAt: new Date(parsed.updated_at),
  }
}

export function toPlanStage(row: unknown): PlanStage {
  const parsed = parseOrThrow(planStageRowSchema, row, 'etapa do plano')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    objectiveId: parsed.objective_id,
    title: parsed.title,
    description: parsed.description,
    order: parsed.sort_order,
    weight: parsed.weight,
    status: parsed.status,
    dueOn: parsed.due_on ? parseDayKey(parsed.due_on.slice(0, 10)) : null,
    completedAt: parsed.completed_at ? new Date(parsed.completed_at) : null,
    createdAt: new Date(parsed.created_at),
  }
}
