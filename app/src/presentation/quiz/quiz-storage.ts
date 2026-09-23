import type { QuizAttribution } from '@/domain/analytics/funnel-events'
import { EMPTY_ATTRIBUTION } from '@/domain/analytics/funnel-events'
import { EMPTY_QUIZ_ANSWERS, isQuizComplete, type CompleteQuizAnswers, type QuizAnswers } from '@/domain/entities/quiz'

/**
 * O quiz no navegador.
 *
 * Duas coisas ficam guardadas, e por motivos diferentes:
 *
 * - o RASCUNHO (`momentumm.quiz.draft.v1`): passo e respostas, pra a página
 *   atualizada não perder o que foi respondido. É formulário pela metade,
 *   não dado de negócio
 * - o PLANO PENDENTE (`momentumm.quiz.pending.v1`): as respostas completas
 *   depois que a pessoa tocou em "Ativar meu plano". É o que `/app/ativar`
 *   lê depois do cadastro, inclusive quando o login com Google volta sem
 *   estado nenhum. Ele carrega a origem (UTMs) pra ir junto no
 *   `plan_activated`
 *
 * Nenhuma das duas chaves tem id de conta: o quiz acontece antes de existir
 * conta, e a chave da sessão do quiz vive em `infrastructure/analytics/funnel`.
 */

const DRAFT_KEY = 'momentumm.quiz.draft.v1'
const PENDING_KEY = 'momentumm.quiz.pending.v1'
const FIRST_WIN_KEY = 'momentumm.quiz.first-win.v1'

export interface QuizDraft {
  readonly step: number
  readonly answers: QuizAnswers
  readonly attribution: QuizAttribution
}

export function loadQuizDraft(): QuizDraft | null {
  const value = read<Partial<QuizDraft>>(DRAFT_KEY)
  if (!value?.answers) return null
  return {
    step: typeof value.step === 'number' ? value.step : 0,
    answers: { ...EMPTY_QUIZ_ANSWERS, ...value.answers },
    attribution: { ...EMPTY_ATTRIBUTION, ...(value.attribution ?? {}) },
  }
}

export function saveQuizDraft(draft: QuizDraft): void {
  write(DRAFT_KEY, draft)
}

export function clearQuizDraft(): void {
  remove(DRAFT_KEY)
}

export interface PendingQuizPlan {
  readonly answers: CompleteQuizAnswers
  readonly attribution: QuizAttribution
  readonly savedAt: string
}

export function loadPendingQuizPlan(): PendingQuizPlan | null {
  const value = read<Partial<PendingQuizPlan>>(PENDING_KEY)
  if (!value?.answers) return null
  const answers: QuizAnswers = { ...EMPTY_QUIZ_ANSWERS, ...value.answers }
  if (!isQuizComplete(answers)) return null
  return {
    answers,
    attribution: { ...EMPTY_ATTRIBUTION, ...(value.attribution ?? {}) },
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
  }
}

export function savePendingQuizPlan(plan: Omit<PendingQuizPlan, 'savedAt'>): void {
  write(PENDING_KEY, { ...plan, savedAt: new Date().toISOString() })
}

export function clearPendingQuizPlan(): void {
  remove(PENDING_KEY)
}

/**
 * A primeira vitória: a ação de hoje criada pelo plano, guardada por conta.
 * Fica por título e dia (o id nasce no provider, depois da gravação
 * otimista). O Hoje destaca essa ação até ela ser concluída, e o funil marca
 * `first_action_completed` uma vez só.
 */
export interface FirstWin {
  readonly taskTitle: string
  readonly day: string
  readonly activatedAt: string
}

function firstWinKey(userId: string): string {
  return `${FIRST_WIN_KEY}:${userId}`
}

export function loadFirstWin(userId: string): FirstWin | null {
  const value = read<Partial<FirstWin>>(firstWinKey(userId))
  return value && typeof value.taskTitle === 'string' && typeof value.day === 'string'
    ? { taskTitle: value.taskTitle, day: value.day, activatedAt: value.activatedAt ?? '' }
    : null
}

export function saveFirstWin(userId: string, win: FirstWin): void {
  write(firstWinKey(userId), win)
}

export function clearFirstWin(userId: string): void {
  remove(firstWinKey(userId))
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento o quiz segue funcionando; só não sobrevive ao reload.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nada a fazer.
  }
}
