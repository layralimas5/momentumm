import { addDays, daysBetween, startOfWeek, type DayKey } from './day'
import {
  ACHIEVEMENTS,
  achievementSpec,
  COMEBACK_GAP_DAYS,
  CONSISTENT_WEEK_DAYS,
  LEVEL_ACHIEVEMENTS,
  levelOf,
  MIN_PRIORITIES_FOR_BONUS,
  PRIORITY_DAYS_FOR_RHYTHM,
  PROGRESS_KINDS,
  XP_RULES,
  type AchievementKey,
  type EvolutionSnapshot,
  type UnlockedAchievement,
  type XpKind,
  type XpTransaction,
} from './evolution'

/**
 * O motor de XP, como função pura.
 *
 * É a MESMA regra que a migration `0031_evolution.sql` aplica em trigger,
 * escrita em TypeScript. Existe por dois motivos: o modo demo precisa conceder
 * XP sem banco, e os dezesseis critérios de aceite (ação só uma vez, prioridade
 * sem duplicar, teto de hábitos, retomada, semana consistente, conquista
 * única...) precisam de teste que rode em milissegundos. Se um dia as duas
 * versões discordarem, o servidor é quem manda: o cliente só mostra.
 *
 * Nenhum evento aqui recebe "pontos": recebe o TIPO do que aconteceu, e o
 * motor decide quanto vale. É o mesmo contrato do banco, que ignora qualquer
 * número vindo de fora.
 */

export type EvolutionEvent =
  | {
      readonly type: 'task_done'
      readonly taskId: string
      readonly day: DayKey
      readonly isMainPriority: boolean
      /** Prioridades do dia (principal ou alta) e quantas já estão feitas, contando esta. */
      readonly priorities: { readonly total: number; readonly done: number }
    }
  | { readonly type: 'habit_done'; readonly habitId: string; readonly day: DayKey }
  | { readonly type: 'stage_done'; readonly stageId: string; readonly day: DayKey }
  | { readonly type: 'objective_done'; readonly objectiveId: string; readonly day: DayKey }
  | { readonly type: 'review_done'; readonly weekStart: DayKey; readonly day: DayKey }

export interface EvolutionResult {
  readonly snapshot: EvolutionSnapshot
  readonly awarded: readonly XpTransaction[]
  readonly unlocked: readonly UnlockedAchievement[]
}

interface Context {
  readonly userId: string
  readonly now: Date
  readonly newId: () => string
}

export function applyEvolutionEvent(
  snapshot: EvolutionSnapshot,
  event: EvolutionEvent,
  context: Context,
): EvolutionResult {
  const engine = new Engine(snapshot, context)

  switch (event.type) {
    case 'task_done': {
      engine.award(
        event.isMainPriority ? 'priority_done' : 'task_done',
        `task_done:${event.taskId}`,
        'task',
        event.taskId,
        event.day,
      )
      if (
        event.priorities.total >= MIN_PRIORITIES_FOR_BONUS &&
        event.priorities.done >= event.priorities.total
      ) {
        engine.award('priorities_day', `priorities_day:${event.day}`, 'day', event.day, event.day)
      }
      engine.afterProgress(event.day)
      break
    }
    case 'habit_done':
      engine.award(
        'habit_done',
        `habit_done:${event.habitId}:${event.day}`,
        'habit',
        event.habitId,
        event.day,
      )
      engine.afterProgress(event.day)
      break
    case 'stage_done':
      engine.award('stage_done', `stage_done:${event.stageId}`, 'stage', event.stageId, event.day)
      break
    case 'objective_done':
      engine.award(
        'objective_done',
        `objective_done:${event.objectiveId}`,
        'objective',
        event.objectiveId,
        event.day,
      )
      break
    case 'review_done':
      engine.award(
        'review_done',
        `review_done:${event.weekStart}`,
        'week',
        event.weekStart,
        event.day,
      )
      break
  }

  engine.settleAchievements(event.day)
  return engine.result()
}

class Engine {
  private transactions: XpTransaction[]
  private achievements: UnlockedAchievement[]
  private readonly keys: Set<string>
  private readonly awarded: XpTransaction[] = []
  private readonly unlocked: UnlockedAchievement[] = []
  private readonly context: Context

  constructor(snapshot: EvolutionSnapshot, context: Context) {
    this.context = context
    this.transactions = [...snapshot.transactions]
    this.achievements = [...snapshot.achievements]
    this.keys = new Set(snapshot.transactions.map((item) => item.eventKey))
  }

