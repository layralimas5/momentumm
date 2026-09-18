import { activityType } from './activity-type'
import type { CapacityProfile } from './checkin'
import { addDays, dayKeyOf, daysBetween, formatDayLabel, type DayKey } from './day'
import {
  countsAsDone,
  habitsForDay,
  habitStreak,
  habitTargetLabel,
  statusOf,
  type Habit,
  type HabitLog,
} from './habit'
import type { MomentumScore } from './momentum'
import { impactPointsOf, taskImpact } from './momentum-impact'
import { isRunning, type ObjectiveProgress } from './objective'
import type { PlanProgress } from './plan-progress'
import { isPending, type Task } from './task'

/**
 * Dia Adaptável: o dia refeito pelo tempo que a pessoa TEM, sem perder a
 * trajetória dos objetivos.
 *
 * A diferença entre isto e "adiar o que não coube" é a única coisa que importa
 * aqui. Empurrar a lista pra amanhã resolve a tela de hoje e cria a de amanhã:
 * no terceiro dia a pessoa abre o app com dezoito ações vencidas e fecha ele.
 * Por isso o algoritmo faz três coisas diferentes, nessa ordem de preferência:
 *
 *   MANTER    o que mais move o objetivo, na versão cheia
 *   REDUZIR   o que é flexível, pra versão mínima
 *   REAGENDAR o resto — espalhado, respeitando o prazo do objetivo e a carga
 *             que cada dia seguinte já tem
 *
 * ## O que decide a ordem
 *
 * Não é a quantidade de tarefas, e não é a ordem da lista. É um score que soma
 * impacto, prioridade, vínculo com objetivo, prazo, progresso, gargalo do
 * plano, tempo estimado, sequência de hábito, quanto tempo a ação está sendo
 * arrastada e o Momentumm atual. Cada parcela existe porque muda a decisão:
 * duas ações de 30 minutos não são intercambiáveis quando uma destrava a etapa
 * que segura o objetivo atrasado e a outra é uma tarefa solta.
 *
 * ## O que o algoritmo NUNCA faz
 *
 * - Não empurra ação atrasada pra dentro de hoje. O dia que a pessoa tem é o
 *   dia que ela tem; encher ele com a dívida de ontem é o acúmulo com outro nome.
 * - Não tira hábito do dia. Hábito não muda de data — ele encolhe pra versão
 *   mínima, que é o que preserva a sequência num dia curto.
 * - Não decide sozinho: devolve um plano pra revisão. Quem grava é a pessoa.
 */

/** O título fixo da revisão. É a promessa do recurso, e ela não varia. */
export const ADAPTIVE_TITLE = 'Vamos proteger seu Momentumm'

export const ADAPTIVE_VERDICTS = ['manter', 'reduzir', 'reagendar'] as const
export type AdaptiveVerdict = (typeof ADAPTIVE_VERDICTS)[number]

export const ADAPTIVE_VERDICT_LABELS: Readonly<Record<AdaptiveVerdict, string>> = {
  manter: 'Mantém',
  reduzir: 'Versão mínima',
  reagendar: 'Fica pra depois',
}

/** Menos que isso não é um dia, é um toque. */
export const MIN_AVAILABLE_MIN = 10
export const MAX_AVAILABLE_MIN = 12 * 60

/** Até onde uma ação pode ser empurrada. Além disso não é reagendar, é sumir. */
const MAX_PUSH_DAYS = 7

/** Carga de referência de um dia quando a conta ainda não tem histórico. */
const FALLBACK_DAY_MIN = 60

/** Piso da carga de referência: nenhum dia recebe menos que isso ao reagendar. */
const MIN_REFERENCE_DAY_MIN = 30

/** Dias em aberto a partir dos quais a ação está sendo arrastada, não planejada. */
const DRAGGED_AFTER_DAYS = 3

/** Sequência a partir da qual o hábito é essencial: quebrar dói mais que ganhar. */
const ESSENTIAL_STREAK = 3

