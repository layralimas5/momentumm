import type { PlanTier } from './plan'
import { addDays, startOfWeek, type DayKey } from './day'

/**
 * Evolução: XP, níveis, conquistas e desbloqueios.
 *
 * ## O que este módulo NÃO é
 *
 * Não é o Momentumm. O score mede o ritmo de agora e sobe e desce com a semana;
 * o XP mede o caminho percorrido desde o primeiro dia e só cresce. São duas
 * perguntas diferentes ("como estou?" e "quanto já andei?") e por isso duas
 * réguas: uma pessoa em queda de momentum pode estar no nível 6, e um nível 1
 * pode ter o melhor momentum da conta.
 *
 * ## Onde a regra mora de verdade
 *
 * Os números daqui são ESPELHO dos que o banco aplica (migration
 * `0031_evolution.sql`): quem concede XP é o Postgres, em trigger, com chave
 * única por evento e teto diário. O frontend nunca envia pontos. Este arquivo
 * existe pra tela, modo demo e teste falarem a mesma língua que o servidor, e
 * o teste `evolution.test.ts` confere que os dois conjuntos de números não
 * divergiram.
 *
 * ## O plano define o que a pessoa pode usar. O XP define o que ela conquistou.
 *
 * Nada do PRO (IA, limites, relatórios) se destrava por nível. O que o XP
 * libera é reconhecimento e personalização: arranjo do Share Studio, título no
 * perfil, retrospectiva. Alguns desbloqueios pedem os dois ao mesmo tempo, e a
 * tela diz isso em voz alta ("PRO · nível 7").
 */

// ---------------------------------------------------------------------------
// as regras de XP
// ---------------------------------------------------------------------------

export const XP_KINDS = [
  'task_done',
  'priority_done',
  'habit_done',
  'priorities_day',
  'review_done',
  'stage_done',
  'objective_done',
  'comeback',
  'week_consistent',
  'achievement',
] as const
export type XpKind = (typeof XP_KINDS)[number]

export interface XpRule {
  readonly kind: XpKind
  /** Pontos por evento. Em `achievement` é o piso: cada conquista traz o seu. */
  readonly points: number
  /** Teto de pontos desse tipo por dia. Null é sem teto. */
  readonly dailyCap: number | null
  readonly label: string
  /** O que conta, em uma linha. Aparece na tela como legenda das fontes. */
  readonly description: string
}

/**
 * Os tetos são a defesa contra farming: criar vinte ações de um minuto rende
 * no máximo oito ações de XP num dia, e cinco hábitos. Prioridade, marco e
 * objetivo continuam valendo mais justamente porque são raros.
 */
export const XP_RULES: Readonly<Record<XpKind, XpRule>> = {
  task_done: {
    kind: 'task_done',
    points: 5,
    dailyCap: 40,
    label: 'Ação concluída',
    description: 'Uma ação do Hoje fechada. Até oito por dia contam.',
  },
  priority_done: {
    kind: 'priority_done',
    points: 10,
    dailyCap: 10,
    label: 'Prioridade concluída',
    description: 'A prioridade do dia fechada. Vale no lugar da ação comum, não junto.',
  },
  habit_done: {
    kind: 'habit_done',
    points: 3,
    dailyCap: 15,
    label: 'Hábito cumprido',
    description: 'Um hábito feito, inclusive na versão mínima. Até cinco por dia contam.',
  },
  priorities_day: {
    kind: 'priorities_day',
    points: 15,
    dailyCap: 15,
    label: 'Prioridades do dia',
    description: 'Todas as prioridades do dia fechadas, quando há pelo menos duas.',
  },
  review_done: {
    kind: 'review_done',
    points: 25,
    dailyCap: 25,
    label: 'Review Semanal',
    description: 'O review da semana concluído.',
  },
  stage_done: {
    kind: 'stage_done',
    points: 50,
    dailyCap: 100,
    label: 'Marco alcançado',
    description: 'Uma etapa do plano concluída.',
  },
  objective_done: {
    kind: 'objective_done',
    points: 100,
    dailyCap: 100,
    label: 'Objetivo concluído',
    description: 'Um objetivo inteiro fechado.',
  },
  comeback: {
    kind: 'comeback',
    points: 20,
    dailyCap: 20,
    label: 'Retomada',
    description: 'Voltou a executar depois de pelo menos dois dias parado.',
  },
  week_consistent: {
    kind: 'week_consistent',
    points: 30,
    dailyCap: 30,
    label: 'Semana consistente',
    description: 'Cinco dias com movimento na mesma semana.',
  },
  achievement: {
    kind: 'achievement',
    points: 0,
    dailyCap: null,
    label: 'Conquista',
    description: 'O XP que algumas conquistas trazem junto.',
  },
}

