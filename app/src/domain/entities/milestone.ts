/**
 * Marcos: os números redondos que a jornada atravessa.
 *
 * Tudo aqui é determinístico e sem estado. A função recebe os totais de hoje e
 * devolve TODOS os marcos já alcançados — quem decide quais são novidade é
 * quem tem o histórico na mão, não este módulo. Isso mantém a regra testável
 * sem banco e evita o pior defeito possível num marco: "100 treinos" aparecer
 * duas vezes porque a conta foi refeita.
 *
 * As faixas são poucas e espaçadas de propósito. Marco a cada dez viraria
 * ruído, e ruído é o oposto de conquista: se tudo é marco, nada é.
 */

export interface MilestoneTotals {
  /** Hábitos concluídos na vida da conta, contando a versão mínima. */
  readonly habitsDone: number
  /** Dias em que alguma coisa se moveu. */
  readonly activeDays: number
  /** A maior sequência já alcançada. */
  readonly streakRecord: number
  readonly objectivesDone: number
  readonly focusMinutes: number
}

export interface Milestone {
  /** Estável e único: é a chave que impede o mesmo marco de ser gravado duas vezes. */
  readonly id: string
  readonly count: number
  /** O plural que acompanha o número no card: "hábitos concluídos". */
  readonly unit: string
  /** A linha pronta pra tela: "50 hábitos concluídos". */
  readonly label: string
}

interface MilestoneRule {
  readonly kind: string
  readonly unit: string
  readonly thresholds: readonly number[]
  value(totals: MilestoneTotals): number
}

const RULES: readonly MilestoneRule[] = [
  {
    kind: 'habitos',
    unit: 'hábitos concluídos',
    thresholds: [10, 50, 100, 250, 500, 1000],
    value: (totals) => totals.habitsDone,
  },
  {
    kind: 'dias',
    unit: 'dias de movimento',
    thresholds: [7, 30, 100, 365],
    value: (totals) => totals.activeDays,
  },
  {
    // A sequência usa o RECORDE, não a atual: um marco que some quando a pessoa
    // perde um dia seria uma conquista que o app tira de volta.
    kind: 'sequencia',
    unit: 'dias seguidos',
    thresholds: [7, 21, 30, 100],
    value: (totals) => totals.streakRecord,
  },
  {
    kind: 'objetivos',
    unit: 'objetivos concluídos',
    thresholds: [1, 3, 10, 25],
    value: (totals) => totals.objectivesDone,
  },
  {
    kind: 'foco',
    unit: 'horas de foco',
    thresholds: [10, 50, 100, 500],
    value: (totals) => Math.floor(totals.focusMinutes / 60),
  },
]

/** Todos os marcos que os totais atuais já sustentam, do menor pro maior. */
export function reachedMilestones(totals: MilestoneTotals): Milestone[] {
  const reached: Milestone[] = []

  for (const rule of RULES) {
    const value = rule.value(totals)
    for (const threshold of rule.thresholds) {
      if (value < threshold) break
      reached.push({
        id: `${rule.kind}:${threshold}`,
        count: threshold,
        unit: rule.unit,
        label: `${threshold} ${rule.unit}`,
      })
    }
  }

  return reached
}

/**
 * O próximo marco de cada trilha, com o quanto falta.
 *
 * O perfil mostra isso porque conquista sem próximo passo vira galeria de
 * troféu empoeirado. Trilha já esgotada não devolve nada — inventar um marco
 * de 2000 hábitos pra ter o que mostrar seria pendurar uma meta impossível na
 * frente de quem acabou de fazer mil.
 */
export interface NextMilestone extends Milestone {
  readonly current: number
  readonly remaining: number
  /** 0 a 1: quanto do caminho até esse marco já foi feito. */
  readonly ratio: number
}

export function nextMilestones(totals: MilestoneTotals): NextMilestone[] {
  const next: NextMilestone[] = []

  for (const rule of RULES) {
    const value = rule.value(totals)
    const threshold = rule.thresholds.find((limit) => value < limit)
    if (threshold === undefined) continue

    next.push({
      id: `${rule.kind}:${threshold}`,
      count: threshold,
      unit: rule.unit,
      label: `${threshold} ${rule.unit}`,
      current: value,
      remaining: threshold - value,
      ratio: threshold === 0 ? 0 : Math.min(1, value / threshold),
    })
  }

  // O mais perto de fechar primeiro: é o que muda a decisão de hoje.
  return next.sort((a, b) => b.ratio - a.ratio)
}
