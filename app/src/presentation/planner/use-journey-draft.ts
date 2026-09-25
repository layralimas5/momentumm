import { useCallback, useMemo, useState } from 'react'
import { activityType, type ActivityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import { deadlineFrom } from '@/domain/entities/objective'
import {
  buildCombinedPlan,
  MAX_OBJECTIVES_AT_ONCE,
  suggestedTarget,
  type CombinedPlan,
  type ObjectiveSeed,
} from '@/domain/entities/plan-builder'

/** Objetivo sugerido por área, pra a pessoa editar em vez de encarar campo vazio. */
const TITLE_SUGGESTIONS: Readonly<Record<string, string>> = {
  leitura: 'Voltar a ler todo dia',
  estudo: 'Terminar o curso que comecei',
  treino: 'Sair do sedentarismo',
  meditacao: 'Criar uma prática diária de silêncio',
}

/** Área criada pela pessoa usa o próprio nome na sugestão. */
export function suggestedTitleFor(axis: ActivityTypeSlug): string {
  return TITLE_SUGGESTIONS[axis] ?? `Ter constância em ${activityType(axis).label.toLowerCase()}`
}

/** Menos de três dias por semana não constrói hábito, constrói lembrança. */
export const FREQUENCY_OPTIONS = [3, 4, 5, 6, 7] as const

const DEFAULT_DAYS = 60
const DEFAULT_DAYS_PER_WEEK = 5
const DEFAULT_MINUTES_PER_DAY = 30

export interface ObjectiveEntry {
  readonly axis: ActivityTypeSlug
  readonly title: string
  readonly motive: string
  readonly days: number
  /** Texto puro: campo vazio significa "usa o sugerido". */
  readonly target: string
}

export interface EntryView extends ObjectiveEntry {
  readonly suggestedTitle: string
  /** Alvo sugerido pro prazo e pro tempo declarado. */
  readonly suggested: number
  readonly finalTarget: number
}

export interface JourneyDraftState {
  readonly entries: readonly EntryView[]
  readonly minutesPerDay: number
  readonly daysPerWeek: number
  /** Áreas que ainda podem receber um objetivo novo. */
  readonly availableAxes: readonly ActivityTypeSlug[]
  readonly canAddMore: boolean
  readonly combined: CombinedPlan
  addObjective(axis: ActivityTypeSlug): void
  removeObjective(axis: ActivityTypeSlug): void
  updateObjective(axis: ActivityTypeSlug, changes: Partial<ObjectiveEntry>): void
  setMinutesPerDay(minutes: number): void
  setDaysPerWeek(days: number): void
}

interface Options {
  /** Todas as áreas disponíveis, incluindo as que a pessoa criou. */
  readonly axes: readonly ActivityType[]
  /** Áreas sem vaga pra outro objetivo. Quem calcula é `planUsageOf`, pelo plano. */
  readonly takenAxes?: readonly ActivityTypeSlug[]
  /** Quantos objetivos podem ser criados de uma vez. O diálogo usa 1. */
  readonly max?: number
}

/**
 * O rascunho da jornada: um ou mais objetivos e o plano que sai deles.
 *
 * Mora aqui porque o onboarding e a criação de um objetivo novo fazem a mesma
 * coisa com layouts diferentes — o onboarding em passos e com várias áreas, o
 * diálogo numa tela só e com uma. Duplicar esse estado seria duplicar a regra
 * de qual plano nasce de quais respostas, e é exatamente aí que dois caminhos
 * começam a divergir.
 *
 * O tempo por dia é do conjunto, não de cada objetivo: é o dia da pessoa que
 * está sendo dividido, e é essa divisão que faz o app dizer quando não cabe.
 */
export function useJourneyDraft(today: DayKey, options: Options): JourneyDraftState {
  const { axes } = options
  const takenAxes = useMemo(() => options.takenAxes ?? [], [options.takenAxes])
  const max = Math.min(options.max ?? MAX_OBJECTIVES_AT_ONCE, MAX_OBJECTIVES_AT_ONCE)

  /*
    A área inicial é a primeira LIVRE, e quando não existe nenhuma o rascunho
    nasce VAZIO — nunca num eixo qualquer.

    Aqui morava um `?? 'leitura'`. Numa conta com objetivo em todas as áreas de
    fábrica, ele abria o diálogo apontando pra Leitura, que é justamente uma das
    ocupadas: o cartão dela vinha desabilitado por estar tomada, os outros por
    não caberem, e o botão de criar vinha desabilitado pelo aviso de conflito. O
    formulário ficava preso numa área que a pessoa não escolheu e não conseguia
    trocar. Sem entrada nenhuma o diálogo mostra o vazio que explica o que fazer,
    e é essa a diferença entre um app sem espaço e um app travado.

    Numa conta PRO isso deixa de acontecer por outro motivo: `takenAxes` chega
    vazio, porque o plano dela não tem teto por eixo.
  */
  const [entries, setEntries] = useState<readonly ObjectiveEntry[]>(() => {
    const first = axes.find((axis) => !takenAxes.includes(axis.slug))?.slug
    return first ? [newEntry(first)] : []
  })
  const [minutesPerDay, setMinutesPerDay] = useState(DEFAULT_MINUTES_PER_DAY)
  const [daysPerWeek, setDaysPerWeek] = useState(DEFAULT_DAYS_PER_WEEK)

  const addObjective = useCallback(
    (axis: ActivityTypeSlug) => {
      setEntries((current) => withAxisAdded(current, axis, max))
    },
    [max],
  )

  const removeObjective = useCallback((axis: ActivityTypeSlug) => {
    // Nunca esvazia: sem objetivo não existe plano, e sem plano o onboarding
    // não cumpre a função dele.
    setEntries((current) =>
      current.length <= 1 ? current : current.filter((entry) => entry.axis !== axis),
    )
  }, [])

  const updateObjective = useCallback(
    (axis: ActivityTypeSlug, changes: Partial<ObjectiveEntry>) => {
      setEntries((current) => {
        // Trocar de área é permitido, desde que a nova não esteja JÁ NESTE
        // rascunho: duas entradas no mesmo eixo virariam dois cartões idênticos
        // no seletor. Área cheia pelo plano é barrada antes, por `taken`.
        if (changes.axis && changes.axis !== axis) {
          if (current.some((entry) => entry.axis === changes.axis)) return current
        }
        return current.map((entry) => (entry.axis === axis ? { ...entry, ...changes } : entry))
      })
    },
    [],
  )

  const views = useMemo<EntryView[]>(
    () =>
      entries.map((entry) => {
        // O alvo sugerido usa a fatia de tempo deste objetivo, não o dia todo.
        const share = minutesPerDay / Math.max(1, entries.length)
        const suggested = suggestedTarget(entry.axis, entry.days, share, daysPerWeek)
        return {
          ...entry,
          suggestedTitle: suggestedTitleFor(entry.axis),
          suggested,
          finalTarget: Number(entry.target) > 0 ? Number(entry.target) : suggested,
        }
      }),
    [entries, minutesPerDay, daysPerWeek],
  )

  const combined = useMemo(() => {
    const seeds: ObjectiveSeed[] = views.map((entry) => ({
      axis: entry.axis,
      title: entry.title.trim() || entry.suggestedTitle,
      target: entry.finalTarget,
      deadline: deadlineFrom(today, entry.days),
      motive: entry.motive.trim() || null,
    }))

    return buildCombinedPlan({ seeds, today, daysPerWeek, minutesPerDay })
  }, [views, today, daysPerWeek, minutesPerDay])

  const availableAxes = useMemo(
    () =>
      axes
        .filter(
          (axis) =>
            !takenAxes.includes(axis.slug) && !entries.some((entry) => entry.axis === axis.slug),
        )
        .map((axis) => axis.slug),
    [axes, takenAxes, entries],
  )

  return {
    entries: views,
    minutesPerDay,
    daysPerWeek,
    availableAxes,
    canAddMore: entries.length < max && availableAxes.length > 0,
    combined,
    addObjective,
    removeObjective,
    updateObjective,
    setMinutesPerDay,
    setDaysPerWeek,
  }
}

function newEntry(axis: ActivityTypeSlug): ObjectiveEntry {
  return { axis, title: '', motive: '', days: DEFAULT_DAYS, target: '' }
}

/**
 * O que acontece com o rascunho quando a pessoa escolhe uma área.
 *
 * Está fora do hook pra poder ser testada: aqui morava o bug de "a área fica
 * presa em Leitura". Com `max` em 1 — que é o caso do diálogo de objetivo novo —
 * a guarda `current.length >= max` era verdade em TODO clique, então a função
 * devolvia o estado intocado e o cartão da área nova não fazia nada. Trocar de
 * área precisa vir antes de qualquer guarda de tamanho, porque trocar não
 * aumenta o rascunho.
 */
export function withAxisAdded(
  current: readonly ObjectiveEntry[],
  axis: ActivityTypeSlug,
  max: number,
): readonly ObjectiveEntry[] {
  if (current.some((entry) => entry.axis === axis)) return current
  if (max === 1) return [newEntry(axis)]
  if (current.length >= max) return current
  return [...current, newEntry(axis)]
}