/** Tipos que contam como "movimento": é deles que retomada e semana consistente leem. */
export const PROGRESS_KINDS: readonly XpKind[] = ['task_done', 'priority_done', 'habit_done']

/** Dias com movimento numa semana pra ela contar como consistente. */
export const CONSISTENT_WEEK_DAYS = 5

/** Dias inteiros sem movimento a partir dos quais voltar é retomada. */
export const COMEBACK_GAP_DAYS = 2

/** Prioridades do dia necessárias pra o bônus de "todas fechadas" existir. */
export const MIN_PRIORITIES_FOR_BONUS = 2

// ---------------------------------------------------------------------------
// níveis
// ---------------------------------------------------------------------------

export interface LevelSpec {
  readonly level: number
  readonly name: string
  /** XP total onde o nível começa. */
  readonly minXp: number
}

/**
 * Os cinco primeiros são os que o produto definiu. Do sexto em diante a
 * distância cresce de forma previsível, e além do décimo a fórmula continua
 * sozinha (`levelSpecOf`), pra ninguém bater num teto por falta de linha.
 */
export const LEVELS: readonly LevelSpec[] = [
  { level: 1, name: 'Começo', minXp: 0 },
  { level: 2, name: 'Movimento', minXp: 100 },
  { level: 3, name: 'Ritmo', minXp: 300 },
  { level: 4, name: 'Tração', minXp: 700 },
  { level: 5, name: 'Consistência', minXp: 1500 },
  { level: 6, name: 'Impulso', minXp: 3000 },
  { level: 7, name: 'Firmeza', minXp: 6000 },
  { level: 8, name: 'Amplitude', minXp: 9500 },
  { level: 9, name: 'Maestria', minXp: 13500 },
  { level: 10, name: 'Legado', minXp: 18000 },
]

/** Quanto cada nível acima do décimo pede a mais que o anterior. */
export const XP_STEP_BEYOND_TABLE = 5000

const LAST_LEVEL = LEVELS[LEVELS.length - 1] as LevelSpec

export function levelSpecOf(level: number): LevelSpec {
  const safe = Math.max(1, Math.floor(level))
  const known = LEVELS.find((spec) => spec.level === safe)
  if (known) return known
  return {
    level: safe,
    name: `${LAST_LEVEL.name} ${toRoman(safe - LAST_LEVEL.level + 1)}`,
    minXp: LAST_LEVEL.minXp + (safe - LAST_LEVEL.level) * XP_STEP_BEYOND_TABLE,
  }
}

export interface LevelProgress {
  readonly level: number
  readonly name: string
  readonly xpTotal: number
  /** Onde o nível começa e onde o próximo começa. */
  readonly minXp: number
  readonly nextMinXp: number
  /** XP acumulado dentro do nível atual. */
  readonly xpInLevel: number
  /** Quanto falta pro próximo nível. */
  readonly xpToNext: number
  /** Tamanho do nível: é o denominador da barra. */
  readonly span: number
  /** 0 a 100, já arredondado. */
  readonly percent: number
  readonly next: LevelSpec
}

