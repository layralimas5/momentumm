import type { ActivityTypeSlug } from './activity-type'
import type { DayKey } from './day'
import type { JourneyEvent, JourneyItem, NewJourneyEventInput } from './journey-event'
import type { Milestone } from './milestone'

/**
 * O que da jornada de hoje merece virar registro.
 *
 * Uma função pura, e é isso que a torna confiável: ela recebe o estado do dia
 * mais os eventos JÁ gravados e devolve só o que falta gravar. Nenhuma escrita,
 * nenhum efeito, nenhum acesso a repositório — dá pra provar em teste que "dia
 * concluído" aparece uma vez, e não uma vez por render.
 *
 * ## As duas chaves de repetição
 *
 * Evento de DIA (hábito, rotina, dia fechado, retomada, momentum) repete a cada
 * dia novo: a chave inclui a data. Evento de VIDA (marco, objetivo cruzando uma
 * faixa) acontece uma vez só: a chave ignora a data, senão "100 hábitos
 * concluídos" seria gravado de novo toda vez que a pessoa abrisse o app no dia
 * seguinte.
 *
 * ## O que NÃO passa por aqui
 *
 * Objetivo concluído e review fechado são gravados na hora em que a pessoa
 * clica, dentro do `PlannerProvider`. São transições com hora marcada; deixá-las
 * pro próximo carregamento do dashboard carimbaria o horário errado no que um
 * dia vai ser o feed.
 */

export interface RecorderInput {
  readonly today: DayKey
  /** Score de hoje e a variação contra os sete dias anteriores. */
  readonly momentum: { readonly value: number; readonly delta: number }
  /** Hábitos programados pra hoje, com o estado de cada um. */
  readonly habits: readonly RecorderHabit[]
  readonly dayComplete: boolean
  readonly dayDone: number
  readonly dayTotal: number
  /** As linhas do dia (ações e hábitos), pro card do dia ter o que listar. */
  readonly dayItems: readonly JourneyItem[]
  readonly focusMinutesToday: number
  /** Dias parados imediatamente antes de hoje. Zero quando ontem teve movimento. */
  readonly daysAway: number
  readonly objectives: readonly RecorderObjective[]
  readonly milestones: readonly Milestone[]
  /** Tudo que já foi gravado. É o que impede a segunda gravação. */
  readonly existing: readonly JourneyEvent[]
}

export interface RecorderHabit {
  readonly id: string
  readonly name: string
  readonly axis: ActivityTypeSlug
  readonly dayPart: string
  readonly done: boolean
}

export interface RecorderObjective {
  readonly id: string
  readonly title: string
  readonly axis: ActivityTypeSlug
  /** 0 a 1: a mesma porcentagem que a tela do objetivo mostra. */
  readonly ratio: number
}

export type RecordableEvent = Omit<NewJourneyEventInput, 'userId'>

/** Faixas de progresso que valem registro. Passar de 74% pra 75% não é notícia. */
const OBJECTIVE_MARKS = [0.25, 0.5, 0.75] as const

/** Dias parados a partir dos quais voltar é retomada, e não um dia comum. */
const GAP_FOR_COMEBACK = 2

/** Piso do momentum pra "novo momentum" significar alguma coisa. */
const MOMENTUM_FLOOR = 40

/** Quanto o score precisa subir acima do recorde anterior pra virar registro. */
const MOMENTUM_STEP = 3

