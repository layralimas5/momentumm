import { DomainError } from '@/shared/errors'

/**
 * Freio local de tentativas repetidas.
 *
 * ## O que ele é, e principalmente o que ele NÃO é
 *
 * Isto **não** é a proteção contra força bruta. A proteção de verdade é do
 * servidor — o GoTrue tem limite por IP e por e-mail, configurado no painel —
 * e ela continua valendo mesmo pra quem nunca abre o app. Um atacante bate
 * direto no endpoint e não executa uma linha deste arquivo.
 *
 * O que este freio faz é fechar a janela do navegador: impede o formulário de
 * disparar dezenas de tentativas em segundos (dedo no Enter, script de
 * console, extensão), que é o que transforma um teclado numa ferramenta de
 * teste de senha e o que faz o usuário legítimo bater no limite do servidor
 * sem entender por quê.
 *
 * Fica no domínio porque a regra é do produto, é pura e precisa de teste.
 *
 * ## A escada
 *
 * As primeiras tentativas passam livres — errar a senha duas vezes é humano.
 * A partir da terceira o intervalo cresce, e a espera tem teto: bloquear por
 * uma hora não protege mais do que bloquear por um minuto contra quem está
 * automatizando, e destrói a noite de quem só esqueceu a senha.
 */

export const THROTTLED_ACTIONS = ['login', 'cadastro', 'recuperacao'] as const
export type ThrottledAction = (typeof THROTTLED_ACTIONS)[number]

/** Tentativas livres antes de a escada começar. */
export const FREE_ATTEMPTS = 3

/** Espera base, em segundos. Dobra a cada tentativa acima do limite livre. */
const BASE_DELAY_S = 5

/** Teto da espera. Além disso o freio vira punição, não proteção. */
const MAX_DELAY_S = 300

/** Depois desse tempo sem tentar, a contagem zera. */
const RESET_AFTER_MS = 15 * 60 * 1000

export interface AttemptRecord {
  readonly attempts: number
  /** Epoch em ms da última tentativa. */
  readonly lastAt: number
}

export type AttemptLog = Readonly<Partial<Record<ThrottledAction, AttemptRecord>>>

export interface ThrottleVerdict {
  readonly allowed: boolean
  /** Segundos que faltam. Zero quando liberado. */
  readonly waitSeconds: number
  readonly message: string | null
}

/**
 * A tentativa pode acontecer agora?
 *
 * `now` entra por parâmetro pra a regra ser testável sem relógio falso — a
 * mesma decisão que o resto do domínio toma com `today`.
 */
export function checkThrottle(
  log: AttemptLog,
  action: ThrottledAction,
  now: number = Date.now(),
): ThrottleVerdict {
  const record = log[action]
  if (!record) return FREE

  const since = now - record.lastAt
  if (since >= RESET_AFTER_MS) return FREE

  const excess = record.attempts - FREE_ATTEMPTS
  if (excess <= 0) return FREE

  const delayMs = delayFor(excess) * 1000
  if (since >= delayMs) return FREE

  const waitSeconds = Math.max(1, Math.ceil((delayMs - since) / 1000))

  return {
    allowed: false,
    waitSeconds,
    message: `Muitas tentativas seguidas. Tenta de novo em ${formatWait(waitSeconds)}.`,
  }
}

/** Falhou: a contagem sobe. Só o fracasso conta — acertar não pune ninguém. */
export function registerFailure(
  log: AttemptLog,
  action: ThrottledAction,
  now: number = Date.now(),
): AttemptLog {
  const record = log[action]
  const expired = !record || now - record.lastAt >= RESET_AFTER_MS

  return {
    ...log,
    [action]: { attempts: expired ? 1 : record.attempts + 1, lastAt: now },
  }
}

/** Deu certo: a escada some pra essa ação. */
export function clearAttempts(log: AttemptLog, action: ThrottledAction): AttemptLog {
  const next = { ...log }
  delete next[action]
  return next
}

/** Lança quando a ação está travada. É o guarda que a camada de UI chama. */
export function assertThrottle(
  log: AttemptLog,
  action: ThrottledAction,
  now: number = Date.now(),
): void {
  const verdict = checkThrottle(log, action, now)
  if (!verdict.allowed && verdict.message) {
    throw new DomainError(verdict.message)
  }
}

const FREE: ThrottleVerdict = { allowed: true, waitSeconds: 0, message: null }

function delayFor(excess: number): number {
  return Math.min(MAX_DELAY_S, BASE_DELAY_S * 2 ** (excess - 1))
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}