/** O nível que um total de XP alcança. XP nunca é negativo: abaixo de zero é zero. */
export function levelOf(xpTotal: number): LevelProgress {
  const xp = Math.max(0, Math.floor(xpTotal))

  let level = 1
  while (levelSpecOf(level + 1).minXp <= xp) level += 1

  const current = levelSpecOf(level)
  const next = levelSpecOf(level + 1)
  const span = next.minXp - current.minXp
  const xpInLevel = xp - current.minXp

  return {
    level,
    name: current.name,
    xpTotal: xp,
    minXp: current.minXp,
    nextMinXp: next.minXp,
    xpInLevel,
    xpToNext: next.minXp - xp,
    span,
    percent: Math.min(100, Math.floor((xpInLevel / span) * 100)),
    next,
  }
}

// ---------------------------------------------------------------------------
// conquistas
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_KEYS = [
  'primeiro_passo',
  'primeira_semana',
  'pegou_ritmo',
  'de_volta_ao_jogo',
  'primeira_vitoria',
  'momentum',
  'primeiro_marco',
  'em_movimento',
  'tracao',
  'consistencia',
] as const
export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number]

export const ACHIEVEMENT_CATEGORIES = ['ritual', 'constancia', 'objetivos', 'nivel'] as const
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]

export const ACHIEVEMENT_CATEGORY_LABELS: Readonly<Record<AchievementCategory, string>> = {
  ritual: 'Rituais',
  constancia: 'Constância',
  objetivos: 'Objetivos',
  nivel: 'Níveis',
}

export type AchievementRarity = 'comum' | 'rara'

export interface AchievementSpec {
  readonly key: AchievementKey
  readonly name: string
  readonly description: string
  /** Chave de ícone resolvida na apresentação. O domínio não conhece SVG. */
  readonly icon: string
  readonly category: AchievementCategory
  /** XP que vem junto. Zero nas conquistas de nível: seriam XP por ganhar XP. */
  readonly xp: number
  readonly rarity: AchievementRarity
  /** Como se ganha, na segunda pessoa. É o que a tela mostra enquanto está bloqueada. */
  readonly condition: string
}

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  /*
    A primeira ação concluída. É o "agora entendi" do teste grátis: a
    pessoa informou a meta, ganhou um plano, viu o passo de hoje e fechou.
    Vale pouco XP de propósito; o que ela entrega é a frase.
  */
  {
    key: 'primeiro_passo',
    name: 'Primeiro Passo',
    description: 'A primeira ação concluída. Você começou de verdade.',
    icon: 'check',
    category: 'constancia',
    xp: 10,
    rarity: 'comum',
    condition: 'Conclui a tua primeira ação no Hoje.',
  },
  {
    key: 'primeira_semana',
    name: 'Primeira Semana',
    description: 'O primeiro Review Semanal concluído.',
    icon: 'calendario',
    category: 'ritual',
    xp: 20,
    rarity: 'comum',
    condition: 'Conclui o teu primeiro Review Semanal.',
  },
  {
    key: 'primeiro_marco',
    name: 'Primeiro Marco',
    description: 'A primeira etapa de um plano fechada.',
    icon: 'plano',
    category: 'objetivos',
    xp: 20,
    rarity: 'comum',
    condition: 'Conclui a primeira etapa de um plano.',
  },
  {
    key: 'de_volta_ao_jogo',
    name: 'De Volta ao Jogo',
    description: 'Parou por uns dias e voltou a executar.',
    icon: 'jornada',
    category: 'constancia',
    xp: 20,
    rarity: 'comum',
    condition: 'Volta a executar depois de pelo menos dois dias parado.',
  },
  {
    key: 'pegou_ritmo',
    name: 'Pegou Ritmo',
    description: 'A prioridade do dia fechada em sete dias diferentes.',
    icon: 'raio',
    category: 'constancia',
    xp: 40,
    rarity: 'rara',
    condition: 'Conclui a prioridade do dia em sete dias diferentes.',
  },
  {
    key: 'momentum',
    name: 'Momentumm',
    description: 'A primeira semana consistente: cinco dias com movimento.',
    icon: 'fogo',
    category: 'constancia',
    xp: 30,
    rarity: 'rara',
    condition: `Fecha uma semana com ${CONSISTENT_WEEK_DAYS} dias de movimento.`,
  },
  {
    key: 'primeira_vitoria',
    name: 'Primeira Vitória',
    description: 'O primeiro objetivo concluído.',
    icon: 'trofeu',
    category: 'objetivos',
    xp: 50,
    rarity: 'rara',
    condition: 'Conclui o teu primeiro objetivo.',
  },
  {
    key: 'em_movimento',
    name: 'Em Movimento',
    description: 'Chegou ao nível 2.',
    icon: 'subir',
    category: 'nivel',
    xp: 0,
    rarity: 'comum',
    condition: 'Alcança o nível 2.',
  },
  {
    key: 'tracao',
    name: 'Tração',
    description: 'Chegou ao nível 4.',
    icon: 'progresso',
    category: 'nivel',
    xp: 0,
    rarity: 'rara',
    condition: 'Alcança o nível 4.',
  },
  {
    key: 'consistencia',
    name: 'Consistência',
    description: 'Chegou ao nível 5.',
    icon: 'lotus',
    category: 'nivel',
    xp: 0,
    rarity: 'rara',
    condition: 'Alcança o nível 5.',
  },
]