/**
 * Os pesos da decisão, num lugar só.
 *
 * Ficam juntos e nomeados porque a calibragem certa só aparece com uso real —
 * e porque um score espalhado em números mágicos pelo arquivo é um score que
 * ninguém consegue explicar pra pessoa que está lendo o plano na tela.
 */
const WEIGHT = {
  /** Cada ponto de impacto (1 a 3) vale isso. É a maior parcela, de propósito. */
  impactPoint: 8,
  mainPriority: 14,
  priorityAlta: 6,
  priorityMedia: 2,
  objectiveLinked: 5,
  /** A etapa que está segurando o objetivo. */
  bottleneck: 9,
  objectiveLate: 10,
  objectiveAttention: 5,
  deadlineNear: 6,
  deadlineSoon: 3,
  /** Por dia arrastado, com teto: o que trava há uma semana precisa sair. */
  draggedPerDay: 3,
  draggedCap: 9,
  /** Sequência viva do hábito, com teto. */
  streakCap: 8,
  /** Ritmo caindo: a repetição vale mais, porque é ela que segura a volta. */
  momentumLowHabit: 6,
  /** Ritmo alto: o dia bom é pra avançar objetivo, não pra marcar hábito fácil. */
  momentumHighObjective: 6,
} as const

export interface AdaptiveObjective {
  readonly progress: ObjectiveProgress
  readonly plan: PlanProgress
}

