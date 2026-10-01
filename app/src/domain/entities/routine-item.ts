import { DomainError } from '@/shared/errors'
import { dayKeyOf, dayKeyToDate, type DayKey } from './day'
import type { DayPart } from './habit'

/**
 * Item de rotina: o que acontece no seu dia e não é hábito nem ação de plano.
 *
 * Acordar, café, trabalho, almoço, dentista às 10:30, a reunião de terça. A
 * vida em volta dos objetivos, que o app fingia não existir.
 *
 * ## Por que não é um hábito
 *
 * Hábito parece o lugar óbvio, e é a armadilha. Duas razões:
 *
 * 1. `createHabit` exige EIXO e ALVO numérico com versão mínima. "Acordar" não
 *    tem eixo nem meta: pedir isso pra encaixar o café da manhã no app é o tipo
 *    de formulário que faz a pessoa desistir na terceira linha da rotina
 * 2. Hábito alimenta o Momentum Score, e o score defende que o que conta é o
 *    que move o objetivo. Doze itens de rotina virando hábito seriam a maneira
 *    mais rápida de inflar o número marcando "acordei", que é exatamente o
 *    comportamento que o produto passa o dia inteiro desencorajando
 *
 * ## Por que não é uma ação
 *
 * `Task` é de UMA data. O que se repete toda segunda, quarta e sexta viraria
 * uma linha nova por ocorrência, pra sempre, e "mudei o treino pras 19h" teria
 * que reescrever um número desconhecido de linhas futuras. A recorrência mora
 * na regra, não em cópias.
 *
 * ## O que ele é, então
 *
 * A terceira espécie do dia, e a camada que organiza as outras duas: a Rotina
 * mostra item de rotina, hábito e ação juntos, porque é assim que o dia
 * acontece. Ela não guarda cópia de hábito nem de ação, ela os EXIBE.
 */

export const ROUTINE_RECURRENCES = [
  'diario',
  'dias-semana',
  'uteis',
  'fim-semana',
  'unica',
] as const
export type RoutineRecurrence = (typeof ROUTINE_RECURRENCES)[number]

export const ROUTINE_RECURRENCE_LABELS: Readonly<Record<RoutineRecurrence, string>> = {
  diario: 'Todos os dias',
  'dias-semana': 'Dias específicos',
  uteis: 'Dias úteis',
  'fim-semana': 'Fim de semana',
  unica: 'Uma vez',
}

/**
 * Os estados de uma ocorrência.
 *
 * `pulado` NÃO é falha, e essa é a regra que o produto inteiro sustenta: pular
 * a quarta não mexe na sexta, e a linha fica registrada porque "eu pulei" é
 * informação. `reagendado` guarda a decisão de mover, que é diferente de não
 * ter feito.
 */
export const ROUTINE_STATUSES = ['pendente', 'feito', 'pulado', 'reagendado'] as const
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number]

export const ROUTINE_STATUS_LABELS: Readonly<Record<RoutineStatus, string>> = {
  pendente: 'Pendente',
  feito: 'Concluído',
  pulado: 'Pulado hoje',
  reagendado: 'Reagendado',
}

export const MAX_ROUTINE_TITLE = 90
export const MAX_ROUTINE_NOTE = 400
export const MAX_ROUTINE_CATEGORY = 40
export const MAX_ROUTINE_DURATION_MIN = 12 * 60
/** Lembrete até duas horas antes. Acima disso deixa de ser lembrete. */
export const MAX_ROUTINE_REMINDER_MIN = 120

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const WEEKDAYS_UTEIS: readonly number[] = [1, 2, 3, 4, 5]
const WEEKDAYS_FIM_DE_SEMANA: readonly number[] = [0, 6]

