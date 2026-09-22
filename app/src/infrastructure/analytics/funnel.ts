import type { FunnelEventName, QuizAttribution } from '@/domain/analytics/funnel-events'
import type { QuizAnswers, QuizDiagnosis } from '@/domain/entities/quiz'
import { isDemoMode, supabaseConfig } from '@/infrastructure/config/env'
import { supabase } from '@/infrastructure/supabase/client'

/**
 * O funil do quiz, do lado do navegador.
 *
 * Mesma filosofia do `track`: dispara e esquece, nunca quebra a tela. A
 * diferença é que aqui não existe `auth.uid()` na maior parte do caminho, e
 * a chave é a sessão do quiz (`quiz_sessions.id`), um uuid gerado aqui e
 * guardado no `localStorage` até o plano ser ativado.
 */

const SESSION_KEY = 'momentumm.quiz.session.v1'
const LINKED_KEY = 'momentumm.quiz.session.linked.v1'

export function quizSessionId(): string {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (stored && isUuid(stored)) return stored
    const created = crypto.randomUUID()
    window.localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    // Sem armazenamento a sessão vale só até o próximo reload.
    return crypto.randomUUID()
  }
}

/**
 * A sessão já pertence a uma conta? Depois do vínculo ela fica no navegador
 * pra os eventos seguintes (primeira ação, checkout, assinatura) chegarem na
 * mesma linha do funil. Um visitante novo no mesmo navegador não pode
 * herdar essa sessão: o quiz abre uma nova (`startFreshQuizSession`).
 */
export function isQuizSessionLinked(): boolean {
  try {
    return window.localStorage.getItem(LINKED_KEY) === 'true'
  } catch {
    return false
  }
}

function markQuizSessionLinked(): void {
  try {
    window.localStorage.setItem(LINKED_KEY, 'true')
  } catch {
    // Nada a fazer.
  }
}

/** Ao abrir o quiz: sessão de outra conta é descartada, nova visita é nova sessão. */
export function startFreshQuizSession(): void {
  if (!isQuizSessionLinked()) return
  try {
    window.localStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(LINKED_KEY)
  } catch {
    // Nada a fazer.
  }
}

export function trackFunnel(
  name: FunnelEventName,
  step: number | null = null,
  attribution: QuizAttribution | null = null,
): void {
  if (isDemoMode) return
  const payload = attribution
    ? {
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content,
        theme: attribution.theme,
      }
    : {}
  void supabase()
    .rpc('quiz_track', {
      p_session: quizSessionId(),
      p_name: name,
      p_step: step,
      p_attribution: payload,
    })
    .then(() => undefined, () => undefined)
}

export function saveQuizAnswers(
  answers: QuizAnswers,
  diagnosis: QuizDiagnosis | null,
  step: number | null,
): void {
  if (isDemoMode) return
  void supabase()
    .rpc('quiz_save', {
      p_session: quizSessionId(),
      p_answers: answers,
      p_diagnosis: diagnosis,
      p_step: step,
    })
    .then(() => undefined, () => undefined)
}

/** Depois do cadastro. Aguardado de propósito: o vínculo precisa existir antes do `plan_activated`. */
export async function linkQuizSessionToMe(): Promise<void> {
  markQuizSessionLinked()
  if (isDemoMode) return
  try {
    await supabase().rpc('quiz_link_to_me', { p_session: quizSessionId() })
  } catch {
    // O plano é gravado do mesmo jeito; só o funil perde o vínculo.
  }
}

/**
 * Evento de quem já passou pelo quiz e criou a conta. Sem sessão vinculada
 * no navegador não grava nada: quem chegou pela landing não entra no funil
 * do quiz, e criar uma sessão só pra isso inflaria "visitas" com gente que
 * nunca viu o quiz.
 */
export function trackFunnelIfLinked(name: FunnelEventName): void {
  if (!isQuizSessionLinked()) return
  trackFunnel(name, null)
}

export async function markQuizActivated(): Promise<void> {
  if (isDemoMode) return
  try {
    await supabase().rpc('quiz_mark_activated', { p_session: quizSessionId() })
  } catch {
    // Idem.
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * O abandono é registrado no `pagehide`, quando o navegador já está indo
 * embora: uma chamada normal seria cancelada no meio. `keepalive` deixa a
 * requisição terminar depois da página. Sem cabeçalho de sessão de
 * propósito: antes do cadastro a sessão do quiz não tem dono, e o portador
 * é o id dela.
 */
export function trackFunnelOnLeave(name: FunnelEventName, step: number | null): void {
  if (isDemoMode || !supabaseConfig) return
  try {
    void fetch(`${supabaseConfig.url}/rest/v1/rpc/quiz_track`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'content-type': 'application/json',
        apikey: supabaseConfig.anonKey,
        authorization: `Bearer ${supabaseConfig.anonKey}`,
      },
      body: JSON.stringify({ p_session: quizSessionId(), p_name: name, p_step: step, p_attribution: {} }),
    }).catch(() => undefined)
  } catch {
    // Analytics nunca quebra a saída da página.
  }
}