export interface AdaptiveDayInput {
  readonly today: DayKey
  /** Quanto tempo a pessoa disse que tem, em minutos. */
  readonly availableMin: number
  /** A capacidade do dia, vinda do check-in. Calibra o tom, não o corte. */
  readonly capacity: CapacityProfile
  readonly momentum: MomentumScore
  readonly tasks: readonly Task[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
  readonly objectives: readonly AdaptiveObjective[]
  /**
   * Itens que não podem sair do dia, além da prioridade principal. É por aqui
   * que o Modo Retomada protege o passo que a pessoa acabou de escolher.
   */
  readonly protectIds?: readonly string[]
}

export interface AdaptiveItem {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  readonly verdict: AdaptiveVerdict
  /** Tempo estimado original. Zero quando o eixo não é medido em tempo. */
  readonly minutes: number
  /** Tempo que ele ocupa depois da decisão. Zero quando saiu do dia. */
  readonly adaptedMin: number
  /** O texto da versão mínima, quando o veredito é reduzir. */
  readonly minimalTitle: string | null
  /** Pra onde a ação foi, quando o veredito é reagendar. */
  readonly moveTo: DayKey | null
  /** Por que essa decisão, com o dado que a produziu. */
  readonly reason: string
  /** Protegido: a trajetória depende dele e ele não sai do dia. */
  readonly locked: boolean
  readonly objectiveTitle: string | null
  readonly stageTitle: string | null
  /** Não cabe no tempo informado nem reduzido, e mesmo assim fica. */
  readonly overBudget: boolean
  readonly score: number
}

export interface AdaptiveDayPlan {
  readonly today: DayKey
  readonly availableMin: number
  /** Soma do que estava planejado antes de adaptar. */
  readonly plannedMin: number
  /** Soma do que fica depois de adaptar. */
  readonly adaptedMin: number
  readonly items: readonly AdaptiveItem[]
  readonly kept: readonly AdaptiveItem[]
  readonly reduced: readonly AdaptiveItem[]
  readonly rescheduled: readonly AdaptiveItem[]
  /** O dia já cabia no tempo informado: não há o que adaptar. */
  readonly fits: boolean
  /** Quantas ações o app grava se a pessoa confirmar. */
  readonly writes: number
  /** A ação que vira prioridade principal, quando o dia ficou sem nenhuma. */
  readonly promoteTaskId: string | null
  /** Objetivos que continuam andando hoje. É a trajetória preservada, com nome. */
  readonly protectedObjectives: readonly string[]
  readonly title: string
  readonly summary: string
}

/** Candidato antes da decisão: o item com custo e score já apurados. */
interface Candidate {
  readonly kind: 'acao' | 'habito'
  readonly id: string
  readonly title: string
  readonly task: Task | null
  readonly habit: Habit | null
  readonly fullMin: number
  readonly minimalMin: number
  readonly minimalTitle: string | null
  readonly canShrink: boolean
  readonly locked: boolean
  readonly score: number
  readonly objectiveTitle: string | null
  readonly stageTitle: string | null
  readonly keepReason: string
  readonly shrinkReason: string
  readonly deadline: DayKey | null
}

export function buildAdaptiveDay(input: AdaptiveDayInput): AdaptiveDayPlan {
  const available = clampAvailable(input.availableMin)
  const protectedIds = new Set(input.protectIds ?? [])

  const candidates = [
    ...taskCandidates(input, protectedIds),
    ...habitCandidates(input, protectedIds),
  ].sort((a, b) => b.score - a.score)

  const plannedMin = candidates.reduce((sum, item) => sum + item.fullMin, 0)

  /*
    Hábito não muda de data, então ele reserva o tempo dele antes da disputa.

    A reserva é a versão MÍNIMA, nunca a cheia: num dia de uma hora e meia,
    tirar quarenta minutos de hábito antes de olhar as ações faria a rotina
    comer justamente o que move o objetivo. Sobrando tempo no fim, o hábito
    volta pra versão cheia.
  */
  const habits = candidates.filter((item) => item.kind === 'habito')
  const reserved = habits.reduce((sum, item) => sum + item.minimalMin, 0)

  const decisions = new Map<string, AdaptiveItem>()
  let remaining = Math.max(0, available - reserved)

  for (const candidate of candidates.filter((item) => item.kind === 'acao')) {
    if (candidate.fullMin <= remaining) {
      remaining -= candidate.fullMin
      decisions.set(candidate.id, keep(candidate))
      continue
    }

    if (candidate.canShrink && candidate.minimalMin <= remaining) {
      remaining -= candidate.minimalMin
      decisions.set(candidate.id, shrink(candidate))
      continue
    }

    /*
      Protegido não sai do dia — nem quando não cabe.

      É a regra que separa "adaptar o dia" de "esvaziar o dia": a ação que
      sustenta o objetivo encolhe, e quando ela não tem versão mínima o app diz
      em voz alta que ela não cabe, em vez de escondê-la numa data futura e
      deixar o objetivo parado com a tela limpa.
    */
    if (candidate.locked) {
      const decision = candidate.canShrink ? shrink(candidate) : keep(candidate)
      remaining = Math.max(0, remaining - decision.adaptedMin)
      decisions.set(candidate.id, { ...decision, overBudget: true })
      continue
    }

    decisions.set(candidate.id, postpone(candidate, input, decisions))
  }

  // Sobrou tempo: o hábito volta pra versão cheia, do mais relevante pro menos.
  for (const candidate of habits) {
    const extra = candidate.fullMin - candidate.minimalMin
    if (candidate.fullMin > 0 && extra > 0 && extra <= remaining) {
      remaining -= extra
      decisions.set(candidate.id, keep(candidate))
    } else if (candidate.canShrink) {
      decisions.set(candidate.id, shrink(candidate))
    } else {
      decisions.set(candidate.id, keep(candidate))
    }
  }

  /*
    O dia nunca volta vazio.

    Um dia inteiro reagendado é o mesmo que dizer "hoje não conta" — e é
    exatamente o dia em que a pessoa para de abrir o app. Sobrando zero item,
    o de maior score volta na menor versão possível.
  */
  const top = candidates[0]
  if (top && ![...decisions.values()].some((item) => item.verdict !== 'reagendar')) {
    const decision = top.canShrink ? shrink(top) : keep(top)
    decisions.set(top.id, { ...decision, overBudget: decision.adaptedMin > available })
  }

  const items = candidates.flatMap((candidate) => {
    const decision = decisions.get(candidate.id)
    return decision ? [decision] : []
  })

  const kept = items.filter((item) => item.verdict === 'manter')
  const reduced = items.filter((item) => item.verdict === 'reduzir')
  const rescheduled = items.filter((item) => item.verdict === 'reagendar')
  const adaptedMin = items.reduce((sum, item) => sum + item.adaptedMin, 0)

  const staying = [...kept, ...reduced].sort((a, b) => b.score - a.score)
  const protectedObjectives = [
    ...new Set(
      staying.map((item) => item.objectiveTitle).filter((title): title is string => title !== null),
    ),
  ]

  return {
    today: input.today,
    availableMin: available,
    plannedMin,
    adaptedMin,
    items,
    kept,
    reduced,
    rescheduled,
    fits: plannedMin <= available,
    // Hábito não gera escrita: o app não marca por ninguém. A versão mínima
    // dele é orientação pro momento em que a pessoa for marcar.
    writes: items.filter((item) => item.kind === 'acao' && item.verdict !== 'manter').length,
    promoteTaskId: promotionOf(staying, input),
    protectedObjectives,
    title: ADAPTIVE_TITLE,
    summary: summarize({
      capacity: input.capacity,
      available,
      plannedMin,
      adaptedMin,
      kept,
      reduced,
      rescheduled,
    }),
  }
}

export interface DayLoad {
  /** Minutos que o dia pede como ele está montado agora. */
  readonly minutes: number
  /** Itens em aberto: ações e hábitos que ainda esperam movimento. */
  readonly items: number
}

/**
 * O tamanho do dia antes de qualquer adaptação.
 *
 * Existe pra a tela poder perguntar "quanto tempo você tem?" já dizendo quanto
 * o dia pede — e pra ela sumir quando não há nada em aberto. Usa exatamente os
 * mesmos filtros de `buildAdaptiveDay`: dois jeitos de contar o mesmo dia é
 * como o card e a revisão começam a discordar.
 */
export function dayLoadOf(input: {
  readonly today: DayKey
  readonly tasks: readonly Task[]
  readonly habits: readonly Habit[]
  readonly habitLogs: readonly HabitLog[]
}): DayLoad {
  const tasks = input.tasks.filter((task) => task.day === input.today && isPending(task))

  const habits = habitsForDay(input.habits, input.habitLogs, input.today).filter(
    (habit) => !countsAsDone(statusOf(input.habitLogs, habit.id, input.today)),
  )

  const minutes =
    tasks.reduce((sum, task) => sum + task.estimatedMin, 0) +
    habits.reduce(
      (sum, habit) => sum + (activityType(habit.axis).unit === 'minutos' ? habit.target : 0),
      0,
    )

  return { minutes, items: tasks.length + habits.length }
}

export function clampAvailable(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded)) return MIN_AVAILABLE_MIN
  return Math.min(MAX_AVAILABLE_MIN, Math.max(MIN_AVAILABLE_MIN, rounded))
}

