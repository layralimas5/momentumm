import { activityType } from './activity-type'
import type { DayKey } from './day'
import {
  countsAsDone,
  habitTargetLabel,
  type DayPart,
  type HabitDayState,
  type HabitStatus,
} from './habit'
import { comparePriority, type Priority } from './priority'
import {
  isRoutineDone,
  isRoutineResolved,
  type RoutineDayState,
} from './routine-item'
import type { Task } from './task'

/**
 * A agenda do dia: tudo que pertence a uma data, numa lista só, em ordem de
 * relógio.
 *
 * O produto já sabia responder "o que importa agora" (o foco, três itens) e
 * "como foi a semana". O que ele não respondia era a pergunta mais simples de
 * todas, a que a pessoa faz ao destravar o celular: "o que eu tenho pra fazer
 * hoje". A resposta existia repartida em três telas, ação em `/app/plano`,
 * hábito em `/app/habitos`, e o dia em `Hoje` mostrando só o topo da pilha.
 * Somar de cabeça o que falta, abrindo três abas, é trabalho que o app estava
 * pedindo à pessoa em vez de fazer.
 *
 * Esta função é a resposta, e ela é PURA de propósito: recebe as coleções e
 * devolve o retrato. Pelo mesmo motivo de `summarizeDay`, a mesma conta serve à
 * tela de hoje e à tela de rotina, e é isso que impede as duas de discordarem
 * sobre um item marcado.
 *
 * O item NÃO é uma cópia: ele aponta pro registro original (`task` ou
 * `habitState`), e concluir por ele escreve lá. Não existe segunda lista, que é
 * a única forma de "marquei em Hoje e apareceu feito na Rotina" ser verdade por
 * construção, e não por sincronização.
 */

export type AgendaItemKind = 'acao' | 'habito' | 'rotina'

export const AGENDA_KIND_LABELS: Readonly<Record<AgendaItemKind, string>> = {
  acao: 'Ações',
  rotina: 'Rotina',
  habito: 'Hábitos',
}

/**
 * A ordem das espécies quando elas viram lente.
 *
 * É a mesma do menu de adicionar: ação, rotina, hábito. Duas ordens diferentes
 * pras mesmas três palavras, em duas telas do mesmo app, fazem a pessoa reler
 * a lista toda vez em vez de ir direto no lugar de sempre.
 */
export const AGENDA_KIND_ORDER: readonly AgendaItemKind[] = ['acao', 'rotina', 'habito']

/**
 * Os quatro trechos do dia.
 *
 * Reaproveitam o `DayPart` do hábito em vez de criar uma escala nova: o hábito
 * já nasce declarando manhã, tarde, noite ou qualquer hora, e uma segunda
 * escala com os mesmos nomes seria a primeira porta pra as duas discordarem.
 */
export const AGENDA_PARTS: readonly DayPart[] = ['manha', 'tarde', 'noite', 'qualquer']

/**
 * O rótulo do trecho sem horário é uma frase, não uma etiqueta.
 *
 * "Qualquer hora" descreve o campo; "Em algum momento de hoje" descreve o
 * compromisso, e é ele que evita a leitura de que o item é opcional.
 */
export const AGENDA_PART_LABELS: Readonly<Record<DayPart, string>> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  qualquer: 'Em algum momento de hoje',
}

const AFTERNOON_FROM = 12
const NIGHT_FROM = 18

/**
 * Em que trecho do dia cai um horário.
 *
 * Meio-dia abre a tarde e as seis da noite abrem a noite. São cortes de
 * convenção, e a única exigência é que sejam os mesmos em toda parte: com dois
 * cortes diferentes, o item das 18:00 apareceria na tarde numa tela e na noite
 * na outra.
 */
export function partOfTime(time: string): DayPart {
  const hour = Number(time.slice(0, 2))
  if (!Number.isFinite(hour)) return 'qualquer'
  if (hour < AFTERNOON_FROM) return 'manha'
  if (hour < NIGHT_FROM) return 'tarde'
  return 'noite'
}

