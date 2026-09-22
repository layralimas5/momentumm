import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  hasAttribution,
  readAttribution,
  type QuizAttribution,
} from '@/domain/analytics/funnel-events'
import { dayKeyOf } from '@/domain/entities/day'
import {
  buildDiagnosis,
  buildQuizPlan,
  EMPTY_QUIZ_ANSWERS,
  isQuizComplete,
  QUIZ_QUESTION_COUNT,
  quizBlocker,
  quizIntro,
  type QuizAnswers,
  type QuizDiagnosis,
  type QuizIntro,
  type QuizPlanPreview,
} from '@/domain/entities/quiz'
import {
  saveQuizAnswers,
  startFreshQuizSession,
  trackFunnel,
  trackFunnelOnLeave,
} from '@/infrastructure/analytics/funnel'
import { clearQuizDraft, loadQuizDraft, savePendingQuizPlan, saveQuizDraft } from './quiz-storage'

/**
 * O quiz como estado, separado do desenho.
 *
 * Cinco fases numa linha: intro → perguntas → processando → diagnóstico →
 * plano. As respostas ficam no `localStorage` a cada mudança (a página
 * atualizada volta na mesma pergunta) e vão pro servidor a cada avanço,
 * junto do evento do funil. O plano é calculado aqui, no navegador, pelo
 * mesmo gerador do onboarding: não existe chamada de rede entre a última
 * resposta e a prévia, e é por isso que o "processando" é curto.
 */

export const QUIZ_PATH = '/criar-meu-plano'

export const QUIZ_PHASES = ['intro', 'perguntas', 'processando', 'diagnostico', 'plano'] as const
export type QuizPhase = (typeof QUIZ_PHASES)[number]

/** O tempo da animação de processamento. Curto de propósito: o plano já está pronto. */
export const PROCESSING_MS = 2400

export interface QuizController {
  readonly phase: QuizPhase
  readonly step: number
  readonly answers: QuizAnswers
  readonly intro: QuizIntro
  readonly attribution: QuizAttribution
  /** Já respondeu alguma coisa: o botão da intro vira "continuar". */
  readonly started: boolean
  readonly blocker: string | null
  readonly canAdvance: boolean
  readonly diagnosis: QuizDiagnosis | null
  readonly preview: QuizPlanPreview | null
  set(changes: Partial<QuizAnswers>): void
  toggleWeekday(day: number): void
  start(): void
  next(): void
  back(): void
  /** Do diagnóstico pra prévia. */
  showPlan(): void
  /** Ajustar as respostas: volta pra primeira pergunta com tudo preenchido. */
  review(): void
  /** Ativar o plano: guarda o plano pendente; a tela navega pro cadastro. */
  activate(): void
}

export function useQuiz(): QuizController {
  const [params] = useSearchParams()
  const urlAttribution = useMemo(() => readAttribution(params), [params])

  const stored = useMemo(() => loadQuizDraft(), [])
  const [phase, setPhase] = useState<QuizPhase>('intro')
  const [step, setStep] = useState(stored?.step ?? 0)
  const [answers, setAnswers] = useState<QuizAnswers>(stored?.answers ?? EMPTY_QUIZ_ANSWERS)

  // A origem da URL vence a guardada: link novo é visita nova. Sem parâmetro
  // nenhum, a origem que trouxe a pessoa da primeira vez continua valendo.
  const attribution = useMemo<QuizAttribution>(
    () => (hasAttribution(urlAttribution) ? urlAttribution : (stored?.attribution ?? urlAttribution)),
    [urlAttribution, stored],
  )

  const intro = useMemo(() => quizIntro(attribution.theme), [attribution.theme])

  const today = useMemo(() => dayKeyOf(new Date()), [])

  const diagnosis = useMemo(
    () => (isQuizComplete(answers) ? buildDiagnosis(answers) : null),
    [answers],
  )

  const preview = useMemo(
    () => (isQuizComplete(answers) ? buildQuizPlan({ answers, today, existingAxes: [] }) : null),
    [answers, today],
  )

  // Uma visualização por montagem. Reabrir a aba conta de novo, e é isso mesmo.
  const viewedRef = useRef(false)
  useEffect(() => {
    if (viewedRef.current) return
    viewedRef.current = true
    startFreshQuizSession()
    trackFunnel('quiz_viewed', null, attribution)
  }, [attribution])

  useEffect(() => {
    if (!hasStarted(answers)) return
    saveQuizDraft({ step, answers, attribution })
  }, [step, answers, attribution])

  // Abandono: a página foi embora no meio das perguntas.
  const phaseRef = useRef(phase)
  const stepRef = useRef(step)
  phaseRef.current = phase
  stepRef.current = step
  useEffect(() => {
    const onLeave = () => {
      if (phaseRef.current === 'perguntas') trackFunnelOnLeave('quiz_abandoned', stepRef.current)
    }
    window.addEventListener('pagehide', onLeave)
    return () => window.removeEventListener('pagehide', onLeave)
  }, [])

  const blocker = useMemo(() => quizBlocker(step, answers), [step, answers])

  const set = useCallback((changes: Partial<QuizAnswers>) => {
    setAnswers((current) => ({ ...current, ...changes }))
  }, [])

  const toggleWeekday = useCallback((day: number) => {
    setAnswers((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((value) => value !== day)
        : [...current.weekdays, day],
    }))
  }, [])

  const start = useCallback(() => {
    trackFunnel('quiz_started', 0, attribution)
    setPhase('perguntas')
  }, [attribution])

  const finish = useCallback((final: QuizAnswers) => {
    trackFunnel('quiz_completed', QUIZ_QUESTION_COUNT)
    saveQuizAnswers(final, isQuizComplete(final) ? buildDiagnosis(final) : null, QUIZ_QUESTION_COUNT)
    setPhase('processando')
    window.setTimeout(() => {
      setPhase('diagnostico')
      trackFunnel('diagnosis_viewed', null)
    }, PROCESSING_MS)
  }, [])

  const next = useCallback(() => {
    if (blocker) return
    trackFunnel('quiz_question_answered', step)
    saveQuizAnswers(answers, null, step + 1)

    if (step >= QUIZ_QUESTION_COUNT - 1) {
      finish(answers)
      return
    }
    setStep(step + 1)
  }, [blocker, step, answers, finish])

  const back = useCallback(() => {
    if (step === 0) {
      setPhase('intro')
      return
    }
    setStep(step - 1)
  }, [step])

  const showPlan = useCallback(() => {
    setPhase('plano')
    trackFunnel('plan_preview_viewed', null)
  }, [])

  const review = useCallback(() => {
    setStep(0)
    setPhase('perguntas')
  }, [])

  const activate = useCallback(() => {
    if (!isQuizComplete(answers)) return
    savePendingQuizPlan({ answers, attribution })
    clearQuizDraft()
    trackFunnel('signup_started', null)
  }, [answers, attribution])

  return {
    phase,
    step,
    answers,
    intro,
    attribution,
    started: hasStarted(answers),
    blocker,
    canAdvance: blocker === null,
    diagnosis,
    preview,
    set,
    toggleWeekday,
    start,
    next,
    back,
    showPlan,
    review,
    activate,
  }
}

function hasStarted(answers: QuizAnswers): boolean {
  return answers.goal.trim().length > 0 || answers.area !== null
}