export function achievementSpec(key: AchievementKey): AchievementSpec {
  return ACHIEVEMENTS.find((spec) => spec.key === key) ?? (ACHIEVEMENTS[0] as AchievementSpec)
}

/** Nível que cada conquista de nível exige. As outras não entram aqui. */
export const LEVEL_ACHIEVEMENTS: Readonly<Partial<Record<AchievementKey, number>>> = {
  em_movimento: 2,
  tracao: 4,
  consistencia: 5,
}

/** Dias diferentes com prioridade fechada pra "Pegou Ritmo". */
export const PRIORITY_DAYS_FOR_RHYTHM = 7

// ---------------------------------------------------------------------------
// desbloqueios
// ---------------------------------------------------------------------------

export const UNLOCK_KINDS = ['share', 'titulo', 'moldura', 'retrospectiva'] as const
export type UnlockKind = (typeof UNLOCK_KINDS)[number]

export const UNLOCK_KIND_LABELS: Readonly<Record<UnlockKind, string>> = {
  share: 'Share Studio',
  titulo: 'Título',
  moldura: 'Moldura',
  retrospectiva: 'Retrospectiva',
}

export interface UnlockSpec {
  readonly key: string
  readonly kind: UnlockKind
  readonly label: string
  readonly hint: string
  readonly level: number
  /** Pede o PRO além do nível. O plano continua mandando. */
  readonly requiresPro: boolean
}

/**
 * Só o que existe de verdade no produto entra aqui. Um desbloqueio que
 * promete um tema que ainda não foi desenhado é uma dívida com a pessoa.
 */
export const UNLOCKS: readonly UnlockSpec[] = [
  {
    key: 'share_lista',
    kind: 'share',
    label: 'Arranjo "Lista"',
    hint: 'O que saiu, com os dias da semana, no Share Studio.',
    level: 2,
    requiresPro: false,
  },
  {
    key: 'titulo_em_ritmo',
    kind: 'titulo',
    label: 'Título "Em ritmo"',
    hint: 'Aparece embaixo do teu nome no perfil.',
    level: 3,
    requiresPro: false,
  },
  {
    key: 'share_anel',
    kind: 'share',
    label: 'Arranjo "Anel"',
    hint: 'Números em cima, o progresso desenhado.',
    level: 3,
    requiresPro: false,
  },
  {
    key: 'retrospectiva',
    kind: 'retrospectiva',
    label: 'Retrospectiva da jornada',
    hint: 'Os números longos da tua trajetória, na Evolução.',
    level: 5,
    requiresPro: false,
  },
  {
    key: 'titulo_constante',
    kind: 'titulo',
    label: 'Título "Constante"',
    hint: 'Substitui o "Em ritmo" no perfil.',
    level: 6,
    requiresPro: false,
  },
  {
    key: 'moldura_aurora',
    kind: 'moldura',
    label: 'Moldura Aurora',
    hint: 'Um anel de luz no teu avatar.',
    level: 7,
    requiresPro: true,
  },
  {
    key: 'share_figura',
    kind: 'share',
    label: 'Arranjo "Figura"',
    hint: 'O desenho no centro, os números embaixo.',
    level: 8,
    requiresPro: false,
  },
  {
    key: 'titulo_mestre',
    kind: 'titulo',
    label: 'Título "Mestre do ritmo"',
    hint: 'O título mais alto do perfil.',
    level: 9,
    requiresPro: true,
  },
]

