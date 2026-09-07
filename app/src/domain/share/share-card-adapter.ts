import { activityType } from '@/domain/entities/activity-type'
import { formatDayLong, type DayKey } from '@/domain/entities/day'
import type { JourneyEvent, JourneyEventType } from '@/domain/entities/journey-event'
import {
  sanitizeFields,
  type ShareCardData,
  type ShareCardItem,
  type ShareFieldSet,
  type ShareMetric,
} from './share-card'

/**
 * `JourneyEvent` → `ShareCardData`.
 *
 * Este é o único lugar do app que decide o que um evento vira dentro de uma
 * imagem. Os templates desenham o que sai daqui e nada além — se um deles
 * precisar consultar o evento original, a separação quebrou.
 *
 * A regra que manda: campo desligado não vira texto neutro nem placeholder,
 * ele simplesmente não existe no resultado. Card que mostra "Objetivo oculto"
 * denuncia que havia algo escondido, o que é o oposto de privacidade.
 */

export interface ShareCardOptions {
  readonly fields: ShareFieldSet
  /** Nome curto de quem compartilha. Só entra se o toggle estiver ligado. */
  readonly displayName: string | null
  readonly today: DayKey
}

export function toShareCardData(event: JourneyEvent, options: ShareCardOptions): ShareCardData {
  const fields = sanitizeFields(event.type, options.fields)
  const accent = event.metadata.axis
    ? activityType(event.metadata.axis).colorToken
    : 'var(--color-brand)'

  const showsTitle = titleIsSensitive(event.type) ? fields.objective : true

  return {
    eventType: event.type,
    kicker: kickerOf(event),
    title: titleOf(event, showsTitle),
    subtitle: subtitleOf(event),
    primaryMetric: primaryMetricOf(event, fields),
    secondaryMetric: secondaryMetricOf(event, fields),
    momentumBefore: fields.momentum ? event.momentumBefore : null,
    momentumAfter: fields.momentum ? event.momentumAfter : null,
    momentumChange: fields.momentum ? event.momentumChange : null,
    completionPercentage: fields.completion ? event.completionPercentage : null,
    items: fields.items ? itemsOf(event) : [],
    date: fields.date ? formatDayLong(event.day, options.today) : null,
    username: fields.username ? (options.displayName?.trim() || null) : null,
    branding: fields.branding,
    note: fields.note ? noteOf(event) : null,
    accent,
  }
}

/**
 * O título do card.
 *
 * Marco e retomada não têm título: neles a informação inteira já está no
 * kicker, no número e no subtítulo. Repetir "50 treinos concluídos" acima de um
 * "50 / treinos concluídos" gigante é a forma mais rápida de um card premium
 * virar slide de PowerPoint.
 */
function titleOf(event: JourneyEvent, showsTitle: boolean): string {
  if (event.type === 'milestone' || event.type === 'comeback') return ''
  // O momentum já se apresenta no kicker ("Novo momentum") e no número. Um
  // título "Meu momentum" acima disso seria a terceira vez que a mesma palavra
  // aparece no mesmo card.
  if (event.type === 'momentum_record') return ''
  return showsTitle ? event.title : neutralTitleOf(event.type)
}

/**
 * Tipos em que o título é escrito pela pessoa.
 *
 * "Lançar meu SaaS" é dela; "Minha semana" é do app. Só os primeiros dependem
 * do toggle — travar os dois atrás do mesmo botão faria o card do dia começar
 * sem título nenhum.
 */
function titleIsSensitive(type: JourneyEventType): boolean {
  return (
    type === 'goal_progress' ||
    type === 'goal_completed' ||
    type === 'habit_completed' ||
    // O nome do desafio também é escrito por gente: "Parar de fumar em 30
    // dias" conta uma história que a pessoa pode não querer no Stories.
    type === 'challenge_joined' ||
    type === 'challenge_progress' ||
    type === 'challenge_milestone' ||
    type === 'challenge_completed'
  )
}

function neutralTitleOf(type: JourneyEventType): string {
  switch (type) {
    case 'goal_completed':
      return 'Um objetivo fechado'
    case 'goal_progress':
      return 'Um objetivo em andamento'
    case 'challenge_completed':
      return 'Um desafio fechado'
    case 'challenge_joined':
    case 'challenge_progress':
    case 'challenge_milestone':
      return 'Um desafio em andamento'
    default:
      return 'Mais um passo'
  }
}