// ---------------------------------------------------------------------------
// candidatos
// ---------------------------------------------------------------------------

/**
 * As ações que disputam o dia.
 *
 * Só as de HOJE. Ação vencida não é puxada pra cá: o dia curto não é o lugar
 * de pagar a dívida de ontem, e um algoritmo que faz isso transforma cada dia
 * ruim no começo de uma bola de neve.
 */
function taskCandidates(input: AdaptiveDayInput, protectedIds: ReadonlySet<string>): Candidate[] {
  const byObjective = new Map(input.objectives.map((item) => [item.progress.objective.id, item]))

  return input.tasks
    .filter((task) => task.day === input.today && isPending(task))
    .map((task) => {
      const linked = task.objectiveId ? (byObjective.get(task.objectiveId) ?? null) : null
      const stage = linked?.plan.stages.find((item) => item.stage.id === task.stageId) ?? null
      const bottleneck = task.stageId !== null && linked?.plan.bottleneck?.stage.id === task.stageId
      const dragged = Math.max(0, daysBetween(dayKeyOf(task.createdAt), input.today))
      const minimalMin = Math.max(5, Math.round(task.estimatedMin / 3))

      return {
        kind: 'acao' as const,
        id: task.id,
        title: task.title,
        task,
        habit: null,
        fullMin: task.estimatedMin,
        minimalMin,
        minimalTitle: task.minimalVersion,
        canShrink: task.minimalVersion !== null && minimalMin < task.estimatedMin,
        locked: task.isMainPriority || protectedIds.has(task.id),
        score: scoreTask({ task, linked, bottleneck, dragged, momentum: input.momentum }),
        objectiveTitle: linked?.progress.objective.title ?? null,
        stageTitle: stage?.stage.title ?? null,
        keepReason: keepReasonOfTask({ task, linked, bottleneck, dragged }),
        shrinkReason: shrinkReasonOfTask(task, linked),
        deadline: linked?.progress.objective.deadline ?? null,
      }
    })
}