export interface RoutineItem {
  readonly id: string
  readonly userId: string
  readonly title: string
  /** Observação livre. O "levar o exame" embaixo de "Dentista". */
  readonly note: string | null
  /** Rótulo escrito pela pessoa: "Saúde", "Casa", "Trabalho". Livre de propósito. */
  readonly category: string | null
  /** `HH:MM`. Opcional: metade da rotina de alguém não tem hora marcada. */
  readonly timeOfDay: string | null
  /**
   * Trecho do dia quando não há horário. É o que impede "ler antes de dormir"
   * de cair no mesmo balde de "em algum momento" que a compra do mercado.
   */
  readonly dayPart: DayPart
  readonly durationMin: number | null
  readonly recurrence: RoutineRecurrence
  /** Dias da semana (0 = domingo). Só vale em `dias-semana`. */
  readonly weekdays: readonly number[]
  /** A data, e só em `unica`. Null nas recorrentes. */
  readonly day: DayKey | null
  /**
   * Objetivo que este item empurra. Opcional, e é o ponto do recurso: a maior
   * parte da rotina de alguém não serve a objetivo nenhum, e isso é legítimo.
   * O Momentumm precisa entender que objetivos existem dentro da vida, não ao
   * lado dela.
   */
  readonly objectiveId: string | null
  /** Minutos antes pra avisar. Guardado; o disparo ainda não existe. */
  readonly reminderMin: number | null
  readonly order: number
  /** Pausa: some do dia sem sumir da rotina nem perder o histórico. */
  readonly pausedAt: Date | null
  readonly archivedAt: Date | null
  readonly createdAt: Date
}

/**
 * A ocorrência de um item num dia.
 *
 * Ela só existe quando alguém TOCA naquele dia. Sem linha, o item está
 * pendente, e essa é a diferença entre uma regra de recorrência e um gerador
 * de cópias: um item diário de um ano não são 365 linhas esperando, são zero
 * até o primeiro check.
 *
 * É o mesmo desenho de `habit_logs`, de propósito. Duas formas diferentes de
 * dizer "fiz isso naquele dia" seriam duas contas diferentes de constância
 * seis meses depois.
 */
export interface RoutineOccurrence {
  readonly id: string
  readonly userId: string
  readonly itemId: string
  /** O dia a que a ocorrência pertence, na regra de recorrência. */
  readonly day: DayKey
  readonly status: RoutineStatus
  /** O horário que a regra previa. Guardado pra o histórico não mentir. */
  readonly plannedTime: string | null
  /** Horário trocado só neste dia. "Reagendar pra mais tarde" mora aqui. */
  readonly timeOverride: string | null
  /** Movido pra outro dia. O item some daqui e aparece lá. */
  readonly movedToDay: DayKey | null
  readonly completedAt: Date | null
  readonly createdAt: Date
}

export interface NewRoutineItemInput {
  readonly userId: string
  readonly title: string
  readonly recurrence?: RoutineRecurrence
  readonly weekdays?: readonly number[]
  readonly day?: DayKey | null
  readonly timeOfDay?: string | null
  readonly dayPart?: DayPart
  readonly durationMin?: number | null
  readonly category?: string | null
  readonly note?: string | null
  readonly objectiveId?: string | null
  readonly reminderMin?: number | null
  readonly order?: number
}

/**
 * Cria o item.
 *
 * Nome é o único campo obrigatório, e isso não é descuido: a rotina de alguém
 * tem doze linhas, e um formulário de sete campos por linha garante que ela
 * nunca vai ser cadastrada. O resto tem padrão razoável e se edita depois.
 */