export interface AgendaItem {
  readonly kind: AgendaItemKind
  /** Chave única na agenda. O id do registro colide entre ação e hábito. */
  readonly key: string
  /** Id do registro original, pra escrever nele. */
  readonly sourceId: string
  readonly title: string
  /** `HH:MM` quando existe. Null é legítimo: horário é opcional no produto. */
  readonly time: string | null
  readonly part: DayPart
  readonly done: boolean
  /**
   * Resolvido sem ter sido feito: pulado com consciência ou adiado. Ele continua
   * na lista, riscado e sem cobrança, porque "pulei a quarta" é informação, e
   * apagar a linha faria a semana parecer menor do que foi.
   */
  readonly skipped: boolean
  /** Duração estimada. Null quando o eixo não é medido em minutos. */
  readonly minutes: number | null
  readonly objectiveId: string | null
  readonly stageId: string | null
  readonly priority: Priority
  readonly isMainPriority: boolean
  /** Rótulo curto do papel: "Prioridade principal", "Hábito · 20 min". */
  readonly role: string
  /** Cor do eixo, pra faixa da linha. Null quando o item não tem eixo. */
  readonly axisColor: string | null
  readonly task: Task | null
  readonly habitState: HabitDayState | null
  readonly routineState: RoutineDayState | null
}

export interface AgendaGroup {
  readonly part: DayPart
  readonly label: string
  readonly items: readonly AgendaItem[]
  readonly done: number
  readonly total: number
}

export interface DayAgenda {
  readonly day: DayKey
  /** Só os trechos que têm item. Cabeçalho de seção vazia é ruído. */
  readonly groups: readonly AgendaGroup[]
  /** Tudo, na mesma ordem dos grupos. É a lista que o foco recorta. */
  readonly items: readonly AgendaItem[]
  readonly done: number
  readonly total: number
  /** 0 a 1. Zero quando não há nada planejado, nunca `NaN`. */
  readonly ratio: number
  /** Nada planejado pro dia. */
  readonly empty: boolean
}

export interface DayAgendaInput {
  readonly tasks: readonly Task[]
  readonly habitStates: readonly HabitDayState[]
  /**
   * O que a rotina põe neste dia. Já vem resolvido (`routineDayStates`), com o
   * horário do dia e o estado da ocorrência: a agenda não conhece regra de
   * recorrência, e é esse corte que a impede de virar um segundo motor de
   * repetição divergindo do primeiro.
   */
  readonly routineStates: readonly RoutineDayState[]
}

/** Estados de hábito que saíram da fila sem ter sido cumpridos. */
const SKIPPED_HABIT_STATUSES: readonly HabitStatus[] = ['pulado', 'adiado']

/**
 * Monta a agenda de um dia.
 *
 * Só o que pertence ao dia entra. Ação atrasada NÃO é puxada pra cá: ela já tem
 * o recado próprio no topo da tela, com a saída ao lado, e misturá-la ao dia
 * atual é o acúmulo com outro nome, exatamente o que o Dia Adaptável se recusa
 * a fazer. A agenda responde "o que é de hoje", não "o que eu devo ao passado".
 *
 * Ação cancelada fica de fora: largar uma ação é decisão tomada, e a decisão
 * vive no histórico, não na fila de hoje.
 */
export function buildDayAgenda(input: DayAgendaInput, day: DayKey): DayAgenda {
  const fromTasks = input.tasks
    .filter((task) => task.day === day && task.status !== 'cancelada')
    .map(taskToItem)

  const fromHabits = input.habitStates.map(habitToItem)
  const fromRoutine = input.routineStates.map(routineToItem)

  return assembleAgenda([...fromTasks, ...fromHabits, ...fromRoutine].sort(byClock), day)
}