/**
 * Os hábitos do dia que ainda não saíram.
 *
 * Eixo medido em páginas não vira minutos por chute: ele entra com custo zero
 * de tempo e continua aparecendo no plano. Inventar uma duração faria a conta
 * do dia mentir pra caber numa régua que o produto não tem.
 */
function habitCandidates(input: AdaptiveDayInput, protectedIds: ReadonlySet<string>): Candidate[] {
  return habitsForDay(input.habits, input.habitLogs, input.today)
    .filter((habit) => !countsAsDone(statusOf(input.habitLogs, habit.id, input.today)))
    .map((habit) => {
      const inMinutes = activityType(habit.axis).unit === 'minutos'
      const streak = habitStreak(habit, input.habitLogs, input.today)
      const essential = streak >= ESSENTIAL_STREAK || habit.objectiveId !== null
      const minimalLabel = habitTargetLabel(habit, habit.minimalTarget)
      const streakLabel = `${streak} ${streak === 1 ? 'dia' : 'dias'}`

      return {
        kind: 'habito' as const,
        id: habit.id,
        title: habit.name,
        task: null,
        habit,
        fullMin: inMinutes ? habit.target : 0,
        minimalMin: inMinutes ? habit.minimalTarget : 0,
        minimalTitle: minimalLabel,
        canShrink: habit.minimalTarget < habit.target,
        locked: essential || protectedIds.has(habit.id),
        score: scoreHabit({ habit, streak, momentum: input.momentum }),
        objectiveTitle: null,
        stageTitle: null,
        keepReason:
          streak > 0
            ? `Sequência de ${streakLabel}: cabe inteiro no tempo de hoje.`
            : 'Hábito do dia, e ele cabe inteiro no tempo de hoje.',
        shrinkReason:
          streak > 0
            ? `Sequência de ${streakLabel}. A versão mínima (${minimalLabel}) preserva ela sem ocupar o dia.`
            : `A versão mínima (${minimalLabel}) mantém o hábito vivo num dia curto.`,
        deadline: null,
      }
    })
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

function scoreTask(input: {
  task: Task
  linked: AdaptiveObjective | null
  bottleneck: boolean
  dragged: number
  momentum: MomentumScore
}): number {
  const { task, linked, bottleneck, dragged, momentum } = input

  let score = impactPointsOf(taskImpact(task)) * WEIGHT.impactPoint

  if (task.isMainPriority) score += WEIGHT.mainPriority
  if (task.priority === 'alta') score += WEIGHT.priorityAlta
  else if (task.priority === 'media') score += WEIGHT.priorityMedia

  if (linked && isRunning(linked.progress.objective)) {
    score += WEIGHT.objectiveLinked

    /*
      Prazo e progresso entram como uma coisa só: "atrasado" já é a comparação
      entre o quanto o objetivo andou e o quanto do prazo passou. Somar os dois
      separados contaria o mesmo fato duas vezes.
    */
    if (linked.progress.status === 'atrasado' || linked.progress.status === 'vencido') {
      score += WEIGHT.objectiveLate
    } else if (linked.progress.status === 'atencao') {
      score += WEIGHT.objectiveAttention
    }

    if (linked.progress.daysLeft <= 7) score += WEIGHT.deadlineNear
    else if (linked.progress.daysLeft <= 14) score += WEIGHT.deadlineSoon

    if (bottleneck) score += WEIGHT.bottleneck
    if (momentum.level === 'avancando') score += WEIGHT.momentumHighObjective
  }

  if (dragged >= DRAGGED_AFTER_DAYS) {
    score += Math.min(WEIGHT.draggedCap, (dragged - DRAGGED_AFTER_DAYS + 1) * WEIGHT.draggedPerDay)
  }

  return score
}

function scoreHabit(input: { habit: Habit; streak: number; momentum: MomentumScore }): number {
  const { habit, streak, momentum } = input

  // Hábito entra com o teto de impacto que ele tem no momentum (médio), não
  // com o de uma prioridade: a régua aqui é a mesma que pontua o ritmo.
  let score = (habit.objectiveId !== null ? 2 : 1) * WEIGHT.impactPoint

  if (habit.priority === 'alta') score += WEIGHT.priorityAlta
  else if (habit.priority === 'media') score += WEIGHT.priorityMedia
  if (habit.objectiveId !== null) score += WEIGHT.objectiveLinked

  score += Math.min(WEIGHT.streakCap, streak)

  /*
    Ritmo caindo empurra a repetição pra frente da fila.

    Num dia curto de quem está desacelerando, o que sustenta a volta é a
    sequência, não o volume: manter o hábito de dez minutos vale mais que
    metade de uma ação grande que vai ficar pela metade de novo.
  */
  if (momentum.level === 'desacelerando' || momentum.level === 'retomando') {
    score += WEIGHT.momentumLowHabit
  }

  return score
}

// ---------------------------------------------------------------------------
// decisões
// ---------------------------------------------------------------------------

function keep(candidate: Candidate): AdaptiveItem {
  return {
    kind: candidate.kind,
    id: candidate.id,
    title: candidate.title,
    verdict: 'manter',
    minutes: candidate.fullMin,
    adaptedMin: candidate.fullMin,
    minimalTitle: null,
    moveTo: null,
    reason: candidate.keepReason,
    locked: candidate.locked,
    objectiveTitle: candidate.objectiveTitle,
    stageTitle: candidate.stageTitle,
    overBudget: false,
    score: candidate.score,
  }
}

function shrink(candidate: Candidate): AdaptiveItem {
  return {
    kind: candidate.kind,
    id: candidate.id,
    title: candidate.title,
    verdict: 'reduzir',
    minutes: candidate.fullMin,
    adaptedMin: candidate.canShrink ? candidate.minimalMin : candidate.fullMin,
    minimalTitle: candidate.minimalTitle,
    moveTo: null,
    reason: candidate.shrinkReason,
    locked: candidate.locked,
    objectiveTitle: candidate.objectiveTitle,
    stageTitle: candidate.stageTitle,
    overBudget: false,
    score: candidate.score,
  }
}

function postpone(
  candidate: Candidate,
  input: AdaptiveDayInput,
  decided: ReadonlyMap<string, AdaptiveItem>,
): AdaptiveItem {
  const placement = placeTask(candidate, input, decided)

  return {
    kind: candidate.kind,
    id: candidate.id,
    title: candidate.title,
    verdict: 'reagendar',
    minutes: candidate.fullMin,
    adaptedMin: 0,
    minimalTitle: null,
    moveTo: placement.day,
    reason: placement.reason,
    locked: false,
    objectiveTitle: candidate.objectiveTitle,
    stageTitle: candidate.stageTitle,
    overBudget: false,
    score: candidate.score,
  }
}

/**
 * Onde a ação cai.
 *
 * Não é "amanhã". Amanhã é como o adiamento vira pilha: três dias assim e o
 * dia seguinte tem o triplo do que cabe nele. A ação procura o primeiro dia
 * cuja carga ainda comporta o tamanho dela, dentro do prazo do objetivo e de
 * uma semana no máximo. Se nenhum dia comporta, ela vai pro mais vazio — e o
 * plano diz que foi por falta de espaço, em vez de fingir que coube.
 */
function placeTask(
  candidate: Candidate,
  input: AdaptiveDayInput,
  decided: ReadonlyMap<string, AdaptiveItem>,
): { day: DayKey; reason: string } {
  const reference = referenceDayMin(input)
  const load = loadByDay(input, decided)

  const horizon = Math.min(
    MAX_PUSH_DAYS,
    candidate.deadline ? Math.max(1, daysBetween(input.today, candidate.deadline)) : MAX_PUSH_DAYS,
  )

  const days = Array.from({ length: horizon }, (_, index) => addDays(input.today, index + 1))

  const fitting = days.find(
    (day) => (load.get(day) ?? 0) + candidate.fullMin <= Math.max(reference, candidate.fullMin),
  )

  const chosen =
    fitting ??
    [...days].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0] ??
    addDays(input.today, 1)

  const label = formatDayLabel(chosen, input.today)
  const already = Math.round(load.get(chosen) ?? 0)

  if (fitting) {
    return {
      day: chosen,
      reason: `Não cabe no tempo de hoje. ${label} tem ${already} min planejados e comporta ela sem virar acúmulo.`,
    }
  }

  return {
    day: chosen,
    reason: candidate.deadline
      ? `Não cabe hoje e o prazo do objetivo não deixa empurrar mais. ${label} é o dia mais livre até lá.`
      : `Não cabe hoje. ${label} é o dia mais livre da semana.`,
  }
}