export function createRoutineItem(
  input: NewRoutineItemInput,
  id: string,
  now = new Date(),
): RoutineItem {
  const title = input.title.trim()
  if (title.length < 2) {
    throw new DomainError('Escreve o item com pelo menos 2 letras.')
  }
  if (title.length > MAX_ROUTINE_TITLE) {
    throw new DomainError(`O item pode ter no máximo ${MAX_ROUTINE_TITLE} caracteres.`)
  }

  const note = input.note?.trim() || null
  if (note && note.length > MAX_ROUTINE_NOTE) {
    throw new DomainError(`A observação pode ter no máximo ${MAX_ROUTINE_NOTE} caracteres.`)
  }

  const category = input.category?.trim() || null
  if (category && category.length > MAX_ROUTINE_CATEGORY) {
    throw new DomainError(`A categoria pode ter no máximo ${MAX_ROUTINE_CATEGORY} caracteres.`)
  }

  const timeOfDay = input.timeOfDay?.trim() || null
  if (timeOfDay && !TIME_PATTERN.test(timeOfDay)) {
    throw new DomainError('O horário precisa estar no formato HH:MM.')
  }

  const recurrence = input.recurrence ?? (input.weekdays?.length ? 'dias-semana' : 'diario')
  const weekdays = normalizeWeekdays(input.weekdays ?? [])

  if (recurrence === 'dias-semana' && weekdays.length === 0) {
    throw new DomainError('Escolhe pelo menos um dia da semana.')
  }

  const day = recurrence === 'unica' ? (input.day ?? dayKeyOf(now)) : null

  return {
    id,
    userId: input.userId,
    title,
    note,
    category,
    timeOfDay,
    dayPart: input.dayPart ?? 'qualquer',
    durationMin: normalizeDuration(input.durationMin),
    recurrence,
    weekdays: recurrence === 'dias-semana' ? weekdays : [],
    day,
    objectiveId: input.objectiveId ?? null,
    reminderMin: normalizeReminder(input.reminderMin),
    order: input.order ?? 0,
    pausedAt: null,
    archivedAt: null,
    createdAt: now,
  }
}

function normalizeWeekdays(weekdays: readonly number[]): readonly number[] {
  const valid = [...new Set(weekdays)].filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  )
  return valid.sort((a, b) => a - b)
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new DomainError('A duração precisa ser maior que zero.')
  }
  if (rounded > MAX_ROUTINE_DURATION_MIN) {
    throw new DomainError('Um item de rotina de mais de doze horas é o dia inteiro.')
  }
  return rounded
}

function normalizeReminder(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded) || rounded < 0) {
    throw new DomainError('O lembrete precisa ser de zero minuto ou mais.')
  }
  if (rounded > MAX_ROUTINE_REMINDER_MIN) {
    throw new DomainError(
      `O lembrete pode ser de no máximo ${MAX_ROUTINE_REMINDER_MIN} minutos antes.`,
    )
  }
  return rounded
}

export function isRoutineActive(item: RoutineItem): boolean {
  return item.archivedAt === null
}

/** Ativo e não pausado: só esse entra no dia. */
export function isRoutineRunning(item: RoutineItem): boolean {
  return item.archivedAt === null && item.pausedAt === null
}

/** Os dias da semana que a recorrência cobre. Vazio significa todos. */
export function weekdaysOf(item: RoutineItem): readonly number[] {
  switch (item.recurrence) {
    case 'diario':
      return []
    case 'dias-semana':
      return item.weekdays
    case 'uteis':
      return WEEKDAYS_UTEIS
    case 'fim-semana':
      return WEEKDAYS_FIM_DE_SEMANA
    case 'unica':
      return []
  }
}

/**
 * A regra diz que este item cai neste dia?
 *
 * Só a REGRA: quem pulou, quem foi movido e quem já foi feito é assunto de
 * `routineDayStates`, que lê as ocorrências. Separar os dois é o que deixa a
 * recorrência testável sem inventar histórico.
 */
export function isRoutineScheduledOn(item: RoutineItem, day: DayKey): boolean {
  // Item criado depois não cobra um dia em que ele não existia. É a mesma
  // regra do hábito, e é o que impede a rotina de hoje de reescrever o passado.
  if (day < dayKeyOf(item.createdAt)) return false

  if (item.recurrence === 'unica') return item.day === day

  const weekdays = weekdaysOf(item)
  if (weekdays.length === 0) return item.recurrence === 'diario'
  return weekdays.includes(dayKeyToDate(day).getDay())
}

export function occurrenceOf(
  occurrences: readonly RoutineOccurrence[],
  itemId: string,
  day: DayKey,
): RoutineOccurrence | null {
  return occurrences.find((item) => item.itemId === itemId && item.day === day) ?? null
}

/** Sem linha no dia, o item está pendente. A ausência é o estado padrão. */
export function routineStatusOf(
  occurrences: readonly RoutineOccurrence[],
  itemId: string,
  day: DayKey,
): RoutineStatus {
  return occurrenceOf(occurrences, itemId, day)?.status ?? 'pendente'
}