  /**
   * Concede uma vez, dentro do teto do dia. Devolve `false` quando a chave já
   * existia ou o teto já estava batido: nos dois casos nada é gravado.
   */
  award(
    kind: XpKind,
    eventKey: string,
    sourceType: string,
    sourceId: string | null,
    day: DayKey,
    pointsOverride?: number,
  ): boolean {
    if (this.keys.has(eventKey)) return false

    const rule = XP_RULES[kind]
    const points = pointsOverride ?? rule.points
    if (points <= 0) return false

    if (rule.dailyCap !== null) {
      const spent = this.transactions
        .filter((item) => item.kind === kind && item.day === day)
        .reduce((total, item) => total + item.points, 0)
      if (spent + points > rule.dailyCap) return false
    }

    const transaction: XpTransaction = {
      id: this.context.newId(),
      userId: this.context.userId,
      kind,
      points,
      eventKey,
      sourceType,
      sourceId,
      day,
      createdAt: this.context.now,
    }
    this.transactions.push(transaction)
    this.keys.add(eventKey)
    this.awarded.push(transaction)
    return true
  }

  /** Retomada e semana consistente: os dois leem só os tipos de movimento. */
  afterProgress(day: DayKey): void {
    const progressDays = [
      ...new Set(
        this.transactions
          .filter((item) => PROGRESS_KINDS.includes(item.kind))
          .map((item) => item.day),
      ),
    ].sort()

    const previous = progressDays.filter((item) => item < day)
    const last = previous[previous.length - 1]
    // Sem histórico anterior não existe "voltar": é o primeiro dia da conta.
    if (last && daysBetween(last, day) > COMEBACK_GAP_DAYS) {
      this.award('comeback', `comeback:${day}`, 'day', day, day)
    }

    const weekStart = startOfWeek(day)
    const weekEnd = addDays(weekStart, 6)
    const daysThisWeek = progressDays.filter((item) => item >= weekStart && item <= weekEnd)
    if (daysThisWeek.length >= CONSISTENT_WEEK_DAYS) {
      this.award('week_consistent', `week_consistent:${weekStart}`, 'week', weekStart, day)
    }
  }

  /**
   * Conquistas até estabilizar: uma conquista com XP pode subir o nível, e o
   * nível novo pode valer outra conquista. O laço é curto porque as de nível
   * não trazem XP, então ele para sozinho.
   */
  settleAchievements(day: DayKey): void {
    for (let round = 0; round < 5; round += 1) {
      const before = this.achievements.length
      for (const spec of ACHIEVEMENTS) {
        if (this.achievements.some((item) => item.key === spec.key)) continue
        if (!this.qualifies(spec.key)) continue
        this.achievements.push({ key: spec.key, unlockedAt: this.context.now })
        this.unlocked.push({ key: spec.key, unlockedAt: this.context.now })
        if (spec.xp > 0) {
          this.award('achievement', `achievement:${spec.key}`, 'achievement', spec.key, day, spec.xp)
        }
      }
      if (this.achievements.length === before) return
    }
  }

  private qualifies(key: AchievementKey): boolean {
    const has = (kind: XpKind) => this.transactions.some((item) => item.kind === kind)
    const requiredLevel = LEVEL_ACHIEVEMENTS[key]
    if (requiredLevel !== undefined) return this.level() >= requiredLevel

    switch (key) {
      case 'primeiro_passo':
        return has('task_done') || has('priority_done')
      case 'primeira_semana':
        return has('review_done')
      case 'primeiro_marco':
        return has('stage_done')
      case 'primeira_vitoria':
        return has('objective_done')
      case 'de_volta_ao_jogo':
        return has('comeback')
      case 'momentum':
        return has('week_consistent')
      case 'pegou_ritmo':
        return (
          new Set(
            this.transactions
              .filter((item) => item.kind === 'priority_done')
              .map((item) => item.day),
          ).size >= PRIORITY_DAYS_FOR_RHYTHM
        )
      default:
        return false
    }
  }

  private xpTotal(): number {
    return this.transactions.reduce((total, item) => total + item.points, 0)
  }

  private level(): number {
    return levelOf(this.xpTotal()).level
  }

  result(): EvolutionResult {
    return {
      snapshot: {
        xpTotal: this.xpTotal(),
        level: this.level(),
        transactions: this.transactions,
        achievements: this.achievements,
      },
      awarded: this.awarded,
      unlocked: this.unlocked,
    }
  }
}

/** O XP de uma conquista, pra quem só tem a chave. */
export function achievementXp(key: AchievementKey): number {
  return achievementSpec(key).xp
}