/**
 * O retrato, a partir de itens JÁ ordenados.
 *
 * Mora separado de `buildDayAgenda` porque a lente (`agendaOfKind`) precisa do
 * mesmo agrupamento sobre um recorte da lista. Duas montagens diferentes do
 * mesmo retrato seriam duas contas de "quantos faltam" divergindo na primeira
 * regra nova.
 */
function assembleAgenda(items: readonly AgendaItem[], day: DayKey): DayAgenda {
  const groups = AGENDA_PARTS.map((part) => {
    const ofPart = items.filter((item) => item.part === part)
    return {
      part,
      label: AGENDA_PART_LABELS[part],
      items: ofPart,
      done: ofPart.filter((item) => item.done).length,
      total: ofPart.length,
    }
  }).filter((group) => group.total > 0)

  const done = items.filter((item) => item.done).length

  return {
    day,
    groups,
    items,
    done,
    total: items.length,
    ratio: items.length === 0 ? 0 : done / items.length,
    empty: items.length === 0,
  }
}

function taskToItem(task: Task): AgendaItem {
  const axis = task.axis ? activityType(task.axis) : null

  return {
    kind: 'acao',
    key: `acao:${task.id}`,
    sourceId: task.id,
    title: task.title,
    time: task.timeOfDay,
    part: task.timeOfDay ? partOfTime(task.timeOfDay) : 'qualquer',
    done: task.status === 'feita',
    skipped: task.status === 'adiada',
    minutes: task.estimatedMin,
    objectiveId: task.objectiveId,
    stageId: task.stageId,
    priority: task.priority,
    isMainPriority: task.isMainPriority,
    role: task.isMainPriority ? 'Prioridade principal' : 'Ação',
    axisColor: axis?.colorToken ?? null,
    task,
    habitState: null,
    routineState: null,
  }
}

function habitToItem(state: HabitDayState): AgendaItem {
  const { habit } = state
  const axis = activityType(habit.axis)

  return {
    kind: 'habito',
    key: `habito:${habit.id}`,
    sourceId: habit.id,
    title: habit.name,
    time: habit.timeOfDay,
    // Sem horário, o hábito ainda declara o trecho do dia, e é melhor pista que
    // jogá-lo no "em algum momento": quem marcou "manhã" quer ele de manhã.
    part: habit.timeOfDay ? partOfTime(habit.timeOfDay) : habit.dayPart,
    done: countsAsDone(state.status),
    skipped: SKIPPED_HABIT_STATUSES.includes(state.status),
    // Eixo medido em páginas não vira minutos por chute: a estimativa fica nula
    // e some da soma, em vez de inventar um tempo que ninguém deu.
    minutes: axis.unit === 'minutos' ? habit.target : null,
    objectiveId: habit.objectiveId,
    stageId: habit.stageId,
    priority: habit.priority,
    isMainPriority: false,
    role: `Hábito · ${habitTargetLabel(habit)}`,
    axisColor: axis.colorToken,
    task: null,
    habitState: state,
    routineState: null,
  }
}

/**
 * O item de rotina dentro do dia.
 *
 * Ele não tem eixo, não tem prioridade e não tem etapa, e é isso que ele é: o
 * que acontece na sua vida e não serve a objetivo nenhum. Quando serve, o
 * objetivo aparece na linha como aparece nos outros.
 */
function routineToItem(state: RoutineDayState): AgendaItem {
  const { item } = state

  return {
    kind: 'rotina',
    key: `rotina:${item.id}`,
    sourceId: item.id,
    title: item.title,
    time: state.time,
    part: state.time ? partOfTime(state.time) : item.dayPart,
    done: isRoutineDone(state.status),
    skipped: isRoutineResolved(state.status) && !isRoutineDone(state.status),
    minutes: item.durationMin,
    objectiveId: item.objectiveId,
    stageId: null,
    // Rotina não disputa prioridade com ação: ela é o contorno do dia, não a
    // decisão dele. Entrar como 'media' a deixaria na frente de meia lista de
    // ações num empate de horário.
    priority: 'baixa',
    isMainPriority: false,
    role: item.category ?? 'Rotina',
    axisColor: null,
    task: null,
    habitState: null,
    routineState: state,
  }
}

