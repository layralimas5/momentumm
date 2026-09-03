import { z } from 'zod'
import { ACTIVITY_SOURCES, ACTIVITY_VISIBILITIES, type Activity } from '@/domain/entities/activity'
import { ACTIVITY_TYPE_SLUGS } from '@/domain/entities/activity-type'
import {
  FOCUS_CAPACITIES,
  MOOD_STATES,
  type CheckIn,
  type EnergyLevel,
} from '@/domain/entities/checkin'
import {
  DAY_PARTS,
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
import { PLAN_TIERS } from '@/domain/entities/plan'
import type { Profile } from '@/domain/entities/profile'
import { ParseError } from '@/shared/errors'

/**
 * Fronteira com o banco. Nada entra no domínio sem passar por aqui: coluna
 * renomeada ou enum novo vira erro explícito em vez de `undefined` na tela.
 */

const activityRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type_slug: z.enum(ACTIVITY_TYPE_SLUGS),
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
  type_slug: z.enum(ACTIVITY_TYPE_SLUGS),
  target: z.number().int(),
  period: z.enum(GOAL_PERIODS),
  created_at: z.string(),
  archived_at: z.string().nullable(),
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
  axis_slug: z.enum(ACTIVITY_TYPE_SLUGS),
  day_part: z.enum(DAY_PARTS),
  weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
  target: z.number().int(),
  minimal_target: z.number().int(),
  created_at: z.string(),
  archived_at: z.string().nullable(),
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
  axis_slug: z.enum(ACTIVITY_TYPE_SLUGS).nullable(),
  estimated_min: z.number().int(),
  effort: z.enum(TASK_EFFORTS),
  minimal_version: z.string().nullable(),
  day: z.string(),
  is_main_priority: z.boolean(),
  status: z.enum(TASK_STATUSES),
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
    icon: isHabitIcon(parsed.icon) ? parsed.icon : 'livro',
    axis: parsed.axis_slug,
    dayPart: parsed.day_part,
    weekdays: parsed.weekdays ?? [],
    target: parsed.target,
    minimalTarget: parsed.minimal_target,
    createdAt: new Date(parsed.created_at),
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
    goalId: parsed.goal_id,
    axis: parsed.axis_slug,
    estimatedMin: parsed.estimated_min,
    effort: parsed.effort,
    minimalVersion: parsed.minimal_version,
    day: parseDayKey(parsed.day.slice(0, 10)),
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
