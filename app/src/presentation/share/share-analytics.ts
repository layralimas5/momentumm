import type { JourneyEventType } from '@/domain/entities/journey-event'
import type { ShareFormat, ShareTemplateId } from '@/domain/share/share-card'

/**
 * Eventos internos do Share Studio.
 *
 * Ainda não existe destino: nenhum SDK de analytics entrou no bundle pra isso.
 * O que existe é o CONTRATO — nome do evento e formato do payload — e um ponto
 * único de saída. Quando a ferramenta chegar, ela se conecta em `onShareEvent`
 * e nenhuma tela muda.
 *
 * ## O que nunca entra aqui
 *
 * Título de objetivo, nome de hábito, nome da pessoa, nota, descrição. O payload
 * é fechado por tipo de propósito: um `Record<string, unknown>` viraria, na
 * primeira pressa, o lugar onde alguém manda `title` "só pra debugar" — e aí o
 * texto privado da pessoa está num servidor de terceiro.
 */

export const SHARE_ANALYTICS_EVENTS = [
  'share_studio_opened',
  'share_template_selected',
  'share_format_selected',
  'share_generated',
  'share_saved',
  'share_shared',
] as const

export type ShareAnalyticsEvent = (typeof SHARE_ANALYTICS_EVENTS)[number]

export interface ShareAnalyticsPayload {
  readonly activity_type: JourneyEventType
  readonly template: ShareTemplateId
  readonly format: ShareFormat
}

type Listener = (event: ShareAnalyticsEvent, payload: ShareAnalyticsPayload) => void

const listeners = new Set<Listener>()

export function onShareEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function trackShare(event: ShareAnalyticsEvent, payload: ShareAnalyticsPayload): void {
  for (const listener of listeners) {
    try {
      listener(event, payload)
    } catch {
      // Analytics jamais derruba a tela: o card precisa sair mesmo que a
      // instrumentação esteja quebrada.
    }
  }

  // Em desenvolvimento o evento aparece no console: é a única forma de conferir
  // que a instrumentação dispara antes de existir destino pra ela.
  if (import.meta.env.DEV) console.debug('[share]', event, payload)
}
