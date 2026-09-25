import { DomainError } from '@/shared/errors'
import { MAX_DURATION_MIN, type NewActivityInput } from './activity'
import { activityType, type ActivityTypeSlug } from './activity-type'

/**
 * Cronômetro de sessão. Existe porque a mecânica número 1 do produto é fricção
 * quase zero: quem lê ou estuda com o app aberto não deveria precisar lembrar
 * do relógio e depois digitar um número.
 *
 * A sessão não é uma entidade persistida no banco: ela vira uma `Activity` com
 * `source: 'timer'` no fim. Enquanto corre, mora no dispositivo.
 */
export interface TimerSession {
  readonly type: ActivityTypeSlug
  readonly startedAt: Date
  /** Tempo já contabilizado antes da pausa atual. */
  readonly accumulatedMs: number
  /** Instante em que voltou a correr. `null` quando está pausado. */
  readonly runningSince: Date | null
  /** A ação que está sendo executada. É o que a sessão de foco mostra na tela. */
  readonly label: string | null
  /** Ação de onde a sessão saiu, pra concluir as duas de uma vez. */
  readonly taskId: string | null
  /** Duração escolhida no seletor. Vira alvo visual, nunca corte automático. */
  readonly plannedMin: number | null
}

export interface StartTimerOptions {
  readonly label?: string | null
  readonly taskId?: string | null
  readonly plannedMin?: number | null
}

const MS_PER_MINUTE = 60_000

/** Abaixo de um minuto não vira registro: arredondaria pra zero e o domínio recusa. */
export const MIN_TIMER_MS = MS_PER_MINUTE

export function startTimer(
  type: ActivityTypeSlug,
  now: Date = new Date(),
  options: StartTimerOptions = {},
): TimerSession {
  return {
    type,
    startedAt: now,
    accumulatedMs: 0,
    runningSince: now,
    label: options.label?.trim() || null,
    taskId: options.taskId ?? null,
    plannedMin: options.plannedMin ?? null,
  }
}

/** Quanto da duração planejada já foi cumprido, de 0 a 1. */
export function plannedProgress(session: TimerSession, now: Date = new Date()): number {
  if (!session.plannedMin) return 0
  return Math.min(1, elapsedMs(session, now) / (session.plannedMin * MS_PER_MINUTE))
}

export function isRunning(session: TimerSession): boolean {
  return session.runningSince !== null
}

export function elapsedMs(session: TimerSession, now: Date = new Date()): number {
  if (!session.runningSince) return session.accumulatedMs
  // Relógio do sistema pode andar pra trás (ajuste de hora, suspensão): nunca
  // deixar o tempo corrido ficar negativo.
  const current = Math.max(0, now.getTime() - session.runningSince.getTime())
  return session.accumulatedMs + current
}

export function elapsedMinutes(session: TimerSession, now: Date = new Date()): number {
  return Math.floor(elapsedMs(session, now) / MS_PER_MINUTE)
}

export function pauseTimer(session: TimerSession, now: Date = new Date()): TimerSession {
  if (!session.runningSince) return session
  return { ...session, accumulatedMs: elapsedMs(session, now), runningSince: null }
}

export function resumeTimer(session: TimerSession, now: Date = new Date()): TimerSession {
  if (session.runningSince) return session
  return { ...session, runningSince: now }
}

export function canFinish(session: TimerSession, now: Date = new Date()): boolean {
  return elapsedMs(session, now) >= MIN_TIMER_MS
}

/** Eixo medido em páginas precisa do valor: o tempo não diz quanto foi lido. */
export function needsValue(session: TimerSession): boolean {
  return activityType(session.type).unit !== 'minutos'
}

export interface FinishTimerInput {
  /** Obrigatório nos eixos medidos em páginas, ignorado nos medidos em minutos. */
  readonly value?: number | undefined
  readonly note?: string | null | undefined
}

export function finishTimer(
  session: TimerSession,
  now: Date = new Date(),
  input: FinishTimerInput = {},
): Omit<NewActivityInput, 'userId'> {
  const total = elapsedMs(session, now)
  if (total < MIN_TIMER_MS) {
    throw new DomainError('O cronômetro precisa de pelo menos um minuto pra virar registro.')
  }

  // Sessão esquecida aberta a noite inteira não pode virar um registro absurdo.
  const durationMin = Math.min(Math.round(total / MS_PER_MINUTE), MAX_DURATION_MIN)

  const value = needsValue(session) ? input.value : durationMin
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    const unit = activityType(session.type).unitLabel.many
    throw new DomainError(`Informe quantas ${unit} você fez nessa sessão.`)
  }

  return {
    type: session.type,
    value,
    durationMin,
    note: input.note ?? session.label,
    startedAt: session.startedAt,
    occurredAt: now,
    source: 'timer',
  }
}

/** `MM:SS` até uma hora, `HH:MM:SS` depois disso. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
