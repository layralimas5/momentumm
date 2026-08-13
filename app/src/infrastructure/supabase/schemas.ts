import { z } from 'zod'
import { ACTIVITY_SOURCES, ACTIVITY_VISIBILITIES, type Activity } from '@/domain/entities/activity'
import { ACTIVITY_TYPE_SLUGS } from '@/domain/entities/activity-type'
import { parseDayKey } from '@/domain/entities/day'
import { GOAL_PERIODS, type Goal } from '@/domain/entities/goal'
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
    createdAt: new Date(parsed.created_at),
  }
}
