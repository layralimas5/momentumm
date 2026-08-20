import { z } from 'zod'
import { ACTIVITY_TYPE_SLUGS } from '@/domain/entities/activity-type'
import type { TimerSession } from '@/domain/entities/timer'

const STORAGE_KEY = 'momentumm.timer.v1'

/**
 * A sessão vive no dispositivo, não no banco: o cronômetro precisa sobreviver a
 * um F5 ou a uma aba fechada sem custar uma escrita de rede por segundo.
 */
const sessionSchema = z.object({
  type: z.enum(ACTIVITY_TYPE_SLUGS),
  startedAt: z.string().datetime(),
  accumulatedMs: z.number().finite().min(0),
  runningSince: z.string().datetime().nullable(),
})

export function loadTimerSession(): TimerSession | null {
  const raw = safeRead()
  if (!raw) return null

  const parsed = sessionSchema.safeParse(raw)
  if (!parsed.success) {
    clearTimerSession()
    return null
  }

  return {
    type: parsed.data.type,
    startedAt: new Date(parsed.data.startedAt),
    accumulatedMs: parsed.data.accumulatedMs,
    runningSince: parsed.data.runningSince ? new Date(parsed.data.runningSince) : null,
  }
}

export function saveTimerSession(session: TimerSession): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        type: session.type,
        startedAt: session.startedAt.toISOString(),
        accumulatedMs: session.accumulatedMs,
        runningSince: session.runningSince?.toISOString() ?? null,
      }),
    )
  } catch {
    // Armazenamento cheio ou bloqueado: o cronômetro segue na memória.
  }
}

export function clearTimerSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nada a fazer: leitura seguinte simplesmente não encontra sessão.
  }
}

function safeRead(): unknown {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as unknown) : null
  } catch {
    return null
  }
}
