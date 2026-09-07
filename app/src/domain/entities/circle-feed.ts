import type { JourneyEvent, JourneyEventType } from './journey-event'

/**
 * O feed do Círculo.
 *
 * A regra que define o produto está nesta lista: nem todo momento da jornada
 * vira assunto entre amigos. Hábito concluído e dia fechado ficam de fora de
 * propósito — cinco hábitos por dia vezes dez amigos são cinquenta linhas
 * diárias, e um feed que enche vira um feed que ninguém lê. O que entra é o que
 * uma pessoa contaria pra outra: fechei a rotina, avancei o objetivo, cheguei
 * num marco, revisei a semana, voltei depois de sumir.
 *
 * A mesma lista decide o que PODE ser compartilhado. Um momento que não
 * apareceria no feed também não deve oferecer o botão de compartilhar com o
 * círculo — senão a pessoa marca, não vê aparecer e conclui que quebrou.
 */

export const CIRCLE_FEED_TYPES: readonly JourneyEventType[] = [
  'routine_completed',
  'goal_progress',
  'goal_completed',
  'milestone',
  'weekly_review',
  'comeback',
]

export function belongsInCircle(type: JourneyEventType): boolean {
  return CIRCLE_FEED_TYPES.includes(type)
}

/** Quem publicou. É só o cartão de visita — nada do planejamento da pessoa. */
export interface CircleAuthor {
  readonly id: string
  readonly name: string
  readonly handle: string
  readonly avatarUrl: string | null
}

export interface CircleFeedItem {
  readonly event: JourneyEvent
  readonly author: CircleAuthor
  readonly supports: number
  readonly supportedByMe: boolean
}

/**
 * Ordena e filtra o que chega do repositório.
 *
 * A filtragem por tipo acontece aqui MESMO já vindo filtrada do banco: a regra
 * é de produto, não de consulta, e um dia a consulta vai mudar (paginação,
 * cache, outra fonte). Quando mudar, a regra continua sendo esta.
 */
export function circleFeed(items: readonly CircleFeedItem[]): CircleFeedItem[] {
  return items
    .filter((item) => belongsInCircle(item.event.type) && item.event.visibility === 'amigos')
    .sort((a, b) => timeOf(b.event) - timeOf(a.event))
}

function timeOf(event: JourneyEvent): number {
  return (event.completedAt ?? event.createdAt).getTime()
}

/**
 * A frase do card no feed.
 *
 * Escrita na terceira pessoa e sem número que a pessoa não tenha escolhido
 * mostrar. O título do evento já respeita a decisão de quem publicou; aqui só
 * entra o verbo.
 */
export function circleHeadline(event: JourneyEvent, firstName: string): string {
  switch (event.type) {
    case 'routine_completed':
      return `${firstName} fechou a rotina`
    case 'goal_progress':
      return `${firstName} avançou num objetivo`
    case 'goal_completed':
      return `${firstName} concluiu um objetivo`
    case 'milestone':
      return `${firstName} chegou num marco`
    case 'weekly_review':
      return `${firstName} fechou a semana`
    case 'comeback':
      return `${firstName} voltou ao ritmo`
    default:
      return `${firstName} avançou`
  }
}