function kickerOf(event: JourneyEvent): string | null {
  switch (event.type) {
    case 'goal_completed':
      return 'Objetivo concluído'
    case 'momentum_record':
      return 'Novo momentum'
    case 'comeback':
      return 'De volta ao ritmo'
    case 'milestone':
      return 'Marco'
    case 'weekly_review':
      return 'Resumo da semana'
    case 'routine_completed':
      return 'Rotina concluída'
    case 'challenge_joined':
      return 'Desafio aceito'
    case 'challenge_progress':
      return 'Desafio em andamento'
    case 'challenge_milestone':
      return 'Marco do desafio'
    case 'challenge_completed':
      return 'Desafio concluído'
    default:
      return null
  }
}

/**
 * A métrica dominante de cada tipo.
 *
 * Um card tem UMA estrela. Dia e objetivo mostram percentual, momentum mostra
 * o score, rotina mostra a fração, marco mostra a contagem. Quando o campo que
 * seria a estrela está desligado, o próximo número honesto assume — o card
 * nunca fica com um buraco no meio.
 */
function primaryMetricOf(event: JourneyEvent, fields: ShareFieldSet): ShareMetric {
  const percent = percentOf(event.completionPercentage ?? event.progressAfter)

  switch (event.type) {
    case 'momentum_record':
      return { value: `${event.momentumAfter ?? 0}`, label: 'de 100' }

    case 'milestone':
      return {
        value: `${event.metadata.milestoneCount ?? 0}`,
        label: event.metadata.milestoneUnit ?? null,
      }

    case 'routine_completed': {
      const items = event.metadata.items ?? []
      const done = items.filter((item) => item.done).length
      if (items.length > 0) return { value: `${done}/${items.length}`, label: 'concluídas' }
      return fallbackMetric(event, fields, percent)
    }

    /*
      A retomada mostra a FRASE em tamanho grande, não a contagem de dias
      parados. Um "4" gigante num card de retomada transforma o retorno num
      relatório da ausência — exatamente o oposto do que o produto quer que a
      pessoa sinta ao voltar.
    */
    case 'comeback':
      return { value: 'Você voltou', label: null }

    /*
      O desafio mostra DIAS, não porcentagem.

      "14/20 dias" é o número que as duas pessoas combinaram entre si; "70%" é
      a tradução dele pra uma escala que ninguém acordou pra cumprir. Sem os
      dois lados da fração o card cai no percentual, que continua sendo verdade.
    */
    case 'challenge_progress':
    case 'challenge_milestone':
    case 'challenge_completed': {
      const done = event.metadata.challengeDoneDays
      const required = event.metadata.challengeRequiredDays
      if (fields.completion && done !== undefined && required) {
        return { value: `${done}/${required}`, label: 'dias' }
      }
      return fallbackMetric(event, fields, percent)
    }

    /*
      Entrar num desafio ainda não tem número, e inventar um "0/20" gigante
      seria abrir a participação anunciando o que falta.
    */
    case 'challenge_joined':
      return { value: 'Topei', label: null }

    case 'goal_progress':
    case 'goal_completed':
    case 'day_completed':
    case 'weekly_review':
    case 'habit_completed':
      return fallbackMetric(event, fields, percent)
  }
}

function fallbackMetric(
  event: JourneyEvent,
  fields: ShareFieldSet,
  percent: string | null,
): ShareMetric {
  if (fields.completion && percent) {
    return { value: percent, label: labelForPercent(event.type) }
  }
  if (fields.momentum && event.momentumAfter !== null) {
    return { value: `${event.momentumAfter}`, label: 'Momentum' }
  }
  if (fields.duration && event.durationMin) {
    return { value: formatMinutes(event.durationMin), label: 'de foco' }
  }
  // Sem nenhum número liberado o card ainda precisa ter uma estrela: o título
  // vira o elemento dominante e a métrica sai de cena.
  return { value: '', label: null }
}

function labelForPercent(type: JourneyEventType): string {
  switch (type) {
    case 'weekly_review':
      return 'de execução'
    case 'goal_progress':
    case 'goal_completed':
      return 'do objetivo'
    case 'challenge_progress':
    case 'challenge_milestone':
    case 'challenge_completed':
      return 'do desafio'
    default:
      return 'concluído'
  }
}

