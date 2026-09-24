import type { FunnelEventName, QuizAttribution } from '@/domain/analytics/funnel-events'
import type { NormalizedLead } from '@/domain/entities/quiz-lead'
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

/**
 * Abre a sessão de um funil criado no painel.
 *
 * Cada funil tem a própria sessão: responder o quiz de carreira não pode
 * continuar de onde o de saúde parou, senão as respostas de um caem na
 * ficha do outro. O id fica guardado por slug.
 */
export function startCustomQuiz(slug: string, attribution: QuizAttribution | null): string {
  const chave = `momentumm.quiz.session.${slug}.v1`
  let sessao: string
  try {
    const guardada = window.localStorage.getItem(chave)
    sessao = guardada && isUuid(guardada) ? guardada : crypto.randomUUID()
    window.localStorage.setItem(chave, sessao)
  } catch {
    sessao = crypto.randomUUID()
  }

  if (!isDemoMode) {
    void supabase()
      .rpc('quiz_start', {
        p_session: sessao,
        p_slug: slug,
        p_attribution: attribution
          ? {
              utm_source: attribution.source,
              utm_medium: attribution.medium,
              utm_campaign: attribution.campaign,
              utm_content: attribution.content,
              theme: attribution.theme,
            }
          : {},
      })
      .then(() => undefined, () => undefined)
  }

  return sessao
}

/** Registra um passo de um funil do painel. */
export function trackCustomQuiz(session: string, name: FunnelEventName, step: number | null): void {
  if (isDemoMode) return
  void supabase()
    .rpc('quiz_track', { p_session: session, p_name: name, p_step: step, p_attribution: {} })
    .then(() => undefined, () => undefined)
}

/** Grava as respostas de um funil do painel. */
export function saveCustomQuizAnswers(session: string, answers: Record<string, unknown>, step: number): void {
  if (isDemoMode) return
  void supabase()
    .rpc('quiz_save', { p_session: session, p_answers: answers, p_diagnosis: null, p_step: step })
    .then(() => undefined, () => undefined)
}

/** O contato de um funil do painel. Aguardado, como o do funil principal. */
export async function saveCustomQuizLead(session: string, lead: NormalizedLead): Promise<boolean> {
  if (isDemoMode) return true
  try {
    const { error } = await supabase().rpc('quiz_save_lead', {
      p_session: session,
      p_name: lead.name,
      p_email: lead.email,
      p_phone: lead.phone,
      p_age: null,
    })
    if (error) throw error
    return true
  } catch {
    return false
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

const PENDING_LEAD_KEY = 'momentumm.quiz.lead.pending.v1'

/**
 * O contato de quem respondeu o quiz.
 *
 * Aguardado, ao contrário do resto deste arquivo: a pessoa está parada na
 * tela esperando, e um contato perdido em silêncio é exatamente o problema
 * que esta função existe pra resolver. Quando a rede falha, o contato fica
 * guardado no navegador e sobe na próxima oportunidade (`flushPendingLead`),
 * porque fazer a pessoa digitar tudo de novo é pior do que tentar outra vez.
 */
export async function saveQuizLead(lead: NormalizedLead): Promise<boolean> {
  if (isDemoMode) return true
  try {
    const { error } = await supabase().rpc('quiz_save_lead', {
      p_session: quizSessionId(),
      p_name: lead.name,
      p_email: lead.email,
      p_phone: lead.phone,
      // A coluna existe na 0039 e segue reservada: o quiz parou de pedir
      // idade porque ela não mudava nada no plano nem na conversa.
      p_age: null,
    })
    if (error) throw error
    clearPendingLead()
    return true
  } catch {
    rememberPendingLead(lead)
    return false
  }
}

/** Nova tentativa do contato que ficou pra trás. Silenciosa: ninguém espera por ela. */
export function flushPendingLead(): void {
  const pending = readPendingLead()
  if (!pending) return
  void saveQuizLead(pending)
}

function rememberPendingLead(lead: NormalizedLead): void {
  try {
    window.localStorage.setItem(PENDING_LEAD_KEY, JSON.stringify(lead))
  } catch {
    // Sem armazenamento, resta a tentativa que acabou de falhar.
  }
}

function readPendingLead(): NormalizedLead | null {
  try {
    const raw = window.localStorage.getItem(PENDING_LEAD_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const lead = parsed as Partial<NormalizedLead>
    if (typeof lead.name !== 'string' || typeof lead.email !== 'string') return null
    return {
      name: lead.name,
      email: lead.email,
      phone: typeof lead.phone === 'string' ? lead.phone : null,
    }
  } catch {
    return null
  }
}

function clearPendingLead(): void {
  try {
    window.localStorage.removeItem(PENDING_LEAD_KEY)
  } catch {
    // Nada a fazer.
  }
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