export function eventsToRecord(input: RecorderInput): RecordableEvent[] {
  const events: RecordableEvent[] = []
  const seenToday = dayKeys(input.existing, input.today)
  const seenEver = lifeKeys(input.existing)

  const push = (event: RecordableEvent, key: string, perDay: boolean): void => {
    if (perDay ? seenToday.has(key) : seenEver.has(key)) return
    events.push(event)
    ;(perDay ? seenToday : seenEver).add(key)
  }

  // ---- hábitos -----------------------------------------------------------
  for (const habit of input.habits) {
    if (!habit.done) continue
    push(
      {
        type: 'habit_completed',
        sourceType: 'habit',
        sourceId: habit.id,
        title: habit.name,
        completionPercentage: 1,
        metadata: { axis: habit.axis },
        ...momentumOf(input),
      },
      key('habit_completed', habit.id),
      true,
    )
  }

  // ---- rotina ------------------------------------------------------------
  for (const [dayPart, group] of groupByDayPart(input.habits)) {
    // Menos de dois hábitos não é rotina, é hábito: "1/1 concluída" não conta
    // uma história diferente da que a linha do próprio hábito já contou.
    if (group.length < 2 || !group.every((habit) => habit.done)) continue

    const sourceId = `${input.today}:${dayPart}`
    push(
      {
        type: 'routine_completed',
        sourceType: 'routine',
        sourceId,
        title: routineTitleOf(dayPart),
        completionPercentage: 1,
        metadata: {
          items: group.map((habit) => ({ label: habit.name, done: true })),
          habitsDone: group.length,
        },
        ...momentumOf(input),
      },
      key('routine_completed', sourceId),
      true,
    )
  }

  // ---- dia ---------------------------------------------------------------
  if (input.dayComplete) {
    push(
      {
        type: 'day_completed',
        sourceType: 'day',
        sourceId: input.today,
        title: 'Hoje',
        completionPercentage: input.dayTotal === 0 ? 0 : input.dayDone / input.dayTotal,
        durationMin: input.focusMinutesToday || null,
        metadata: {
          items: input.dayItems,
          tasksDone: input.dayDone,
          ...(input.focusMinutesToday > 0 ? { focusMinutes: input.focusMinutesToday } : {}),
        },
        ...momentumOf(input),
      },
      key('day_completed', input.today),
      true,
    )
  }

  // ---- retomada ----------------------------------------------------------
  if (input.daysAway >= GAP_FOR_COMEBACK && input.dayDone > 0) {
    push(
      {
        type: 'comeback',
        sourceType: 'streak',
        sourceId: input.today,
        title: 'Voltei hoje',
        metadata: { daysAway: input.daysAway },
        ...momentumOf(input),
      },
      key('comeback', input.today),
      true,
    )
  }

  // ---- momentum ----------------------------------------------------------
  if (isNewMomentumRecord(input)) {
    push(
      {
        type: 'momentum_record',
        sourceType: 'momentum',
        sourceId: input.today,
        title: 'Meu momentum',
        ...momentumOf(input),
      },
      key('momentum_record', input.today),
      true,
    )
  }

  // ---- objetivo cruzando uma faixa --------------------------------------
  for (const objective of input.objectives) {
    const mark = highestMarkReached(objective.ratio)
    if (mark === null) continue

    const sourceId = `${objective.id}:${Math.round(mark * 100)}`
    push(
      {
        type: 'goal_progress',
        sourceType: 'objective',
        sourceId,
        title: objective.title,
        completionPercentage: objective.ratio,
        progressAfter: objective.ratio,
        metadata: { axis: objective.axis },
        ...momentumOf(input),
      },
      key('goal_progress', sourceId),
      false,
    )
  }

  // ---- marcos ------------------------------------------------------------
  for (const milestone of input.milestones) {
    push(
      {
        type: 'milestone',
        sourceType: 'streak',
        sourceId: milestone.id,
        title: milestone.label,
        metadata: { milestoneCount: milestone.count, milestoneUnit: milestone.unit },
        ...momentumOf(input),
      },
      key('milestone', milestone.id),
      false,
    )
  }

  return events
}

function momentumOf(input: RecorderInput): {
  momentumBefore: number
  momentumAfter: number
} {
  return {
    momentumBefore: input.momentum.value - input.momentum.delta,
    momentumAfter: input.momentum.value,
  }
}

function key(type: string, sourceId: string): string {
  return `${type}:${sourceId}`
}

/** Chaves gravadas HOJE: o que se repete a cada dia novo. */
function dayKeys(existing: readonly JourneyEvent[], today: DayKey): Set<string> {
  const keys = new Set<string>()
  for (const event of existing) {
    if (event.day === today && event.sourceId) keys.add(key(event.type, event.sourceId))
  }
  return keys
}

/** Chaves gravadas em qualquer dia: o que acontece uma vez na vida da conta. */
function lifeKeys(existing: readonly JourneyEvent[]): Set<string> {
  const keys = new Set<string>()
  for (const event of existing) {
    if (event.sourceId) keys.add(key(event.type, event.sourceId))
  }
  return keys
}

function groupByDayPart(habits: readonly RecorderHabit[]): Map<string, RecorderHabit[]> {
  const groups = new Map<string, RecorderHabit[]>()
  for (const habit of habits) {
    const bucket = groups.get(habit.dayPart)
    if (bucket) bucket.push(habit)
    else groups.set(habit.dayPart, [habit])
  }
  return groups
}

const DAY_PART_TITLES: Readonly<Record<string, string>> = {
  manha: 'Rotina da manhã',
  tarde: 'Rotina da tarde',
  noite: 'Rotina da noite',
  qualquer: 'Minha rotina',
}

function routineTitleOf(dayPart: string): string {
  return DAY_PART_TITLES[dayPart] ?? 'Minha rotina'
}

function highestMarkReached(ratio: number): number | null {
  let reached: number | null = null
  for (const mark of OBJECTIVE_MARKS) {
    if (ratio >= mark) reached = mark
  }
  return reached
}

/**
 * O score de hoje é um recorde que vale contar?
 *
 * Precisa bater o melhor já registrado por uma margem, e precisa passar de um
 * piso. Sem a margem, uma subida lenta viraria um "novo momentum" por dia; sem
 * o piso, o terceiro dia de uma conta nova comemoraria um 12.
 */
function isNewMomentumRecord(input: RecorderInput): boolean {
  if (input.momentum.value < MOMENTUM_FLOOR) return false

  const best = input.existing
    .filter((event) => event.type === 'momentum_record')
    .reduce((top, event) => Math.max(top, event.momentumAfter ?? 0), 0)

  return best === 0 ? true : input.momentum.value >= best + MOMENTUM_STEP
}