/** O texto que cada título mostra no perfil. */
export const UNLOCK_TITLES: Readonly<Record<string, string>> = {
  titulo_em_ritmo: 'Em ritmo',
  titulo_constante: 'Constante',
  titulo_mestre: 'Mestre do ritmo',
}

export type UnlockStatus = 'liberado' | 'falta_nivel' | 'falta_pro' | 'falta_ambos'

export interface UnlockView extends UnlockSpec {
  readonly status: UnlockStatus
}

export function unlockStatusOf(spec: UnlockSpec, level: number, plan: PlanTier): UnlockStatus {
  const hasLevel = level >= spec.level
  const hasPlan = !spec.requiresPro || plan === 'pro'
  if (hasLevel && hasPlan) return 'liberado'
  if (!hasLevel && !hasPlan) return 'falta_ambos'
  return hasLevel ? 'falta_pro' : 'falta_nivel'
}

export function unlocksFor(level: number, plan: PlanTier): UnlockView[] {
  return UNLOCKS.map((spec) => ({ ...spec, status: unlockStatusOf(spec, level, plan) }))
}

/** As chaves já liberadas: é o que o Share Studio e o perfil consultam. */
export function unlockedKeys(level: number, plan: PlanTier): ReadonlySet<string> {
  return new Set(
    UNLOCKS.filter((spec) => unlockStatusOf(spec, level, plan) === 'liberado').map(
      (spec) => spec.key,
    ),
  )
}

/** O título mais alto liberado, ou null. */
export function profileTitleOf(level: number, plan: PlanTier): string | null {
  const titles = UNLOCKS.filter(
    (spec) => spec.kind === 'titulo' && unlockStatusOf(spec, level, plan) === 'liberado',
  )
  const best = titles[titles.length - 1]
  return best ? (UNLOCK_TITLES[best.key] ?? null) : null
}

/** O primeiro desbloqueio ainda não liberado por nível, na ordem da tabela. */
export function nextUnlock(level: number, plan: PlanTier): UnlockView | null {
  return unlocksFor(level, plan).find((item) => item.status !== 'liberado') ?? null
}

// ---------------------------------------------------------------------------
// o que o banco devolve
// ---------------------------------------------------------------------------

export interface XpTransaction {
  readonly id: string
  readonly userId: string
  readonly kind: XpKind
  readonly points: number
  /** Chave única do evento: `task_done:<id>`, `review_done:<semana>`. */
  readonly eventKey: string
  readonly sourceType: string
  readonly sourceId: string | null
  readonly day: DayKey
  readonly createdAt: Date
}

export interface UnlockedAchievement {
  readonly key: AchievementKey
  readonly unlockedAt: Date
}

export interface EvolutionSnapshot {
  readonly xpTotal: number
  readonly level: number
  readonly transactions: readonly XpTransaction[]
  readonly achievements: readonly UnlockedAchievement[]
}

export const EMPTY_EVOLUTION: EvolutionSnapshot = {
  xpTotal: 0,
  level: 1,
  transactions: [],
  achievements: [],
}

// ---------------------------------------------------------------------------
// a leitura da tela
// ---------------------------------------------------------------------------

export interface XpSource {
  readonly kind: XpKind
  readonly label: string
  readonly count: number
  readonly points: number
}