export interface RoutineDayState {
  readonly item: RoutineItem
  readonly status: RoutineStatus
  /** O horário deste dia: o trocado, quando houve, senão o da regra. */
  readonly time: string | null
  readonly occurrence: RoutineOccurrence | null
  /** Veio de outro dia por reagendamento. A tela diz isso em voz alta. */
  readonly movedFrom: DayKey | null
}

/**
 * O que a rotina põe num dia, já com o estado de cada item.
 *
 * Três coisas entram: o que a regra agenda pra hoje, menos o que foi movido pra
 * fora, mais o que foi movido pra dentro. Sem a terceira, "reagendar pra
 * amanhã" apagaria o item em vez de movê-lo, que é o jeito mais rápido de a
 * pessoa parar de confiar no botão.
 */
export function routineDayStates(
  items: readonly RoutineItem[],
  occurrences: readonly RoutineOccurrence[],
  day: DayKey,
): RoutineDayState[] {
  const byId = new Map(items.map((item) => [item.id, item]))

  const doDia = items
    .filter((item) => isRoutineRunning(item) && isRoutineScheduledOn(item, day))
    .map((item) => {
      const occurrence = occurrenceOf(occurrences, item.id, day)
      return { item, occurrence }
    })
    // Movido pra outro dia sai daqui: ele vive lá agora.
    .filter(({ occurrence }) => occurrence?.movedToDay == null)
    .map(({ item, occurrence }) => toState(item, occurrence, null))

  /*
    Um item já presente pela própria regra não entra de novo por reagendamento.

    Mover um item DIÁRIO pra amanhã cai exatamente nesse caso: amanhã ele já
    acontece, e a linha movida produziria a mesma coisa duas vezes na mesma
    lista. A leitura honesta é que ali o reagendamento não acrescenta ocorrência
    nenhuma, ele só resolve o dia de origem.
  */
  const jaNoDia = new Set(doDia.map((state) => state.item.id))

  const vindosDeFora = occurrences
    .filter((occurrence) => occurrence.movedToDay === day && !jaNoDia.has(occurrence.itemId))
    .map((occurrence) => {
      const item = byId.get(occurrence.itemId)
      if (!item || !isRoutineRunning(item)) return null
      /*
        A linha que MOVEU guarda o destino; o estado no destino é o da linha
        do destino, se ela existir. Sem isso, concluir um item reagendado
        escreveria "feito" no dia de origem, e o histórico diria que a pessoa
        fez na terça o que ela fez na quarta.
      */
      const noDestino = occurrenceOf(occurrences, item.id, day)
      return toState(item, noDestino, occurrence.day)
    })
    .filter((state): state is RoutineDayState => state !== null)

  return [...doDia, ...vindosDeFora].sort(byRoutineClock)
}

function toState(
  item: RoutineItem,
  occurrence: RoutineOccurrence | null,
  movedFrom: DayKey | null,
): RoutineDayState {
  return {
    item,
    status: occurrence?.status ?? 'pendente',
    time: occurrence?.timeOverride ?? item.timeOfDay,
    occurrence,
    movedFrom,
  }
}

function byRoutineClock(a: RoutineDayState, b: RoutineDayState): number {
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
  if (a.time && !b.time) return -1
  if (!a.time && b.time) return 1
  if (a.item.order !== b.item.order) return a.item.order - b.item.order
  return a.item.title.localeCompare(b.item.title, 'pt-BR')
}

/** Concluído conta; pulado e reagendado saíram da fila sem terem sido feitos. */
export function isRoutineDone(status: RoutineStatus): boolean {
  return status === 'feito'
}

export function isRoutineResolved(status: RoutineStatus): boolean {
  return status !== 'pendente'
}

/** A rotina da semana, um dia por posição, pra a visão de sete dias. */
export function routineWeek(
  items: readonly RoutineItem[],
  occurrences: readonly RoutineOccurrence[],
  days: readonly DayKey[],
): { readonly day: DayKey; readonly states: readonly RoutineDayState[] }[] {
  return days.map((day) => ({ day, states: routineDayStates(items, occurrences, day) }))
}