function secondaryMetricOf(event: JourneyEvent, fields: ShareFieldSet): ShareMetric | null {
  switch (event.type) {
    case 'day_completed': {
      const items = event.metadata.items ?? []
      if (items.length === 0) return null
      const done = items.filter((item) => item.done).length
      return { value: `${done} de ${items.length}`, label: 'ações realizadas' }
    }

    case 'weekly_review': {
      const parts: string[] = []
      if (event.metadata.habitsDone) parts.push(`${event.metadata.habitsDone} hábitos concluídos`)
      if (fields.duration && event.metadata.focusMinutes) {
        parts.push(`${formatMinutes(event.metadata.focusMinutes)} de foco`)
      }
      return parts.length > 0 ? { value: parts.join(' · '), label: null } : null
    }

    case 'goal_progress': {
      const gain = event.metadata.gainPercentage
      if (!fields.completion || !gain || gain <= 0) return null
      return { value: `+${Math.round(gain)}%`, label: 'nesta semana' }
    }

    case 'momentum_record': {
      if (event.momentumChange === null || event.momentumChange === 0) return null
      const sign = event.momentumChange > 0 ? '+' : '−'
      return {
        value: `${sign}${Math.abs(event.momentumChange)}`,
        label: 'nesta semana',
      }
    }

    case 'habit_completed':
      return fields.duration && event.durationMin
        ? { value: formatMinutes(event.durationMin), label: null }
        : null

    // Quantas pessoas estão dentro, nunca quem. O desafio é privado e o card
    // não pode ser a porta que apresenta os participantes a quem não foi
    // convidado.
    case 'challenge_joined':
    case 'challenge_progress':
    case 'challenge_milestone':
    case 'challenge_completed': {
      const people = event.metadata.challengePeople
      if (!people || people < 2) return null
      return { value: `${people} pessoas no desafio`, label: null }
    }

    case 'routine_completed':
    case 'goal_completed':
    case 'milestone':
    case 'comeback':
      return null
  }
}

function subtitleOf(event: JourneyEvent): string | null {
  if (event.type !== 'comeback') return null
  const away = event.metadata.daysAway
  return away ? `Depois de ${away} ${away === 1 ? 'dia' : 'dias'} parada, voltei hoje.` : null
}

function itemsOf(event: JourneyEvent): readonly ShareCardItem[] {
  return (event.metadata.items ?? []).map((item) => ({ label: item.label, done: item.done }))
}

/**
 * A frase do rodapé.
 *
 * Determinística, como o resto do produto: a mesma situação escreve sempre a
 * mesma coisa. Nada de "Parabéns!" — o card fala de continuidade, que é o que
 * o Momentumm defende, e nunca de mérito.
 */
function noteOf(event: JourneyEvent): string | null {
  switch (event.type) {
    case 'day_completed':
      return (event.completionPercentage ?? 0) >= 1
        ? 'Mais um dia construído.'
        : 'Você avançou hoje.'
    case 'routine_completed':
      return 'Consistência > perfeição.'
    case 'goal_progress':
      return 'Seu ritmo está crescendo.'
    case 'goal_completed':
      return 'Terminado é melhor que perfeito.'
    case 'weekly_review':
      return 'Seu progresso desta semana.'
    case 'momentum_record':
      return (event.momentumChange ?? 0) > 0 ? 'Seu ritmo está crescendo.' : 'Constância antes de volume.'
    case 'comeback':
      return 'Continue de onde parou.'
    case 'milestone':
      return 'Um passo de cada vez, até virar isso.'
    case 'habit_completed':
      return 'Mais um dia construído.'
    case 'challenge_joined':
      return 'Combinado é combinado.'
    case 'challenge_progress':
      return 'Um dia de cada vez, junto.'
    case 'challenge_milestone':
      return 'Metade do caminho também é caminho.'
    case 'challenge_completed':
      return 'Fechado do começo ao fim.'
  }
}

function percentOf(ratio: number | null): string | null {
  if (ratio === null) return null
  return `${Math.round(ratio * 100)}%`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${`${rest}`.padStart(2, '0')}`
}
