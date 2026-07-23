import { z } from 'zod'
import type { Database } from './database.types'

/**
 * Schemas runtime das linhas do banco — o par de verificação do `database.types.ts`,
 * que só existe em tempo de compilação. Devem espelhar as migrations em
 * `supabase/migrations/`; ao mudar uma tabela, mude o schema junto.
 *
 * As asserções no fim do arquivo garantem que schema e tipo não saiam de sincronia:
 * se divergirem, o `tsc` quebra o build em vez de deixar o erro chegar em runtime.
 */

const uuid = z.string().min(1)
const timestamp = z.string().min(1)

export const goalRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  title: z.string(),
  description: z.string().nullable(),
  progress: z.number(),
  status: z.enum(['active', 'completed', 'archived']),
  due_date: z.string().nullable(),
  created_at: timestamp,
})

export const bookRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  title: z.string(),
  author: z.string().nullable(),
  status: z.enum(['to_read', 'reading', 'read']),
  progress: z.number(),
  notes: z.string().nullable(),
  created_at: timestamp,
})

export const habitRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  emoji: z.string(),
  title: z.string(),
  scheduled_time: z.string().nullable(),
  created_at: timestamp,
})

/** Projeção usada na listagem — só o que o agregado de hábitos precisa. */
export const habitLogRefSchema = z.object({
  habit_id: uuid,
  done_on: z.string(),
})

/** Projeção usada na listagem de missões — só a data concluída importa. */
export const missionCompletionRefSchema = z.object({
  done_on: z.string(),
})

export const diaryEntryRowSchema = z.object({
  id: uuid,
  user_id: uuid,
  content: z.string(),
  created_at: timestamp,
})

export const identityRowSchema = z.object({
  user_id: uuid,
  becoming: z.string(),
  morning: z.string(),
  dressing: z.string(),
  daily: z.string(),
  never_again: z.string(),
  created_at: timestamp,
  updated_at: timestamp,
})

export const profileRowSchema = z.object({
  id: uuid,
  email: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  subscription_status: z.enum(['pending', 'active', 'canceled', 'blocked']),
  plan: z.string().nullable(),
  created_at: timestamp,
})

// ─────────────────────────────────────────────────────────────
// Sincronia schema ⇄ tipo (verificada pelo compilador)
// ─────────────────────────────────────────────────────────────

type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** `true` só quando `A` e `B` são exatamente o mesmo tipo; senão `false`. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/**
 * Só aceita `true`. Passar um `Exact<...>` que deu `false` viola a constraint e
 * quebra a compilação — é isso que transforma a divergência em erro de build.
 * (Um alias que resolve pra `never` não erraria: `never` satisfaz qualquer constraint.)
 */
type AssertExact<T extends true> = T

export type SchemaSyncCheck = [
  AssertExact<Exact<z.infer<typeof goalRowSchema>, Row<'goals'>>>,
  AssertExact<Exact<z.infer<typeof bookRowSchema>, Row<'books'>>>,
  AssertExact<Exact<z.infer<typeof habitRowSchema>, Row<'habits'>>>,
  AssertExact<Exact<z.infer<typeof diaryEntryRowSchema>, Row<'diary_entries'>>>,
  AssertExact<Exact<z.infer<typeof identityRowSchema>, Row<'identities'>>>,
  AssertExact<Exact<z.infer<typeof profileRowSchema>, Row<'profiles'>>>,
  AssertExact<
    Exact<z.infer<typeof habitLogRefSchema>, Pick<Row<'habit_logs'>, 'habit_id' | 'done_on'>>
  >,
  AssertExact<
    Exact<z.infer<typeof missionCompletionRefSchema>, Pick<Row<'mission_completions'>, 'done_on'>>
  >,
]