/**
 * Pra onde vai UMA ocorrência quando a pessoa escolhe dia e horário.
 *
 * É o reagendamento de "só dessa vez": a regra do item não muda. No mesmo dia
 * vira horário trocado; em outro dia vira mudança de data, e o horário só é
 * guardado quando difere do da regra, pra que editar a regra depois continue
 * valendo naquele dia.
 */
export type OccurrenceMove =
  | { readonly kind: 'mesmo-dia'; readonly time: string }
  | { readonly kind: 'outro-dia'; readonly day: DayKey; readonly time: string | null }

export function planOccurrenceMove(input: {
  readonly from: DayKey
  readonly to: DayKey
  readonly time: string | null
  readonly currentTime: string | null
  readonly ruleTime: string | null
}): OccurrenceMove {
  const time = input.time?.trim() || null
  if (time && !TIME_PATTERN.test(time)) throw new DomainError('Horário inválido.')
  if (input.to < input.from) throw new DomainError('Escolha hoje ou um dia depois.')

  if (input.to === input.from) {
    if (!time || time === input.currentTime) {
      throw new DomainError('Pra ficar hoje, escolha um horário diferente do atual.')
    }
    return { kind: 'mesmo-dia', time }
  }

  return { kind: 'outro-dia', day: input.to, time: time && time !== input.ruleTime ? time : null }
}

/** O que a rotina fez por um objetivo numa janela de dias. */
export interface RoutineExecution {
  readonly itemId: string
  readonly title: string
  readonly timeOfDay: string | null
  readonly recurrence: RoutineRecurrence
  readonly weekdays: readonly number[]
  readonly done: number
}

/**
 * A rotina de um objetivo, com quantas vezes cada item foi feito de `from` a
 * `to`, inclusive. É o PROGRESSO da §16: o treino de seg/qua/sex aparece no
 * objetivo "Correr 5 km", não só como ponto no score.
 *
 * Conta a ocorrência pelo dia em que ela foi feita. Item reagendado conta no
 * destino, que é onde a linha `feito` mora.
 */
export function routineExecutionFor(
  objectiveId: string,
  items: readonly RoutineItem[],
  occurrences: readonly RoutineOccurrence[],
  from: DayKey,
  to: DayKey,
): RoutineExecution[] {
  return items
    .filter((item) => item.objectiveId === objectiveId && item.archivedAt === null)
    .map((item) => ({
      itemId: item.id,
      title: item.title,
      timeOfDay: item.timeOfDay,
      recurrence: item.recurrence,
      weekdays: item.weekdays,
      done: occurrences.filter(
        (occurrence) =>
          occurrence.itemId === item.id &&
          occurrence.status === 'feito' &&
          occurrence.day >= from &&
          occurrence.day <= to,
      ).length,
    }))
    .sort(byExecutionClock)
}

function byExecutionClock(a: RoutineExecution, b: RoutineExecution): number {
  if (a.timeOfDay && b.timeOfDay) return a.timeOfDay.localeCompare(b.timeOfDay)
  if (a.timeOfDay) return -1
  if (b.timeOfDay) return 1
  return a.title.localeCompare(b.title)
}

const WEEKDAY_SHORT_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

/**
 * "seg, qua, sex" em vez de "Dias específicos".
 *
 * O rótulo genérico obriga a abrir o item pra saber em que dias ele cai, e a
 * pergunta que a lista existe pra responder é justamente essa.
 */
export function routineRecurrenceLabel(item: Pick<RoutineItem, 'recurrence' | 'weekdays'>): string {
  if (item.recurrence !== 'dias-semana') return ROUTINE_RECURRENCE_LABELS[item.recurrence]
  const dias = item.weekdays.map((day) => WEEKDAY_SHORT_NAMES[day]).filter(Boolean)
  if (dias.length === 0) return ROUTINE_RECURRENCE_LABELS[item.recurrence]
  if (dias.length === 1) return `Toda ${dias[0]}`
  return dias.join(', ')
}
