import { z } from 'zod'
import { parseDayKey } from '@/domain/entities/day'
import {
  ACHIEVEMENT_KEYS,
  XP_KINDS,
  type EvolutionSnapshot,
  type UnlockedAchievement,
  type XpTransaction,
} from '@/domain/entities/evolution'
import type { EvolutionRepository } from '@/domain/repositories/evolution-repository'
import { InfrastructureError, ParseError } from '@/shared/errors'
import { supabase } from './client'

const evolutionRowSchema = z.object({
  xp_total: z.number().int().nonnegative(),
  level: z.number().int().positive(),
})

const transactionRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: z.enum(XP_KINDS),
  points: z.number().int().positive(),
  event_key: z.string(),
  source_type: z.string(),
  source_id: z.string().nullable(),
  day: z.string(),
  created_at: z.string(),
})

const achievementRowSchema = z.object({
  key: z.enum(ACHIEVEMENT_KEYS),
  unlocked_at: z.string(),
})

/** Guarda só o que a tela mostra: o histórico inteiro não precisa vir a cada abertura. */
const TRANSACTION_LIMIT = 400

/**
 * `xp_transactions`, `user_evolution` e `user_achievements`: o dono lê, e
 * ninguém escreve pela API (migration 0031). Uma conta sem linha em
 * `user_evolution` ainda não ganhou nada: é nível 1 com zero, não um erro.
 */
export class SupabaseEvolutionRepository implements EvolutionRepository {
  async load(userId: string): Promise<EvolutionSnapshot> {
    const [evolution, transactions, achievements] = await Promise.all([
      supabase().from('user_evolution').select('xp_total, level').eq('user_id', userId).maybeSingle(),
      supabase()
        .from('xp_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(TRANSACTION_LIMIT),
      supabase().from('user_achievements').select('key, unlocked_at').eq('user_id', userId),
    ])

    if (evolution.error) throw new InfrastructureError('Não consegui ler a tua evolução.', evolution.error)
    if (transactions.error) {
      throw new InfrastructureError('Não consegui ler o histórico de XP.', transactions.error)
    }
    if (achievements.error) {
      throw new InfrastructureError('Não consegui ler as conquistas.', achievements.error)
    }

    const totals = evolution.data ? parse(evolutionRowSchema, evolution.data, 'evolução') : null

    return {
      xpTotal: totals?.xp_total ?? 0,
      level: totals?.level ?? 1,
      transactions: (transactions.data ?? []).map(toTransaction),
      achievements: (achievements.data ?? []).map(toAchievement),
    }
  }
}

function toTransaction(row: unknown): XpTransaction {
  const parsed = parse(transactionRowSchema, row, 'transação de XP')
  return {
    id: parsed.id,
    userId: parsed.user_id,
    kind: parsed.kind,
    points: parsed.points,
    eventKey: parsed.event_key,
    sourceType: parsed.source_type,
    sourceId: parsed.source_id,
    day: parseDayKey(parsed.day.slice(0, 10)),
    createdAt: new Date(parsed.created_at),
  }
}

function toAchievement(row: unknown): UnlockedAchievement {
  const parsed = parse(achievementRowSchema, row, 'conquista')
  return { key: parsed.key, unlockedAt: new Date(parsed.unlocked_at) }
}

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ParseError(`Registro de ${label} fora do formato esperado.`, result.error.issues)
  }
  return result.data
}
