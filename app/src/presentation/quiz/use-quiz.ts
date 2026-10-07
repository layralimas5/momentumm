import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  hasAttribution,
  readAttribution,
  type QuizAttribution,
} from '@/domain/analytics/funnel-events'
import { attributionForCode, readQuizChannel } from '@/domain/analytics/quiz-links'
import { dayKeyOf } from '@/domain/entities/day'
import {
  buildDiagnosis,
  buildQuizPlan,
  EMPTY_QUIZ_ANSWERS,
  isQuizComplete,
  QUIZ_SCREEN_COUNT,
  quizBlocker,
  quizAreaContext,
  quizIntro,
  type QuizAnswers,
  type QuizAreaKey,
  type QuizObstacleKey,
  type QuizIntro,
  type QuizPlanPreview,
} from '@/domain/entities/quiz'
import { buildQuizStrategy, type QuizStrategy } from '@/domain/entities/quiz-strategy'
import {
  EMPTY_QUIZ_LEAD,
  isLeadReady,
  leadErrors,
  normalizeLead,
  type LeadErrors,
  type QuizLead,
} from '@/domain/entities/quiz-lead'
import {
  flushPendingLead,
  saveQuizAnswers,
  saveQuizLead,
  startFreshQuizSession,
  trackFunnel,
  trackFunnelOnLeave,
} from '@/infrastructure/analytics/funnel'
import { clearQuizDraft, loadQuizDraft, savePendingQuizPlan, saveQuizDraft } from './quiz-storage'

/**
 * O quiz como estado, separado do desenho.
 *
 * Quatro fases numa linha: perguntas → processando → contato → resultado.
 *
 * Não há tela de intro: a primeira pergunta É a abertura, com o título da
 * campanha em cima, porque o primeiro clique barato é responder, não apertar
 * "começar". A análise vem antes do contato e o contato antes do resultado:
 * com o plano calculado e prometido, deixar o e-mail vira o caminho pra ver
 * o resultado, e é o único ponto do funil onde dá pra alcançar quem não vai
 * criar conta hoje. O resultado junta diagnóstico, plano e oferta numa tela
 * só: resultado e oferta separados viram duas conversas.
 *
 * As respostas ficam no `localStorage` a cada mudança (a página atualizada
 * volta na mesma tela) e vão pro servidor a cada avanço, junto do evento do
 * funil. O plano é calculado aqui, no navegador, pelo mesmo gerador do
 * onboarding: não existe chamada de rede entre a última resposta e a prévia,
 * e é por isso que a análise é curta.
 */

export const QUIZ_PATH = '/criar-meu-plano'

export const QUIZ_PHASES = ['perguntas', 'processando', 'contato', 'resultado'] as const
export type QuizPhase = (typeof QUIZ_PHASES)[number]

/** O tempo da animação de processamento. Curto de propósito: o plano já está pronto. */
export const PROCESSING_MS = 2400

export interface QuizController {
  readonly phase: QuizPhase
  readonly step: number
  readonly answers: QuizAnswers
  readonly intro: QuizIntro
  readonly attribution: QuizAttribution
  /** O que falta responder pra sair da pergunta. Null quando dá pra avançar. */
  readonly blocker: string | null
  /**
   * O mesmo `blocker`, mas só depois que a pessoa tentou avançar. A tela
   * mostra este, nunca o outro: cobrar resposta numa pergunta recém-aberta
   * parece erro de quem acabou de chegar.
   */
  readonly warning: string | null
  readonly canAdvance: boolean
  readonly preview: QuizPlanPreview | null
  /** O que entendemos sobre a pessoa e como o app vai agir, tirado das respostas. */
  readonly strategy: QuizStrategy | null
  readonly lead: QuizLead
  /** Os erros do contato, só depois que a pessoa tentou enviar. */
  readonly leadWarnings: LeadErrors
  readonly savingLead: boolean
  set(changes: Partial<QuizAnswers>): void
  /** Marca ou desmarca. A ordem do toque é a ordem de importância. */
  toggleArea(area: QuizAreaKey): void
  toggleObstacle(obstacle: QuizObstacleKey): void
  toggleWeekday(day: number): void
  next(): void
  back(): void
  setLead(changes: Partial<QuizLead>): void
  /** Guarda o contato e mostra o resultado. */
  submitLead(): void
  /** Ajustar as respostas: volta pra primeira pergunta com tudo preenchido. */
  review(): void
  /** Ativar o plano: guarda o plano pendente; a tela navega pro cadastro. */
  activate(): void
}