/**
 * Quanto cada dia já tem planejado, contando o que este mesmo plano acabou de
 * mandar pra lá. Sem isso, cinco ações reagendadas na mesma passada caem todas
 * no mesmo dia — que é o acúmulo que o recurso existe pra evitar.
 */
function loadByDay(
  input: AdaptiveDayInput,
  decided: ReadonlyMap<string, AdaptiveItem>,
): Map<DayKey, number> {
  const load = new Map<DayKey, number>()

  for (const task of input.tasks) {
    if (!isPending(task) || task.day <= input.today) continue
    load.set(task.day, (load.get(task.day) ?? 0) + task.estimatedMin)
  }

  for (const item of decided.values()) {
    if (item.verdict !== 'reagendar' || item.moveTo === null) continue
    load.set(item.moveTo, (load.get(item.moveTo) ?? 0) + item.minutes)
  }

  return load
}

/**
 * A carga de referência de um dia: a média do que a própria pessoa costuma
 * planejar. É a régua honesta — um número fixo faria o app decidir por ela o
 * tamanho de um dia que ele não conhece.
 */
function referenceDayMin(input: AdaptiveDayInput): number {
  const from = addDays(input.today, -13)
  const to = addDays(input.today, 13)

  const perDay = new Map<DayKey, number>()
  for (const task of input.tasks) {
    if (task.day === input.today || task.day < from || task.day > to) continue
    if (task.status === 'cancelada') continue
    perDay.set(task.day, (perDay.get(task.day) ?? 0) + task.estimatedMin)
  }

  const loads = [...perDay.values()]
  const average =
    loads.length > 0
      ? loads.reduce((sum, value) => sum + value, 0) / loads.length
      : FALLBACK_DAY_MIN

  return Math.max(MIN_REFERENCE_DAY_MIN, Math.round(average))
}