export interface AchievementView extends AchievementSpec {
  readonly unlockedAt: Date | null
}

export interface EvolutionSummary {
  readonly progress: LevelProgress
  readonly weekXp: number
  readonly previousWeekXp: number
  /** Fontes da semana, da maior pra menor. */
  readonly weekSources: readonly XpSource[]
  readonly recent: readonly XpTransaction[]
  readonly achievements: readonly AchievementView[]
  readonly unlocks: readonly UnlockView[]
  readonly nextUnlock: UnlockView | null
  readonly title: string | null
  /** Semanas diferentes com XP ganho. É a régua longa da evolução. */
  readonly weeksInEvolution: number
  /** Dias diferentes com movimento (ação, prioridade ou hábito). */
  readonly activeDays: number
  readonly bestWeekXp: number
  readonly firstDay: DayKey | null
}

const RECENT_LIMIT = 12

export function summarizeEvolution(
  snapshot: EvolutionSnapshot,
  today: DayKey,
  plan: PlanTier,
): EvolutionSummary {
  const progress = levelOf(snapshot.xpTotal)
  const weekStart = startOfWeek(today)
  const previousStart = addDays(weekStart, -7)

  const thisWeek = snapshot.transactions.filter((item) => item.day >= weekStart)
  const previousWeek = snapshot.transactions.filter(
    (item) => item.day >= previousStart && item.day < weekStart,
  )

  const byWeek = new Map<DayKey, number>()
  const activeDays = new Set<DayKey>()
  let firstDay: DayKey | null = null
  for (const item of snapshot.transactions) {
    const week = startOfWeek(item.day)
    byWeek.set(week, (byWeek.get(week) ?? 0) + item.points)
    if (PROGRESS_KINDS.includes(item.kind)) activeDays.add(item.day)
    if (firstDay === null || item.day < firstDay) firstDay = item.day
  }

  const unlocked = new Map(snapshot.achievements.map((item) => [item.key, item.unlockedAt]))

  return {
    progress,
    weekXp: sumPoints(thisWeek),
    previousWeekXp: sumPoints(previousWeek),
    weekSources: sourcesOf(thisWeek),
    recent: [...snapshot.transactions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_LIMIT),
    achievements: ACHIEVEMENTS.map((spec) => ({
      ...spec,
      unlockedAt: unlocked.get(spec.key) ?? null,
    })),
    unlocks: unlocksFor(progress.level, plan),
    nextUnlock: nextUnlock(progress.level, plan),
    title: profileTitleOf(progress.level, plan),
    weeksInEvolution: byWeek.size,
    activeDays: activeDays.size,
    bestWeekXp: Math.max(0, ...byWeek.values()),
    firstDay,
  }
}

function sumPoints(items: readonly XpTransaction[]): number {
  return items.reduce((total, item) => total + item.points, 0)
}

function sourcesOf(items: readonly XpTransaction[]): XpSource[] {
  const byKind = new Map<XpKind, XpSource>()
  for (const item of items) {
    const current = byKind.get(item.kind)
    byKind.set(item.kind, {
      kind: item.kind,
      label: XP_RULES[item.kind].label,
      count: (current?.count ?? 0) + 1,
      points: (current?.points ?? 0) + item.points,
    })
  }
  return [...byKind.values()].sort((a, b) => b.points - a.points)
}

/** A linha de uma transação no histórico: "Ação concluída", "Conquista: Primeira Semana". */
export function transactionLabel(item: XpTransaction): string {
  if (item.kind === 'achievement' && item.sourceId) {
    const key = ACHIEVEMENT_KEYS.find((candidate) => candidate === item.sourceId)
    if (key) return `Conquista: ${achievementSpec(key).name}`
  }
  return XP_RULES[item.kind].label
}

function toRoman(value: number): string {
  const table: readonly [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let rest = value
  let out = ''
  for (const [amount, glyph] of table) {
    while (rest >= amount) {
      out += glyph
      rest -= amount
    }
  }
  return out
}