/**
 * A ordem do dia é a do relógio, e o concluído NÃO desce pro fim.
 *
 * Mandar o que saiu pro rodapé faria a lista se reorganizar embaixo do dedo a
 * cada toque, e apagaria a leitura que a timeline dá de graça: às nove da manhã
 * a pessoa vê o que já passou acima e o que vem abaixo. É a ordem que ela viveu.
 *
 * Empate de horário, ou ausência dele, cai pra prioridade principal, prioridade
 * e título, nessa ordem, pra a lista ser estável entre dois carregamentos.
 */
function byClock(a: AgendaItem, b: AgendaItem): number {
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time)
  if (a.time && !b.time) return -1
  if (!a.time && b.time) return 1
  if (a.isMainPriority !== b.isMainPriority) return a.isMainPriority ? -1 : 1
  const priority = comparePriority(a.priority, b.priority)
  if (priority !== 0) return priority
  return a.title.localeCompare(b.title, 'pt-BR')
}

export interface AgendaLens {
  readonly kind: AgendaItemKind
  readonly label: string
  readonly total: number
  readonly done: number
}

/**
 * As lentes que o dia oferece: uma por espécie PRESENTE nele.
 *
 * Espécie que não está no dia não vira lente, porque uma lente que abre numa
 * lista vazia ensina a não tocar nas outras. E a lista sai vazia com uma
 * frequência alta: rotina toda gente tem, hábito nem sempre, ação num domingo
 * quase nunca.
 */
export function agendaLenses(agenda: DayAgenda): readonly AgendaLens[] {
  return AGENDA_KIND_ORDER.map((kind) => {
    const items = agenda.items.filter((item) => item.kind === kind)
    return {
      kind,
      label: AGENDA_KIND_LABELS[kind],
      total: items.length,
      done: items.filter((item) => item.done).length,
    }
  }).filter((lens) => lens.total > 0)
}

/**
 * O mesmo dia, visto por uma espécie só.
 *
 * NÃO é uma segunda agenda: os itens são os mesmos objetos, já ordenados, e
 * continuam apontando pro registro original. O que muda é o recorte, e é por
 * isso que marcar dentro da lente marca no dia inteiro sem sincronizar nada.
 */
export function agendaOfKind(agenda: DayAgenda, kind: AgendaItemKind): DayAgenda {
  return assembleAgenda(
    agenda.items.filter((item) => item.kind === kind),
    agenda.day,
  )
}

/** Os itens que ainda esperam movimento. É a conta de "faltam 3". */
export function openAgendaItems(agenda: DayAgenda): readonly AgendaItem[] {
  return agenda.items.filter((item) => !item.done && !item.skipped)
}

/**
 * Soma estimada do que ainda está em aberto, em minutos. Null quando nenhum
 * item em aberto tem estimativa, somar zero diria "o dia não tem tamanho".
 */
export function openAgendaMinutes(agenda: DayAgenda): number | null {
  const open = openAgendaItems(agenda)
  if (!open.some((item) => item.minutes !== null)) return null
  return open.reduce((sum, item) => sum + (item.minutes ?? 0), 0)
}

/**
 * O horário planejado já passou e o item continua aberto?
 *
 * Existe pra a tela poder dizer "planejado para 18:00" em vez de "ATRASADO".
 * O produto não pune quem não cumpriu o relógio: o horário é uma intenção, e
 * o que a tela oferece é fazer agora ou reagendar.
 */
export function isPastPlannedTime(item: AgendaItem, now: Date): boolean {
  if (!item.time || item.done || item.skipped) return false
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return item.time < clock
}