/**
 * A ação que vira prioridade principal.
 *
 * Só quando o dia ficou sem nenhuma: um dia adaptado que perde a prioridade
 * explícita vira lista de novo, e a próxima pergunta ("o que eu faço agora?")
 * volta a não ter resposta.
 */
function promotionOf(staying: readonly AdaptiveItem[], input: AdaptiveDayInput): string | null {
  const hasMain = input.tasks.some(
    (task) => task.day === input.today && isPending(task) && task.isMainPriority,
  )
  if (hasMain) return null

  return staying.find((item) => item.kind === 'acao')?.id ?? null
}

function summarize(input: {
  capacity: CapacityProfile
  available: number
  plannedMin: number
  adaptedMin: number
  kept: readonly AdaptiveItem[]
  reduced: readonly AdaptiveItem[]
  rescheduled: readonly AdaptiveItem[]
}): string {
  const { capacity, available, plannedMin, adaptedMin, kept, reduced, rescheduled } = input

  if (plannedMin <= available && reduced.length === 0 && rescheduled.length === 0) {
    return `O que está planejado já cabe em ${available} min. Não mexi em nada.`
  }

  const parts: string[] = []
  if (kept.length > 0) {
    parts.push(`${kept.length} ${kept.length === 1 ? 'item inteiro' : 'itens inteiros'}`)
  }
  if (reduced.length > 0) parts.push(`${reduced.length} na versão mínima`)
  if (rescheduled.length > 0) {
    parts.push(`${rescheduled.length} ${rescheduled.length === 1 ? 'reagendada' : 'reagendadas'}`)
  }

  const objectives = new Set(
    [...kept, ...reduced].map((item) => item.objectiveTitle).filter((title) => title !== null),
  )

  const trajectory =
    objectives.size === 0
      ? ''
      : objectives.size === 1
        ? ' O objetivo que estava andando continua andando hoje.'
        : ` Os ${objectives.size} objetivos que estavam andando continuam andando hoje.`

  // Dia de baixa energia recebe a mesma conta com outra leitura: ali a versão
  // mínima não é concessão, é o plano.
  const tone = capacity.preferMinimal ? ' Num dia assim, a versão mínima já é o plano cheio.' : ''

  return `De ${plannedMin} min planejados pra ${adaptedMin} min: ${parts.join(', ')}.${trajectory}${tone}`
}