export function useQuiz(): QuizController {
  const [params] = useSearchParams()
  // `/plano/ig-proc` traz a origem inteira num código; `utm_*` continua
  // valendo pro que já foi enviado e pro que vier de anúncio.
  const { codigo } = useParams<{ codigo?: string }>()
  const urlAttribution = useMemo(() => {
    const fromCode = attributionForCode(codigo, readQuizChannel(params))
    return fromCode ?? readAttribution(params)
  }, [codigo, params])

  const stored = useMemo(() => loadQuizDraft(), [])
  const [phase, setPhase] = useState<QuizPhase>('perguntas')
  const [lead, setLeadState] = useState<QuizLead>(EMPTY_QUIZ_LEAD)
  const [leadAttempted, setLeadAttempted] = useState(false)
  const [savingLead, setSavingLead] = useState(false)
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

  const preview = useMemo(
    () => (isQuizComplete(answers) ? buildQuizPlan({ answers, today, existingAxes: [] }) : null),
    [answers, today],
  )

  const strategy = useMemo(
    () =>
      preview && isQuizComplete(answers)
        ? buildQuizStrategy({ answers, preview, area: quizAreaContext(answers), today })
        : null,
    [answers, preview, today],
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

  // Zera a cada pergunta nova e a cada resposta: o aviso some assim que a
  // pessoa mexe em alguma coisa, sem esperar ela tentar avançar de novo.
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    setAttempted(false)
  }, [step, answers])

  const set = useCallback((changes: Partial<QuizAnswers>) => {
    setAnswers((current) => ({ ...current, ...changes }))
  }, [])

  const toggleArea = useCallback((area: QuizAreaKey) => {
    setAnswers((current) => ({ ...current, areas: toggled(current.areas, area) }))
  }, [])

  const toggleObstacle = useCallback((obstacle: QuizObstacleKey) => {
    setAnswers((current) => ({ ...current, obstacles: toggled(current.obstacles, obstacle) }))
  }, [])

  const toggleWeekday = useCallback((day: number) => {
    setAnswers((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((value) => value !== day)
        : [...current.weekdays, day],
    }))
  }, [])

  /** A análise: o plano já está pronto, a espera é só pra ler as etapas. */
  const analyze = useCallback(() => {
    setPhase('processando')
    window.setTimeout(() => setPhase('contato'), PROCESSING_MS)
  }, [])

  const next = useCallback(() => {
    if (blocker) {
      setAttempted(true)
      return
    }
    // Sem intro, começar é responder a abertura.
    if (step === 0) trackFunnel('quiz_started', 0, attribution)
    trackFunnel('quiz_question_answered', step)
    saveQuizAnswers(answers, null, step + 1)

    if (step >= QUIZ_SCREEN_COUNT - 1) {
      trackFunnel('quiz_completed', QUIZ_SCREEN_COUNT)
      saveQuizAnswers(answers, isQuizComplete(answers) ? buildDiagnosis(answers) : null, QUIZ_SCREEN_COUNT)
      analyze()
      return
    }
    setStep(step + 1)
  }, [blocker, step, answers, attribution, analyze])

  const back = useCallback(() => {
    if (phase === 'contato') {
      setPhase('perguntas')
      return
    }
    if (step > 0) setStep(step - 1)
  }, [phase, step])

  const showResult = useCallback(() => {
    flushPendingLead()
    setPhase('resultado')
    // Diagnóstico e prévia agora são a mesma tela: os dois eventos saem juntos.
    trackFunnel('diagnosis_viewed', null)
    trackFunnel('plan_preview_viewed', null)
  }, [])

  const setLead = useCallback((changes: Partial<QuizLead>) => {
    setLeadState((current) => ({ ...current, ...changes }))
    setLeadAttempted(false)
  }, [])

  /*
    O contato é aguardado, mas nunca é barreira: rede caída não pode segurar
    o plano de quem respondeu sete perguntas. A gravação guarda o que falhou
    pra tentar de novo sozinha, e a tela segue em frente.
  */
  const submitLead = useCallback(() => {
    if (!isLeadReady(lead)) {
      setLeadAttempted(true)
      return
    }
    setSavingLead(true)
    void saveQuizLead(normalizeLead(lead)).then((saved) => {
      setSavingLead(false)
      if (saved) trackFunnel('lead_captured', QUIZ_SCREEN_COUNT)
      showResult()
    })
  }, [lead, showResult])

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
    blocker,
    warning: attempted ? blocker : null,
    canAdvance: blocker === null,
    preview,
    strategy,
    lead,
    leadWarnings: leadAttempted ? leadErrors(lead) : {},
    savingLead,
    set,
    toggleArea,
    toggleObstacle,
    toggleWeekday,
    next,
    back,
    setLead,
    submitLead,
    review,
    activate,
  }
}

function hasStarted(answers: QuizAnswers): boolean {
  return answers.goal.trim().length > 0 || answers.areas.length > 0
}

/** Mantém a ordem do toque: desmarcar tira, marcar vai pro fim. */
function toggled<T>(list: readonly T[], item: T): readonly T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}