// ---------------------------------------------------------------------------
// razões
// ---------------------------------------------------------------------------

function keepReasonOfTask(input: {
  task: Task
  linked: AdaptiveObjective | null
  bottleneck: boolean
  dragged: number
}): string {
  const { task, linked, bottleneck, dragged } = input

  if (task.isMainPriority) return 'Prioridade principal do dia: ela não sai do dia.'

  if (bottleneck && linked) {
    return `Destrava a etapa que está segurando ${linked.progress.objective.title}.`
  }

  if (linked && (linked.progress.status === 'atrasado' || linked.progress.status === 'vencido')) {
    const prazo =
      linked.progress.daysLeft === 0 ? 'fecha hoje' : `faltam ${linked.progress.daysLeft} dias`
    return `${linked.progress.objective.title} está atrasado e ${prazo}. Parar hoje custa caro.`
  }

  if (linked && linked.progress.daysLeft <= 7) {
    const prazo = linked.progress.daysLeft === 0 ? 'hoje' : `${linked.progress.daysLeft} dias`
    return `${linked.progress.objective.title} fecha em ${prazo}: é o que ainda dá pra empurrar.`
  }

  if (dragged >= DRAGGED_AFTER_DAYS) {
    return `Está em aberto há ${dragged} dias. Adiar de novo é o que faz ela nunca sair.`
  }

  if (linked) return `Empurra ${linked.progress.objective.title} e cabe no tempo de hoje.`

  return `Cabe no tempo de hoje em ${task.estimatedMin} min.`
}

function shrinkReasonOfTask(task: Task, linked: AdaptiveObjective | null): string {
  if (!task.minimalVersion) {
    return 'Não cabe inteira nos minutos de hoje e não tem versão mínima definida. Fica assim mesmo: o objetivo não pode parar.'
  }

  const minimal = Math.max(5, Math.round(task.estimatedMin / 3))
  const target = linked ? ` e ${linked.progress.objective.title} continua andando` : ''

  return `De ${task.estimatedMin} para ${minimal} min: “${task.minimalVersion}” mantém o avanço${target}.`
}
