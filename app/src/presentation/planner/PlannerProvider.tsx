import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, NewActivityInput } from '@/domain/entities/activity'
import {
  activityTypeList,
  registerCustomActivityTypes,
  type ActivityType,
} from '@/domain/entities/activity-type'
import { sortByRecent } from '@/domain/entities/activity'
import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'
import { dayKeyOf, type DayKey } from '@/domain/entities/day'
import { isActive, progressOf, type Goal, type NewGoalInput } from '@/domain/entities/goal'
import {
  countsAsDone,
  type Habit,
  type HabitLog,
  type HabitStatus,
  type NewHabitInput,
} from '@/domain/entities/habit'
import {
  isActiveObjective,
  progressOfObjective,
  type NewObjectiveInput,
  type Objective,
} from '@/domain/entities/objective'
import {
  sortEventsByRecent,
  type JourneyEvent,
  type JourneyVisibility,
  type NewJourneyEventInput,
} from '@/domain/entities/journey-event'
import { limitsOf } from '@/domain/entities/plan'
import { planProgressOf } from '@/domain/entities/plan-progress'
import {
  assertStageBelongsTo,
  rebalanceWeights,
  stagesOfObjective,
  type NewPlanStageInput,
  type PlanStage,
} from '@/domain/entities/plan-stage'
import type { PlanDraft } from '@/domain/entities/plan-builder'
import { calculateStreakFromDays } from '@/domain/entities/streak'
import { completeTask, reopenTask, type NewTaskInput, type Task } from '@/domain/entities/task'
import type { NewWinInput, Win } from '@/domain/entities/win'
import type { WeeklyReview, WeeklyReviewDraft } from '@/domain/entities/weekly-review'
import type { HabitUpdate } from '@/domain/repositories/habit-repository'
import type { ObjectiveUpdate } from '@/domain/repositories/objective-repository'
import type { PlanStageUpdate } from '@/domain/repositories/plan-stage-repository'
import type { TaskReorder, TaskUpdate } from '@/domain/repositories/task-repository'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { DomainError, toUserMessage } from '@/shared/errors'
import { PlannerContext, type PlannerState } from './planner-context'

interface Snapshot {
  readonly customAxes: ActivityType[]
  readonly activities: Activity[]
  readonly objectives: Objective[]
  readonly planStages: PlanStage[]
  readonly goals: Goal[]
  readonly habits: Habit[]
  readonly habitLogs: HabitLog[]
  readonly tasks: Task[]
  readonly checkIns: CheckIn[]
  readonly wins: Win[]
  readonly weeklyReviews: WeeklyReview[]
  readonly journeyEvents: JourneyEvent[]
}

/** Aba parada por mais que isso volta lendo o servidor de novo. */
const RESYNC_AFTER_MS = 60_000

const EMPTY: Snapshot = {
  customAxes: [],
  activities: [],
  objectives: [],
  planStages: [],
  goals: [],
  habits: [],
  habitLogs: [],
  tasks: [],
  checkIns: [],
  wins: [],
  weeklyReviews: [],
  journeyEvents: [],
}

/**
 * Carrega o planejamento inteiro de uma vez e mantém tudo em um estado só.
 *
 * Uma busca por tela criaria dashboards que discordam entre si — a meta diria
 * uma coisa e o progresso diria outra. Aqui a fonte é única e as escritas são
 * otimistas: a tela responde na hora e volta atrás se o servidor recusar.
 */
export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const loadedAt = useRef<number | null>(null)
  const mounted = useRef(true)

  /*
    O estado como ele está AGORA, e não como estava no render.

    Criar várias etapas em sequência (o plano de um objetivo novo, a sugestão
    da IA) acontece dentro de um `for` no mesmo tick: `data` não muda entre as
    voltas, então a segunda etapa enxergaria um objetivo sem irmãs e o peso do
    conjunto sairia somando muito mais que 100 na tela até o próximo reload.
  */
  const snapshot = useRef<Snapshot>(EMPTY)
  snapshot.current = data

  // Recalculado a cada render: o app aberto virando o dia acompanha a data.
  const today = dayKeyOf(new Date())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  /**
   * Carrega tudo de uma vez. `silent` é a re-sincronização: os dados atuais
   * continuam na tela enquanto os novos chegam, em vez de trocar o app por um
   * esqueleto porque a pessoa voltou de outra aba.
   */
  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!user) {
      setData(EMPTY)
      setLoading(false)
      return
    }

    if (silent) setSyncing(true)
    else setLoading(true)
    try {
      const [
        customAxes,
        activities,
        objectives,
        planStages,
        goals,
        habits,
        habitLogs,
        tasks,
        checkIns,
        wins,
        weeklyReviews,
        journeyEvents,
      ] = await Promise.all([
        container.activityTypes.listCustom(user.id),
        container.activities.listByUser(user.id),
        container.objectives.listByUser(user.id),
        container.planStages.listByUser(user.id),
        container.goals.listByUser(user.id),
        container.habits.listByUser(user.id),
        container.habits.listLogs(user.id),
        container.tasks.listByUser(user.id),
        container.checkIns.listByUser(user.id),
        container.wins.listByUser(user.id),
        container.weeklyReviews.listByUser(user.id),
        container.journeyEvents.listByUser(user.id),
      ])

      if (!mounted.current) return

      // Antes do setData: qualquer tela que renderizar já precisa saber
      // traduzir o slug de uma área criada em nome e cor.
      registerCustomActivityTypes(customAxes)

      setData({
        customAxes,
        activities: sortByRecent(activities),
        objectives: objectives.filter(isActiveObjective),
        planStages,
        goals: goals.filter(isActive),
        habits,
        habitLogs,
        tasks,
        checkIns,
        wins,
        weeklyReviews,
        journeyEvents: sortEventsByRecent(journeyEvents),
      })
      loadedAt.current = Date.now()
      setError(null)
    } catch (cause) {
      if (mounted.current) setError(toUserMessage(cause))
    } finally {
      if (mounted.current) {
        setLoading(false)
        setSyncing(false)
      }
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  /*
    Re-sincronização. O provider carregava uma vez por sessão, e o app aberto
    no celular desde ontem mostrava o dia de ontem: o que foi marcado em outro
    aparelho, ou depois de a rede cair, só aparecia num F5. Duas portas:
    voltar a ficar online, e voltar pra aba depois de um tempo parado.
  */
  useEffect(() => {
    const resync = () => {
      if (!navigator.onLine) return
      void reload({ silent: true })
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const age = loadedAt.current === null ? Infinity : Date.now() - loadedAt.current
      if (age >= RESYNC_AFTER_MS) resync()
    }

    window.addEventListener('online', resync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', resync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  /** Escrita otimista: aplica, e se o servidor recusar volta ao estado anterior. */
  const mutate = useCallback(
    async (optimistic: (current: Snapshot) => Snapshot, persist: () => Promise<void>) => {
      let previous: Snapshot = EMPTY
      setData((current) => {
        previous = current
        return optimistic(current)
      })
      try {
        await persist()
        setError(null)
      } catch (cause) {
        setData(previous)
        setError(toUserMessage(cause))
        throw cause
      }
    },
    [],
  )

  const logActivity = useCallback(
    async (input: Omit<NewActivityInput, 'userId'>) => {
      if (!user) return
      const created = await container.activities.create({
        userId: user.id,
        visibility: profile?.defaultVisibility ?? 'publica',
        ...input,
      })
      setData((current) => ({
        ...current,
        activities: sortByRecent([created, ...current.activities]),
      }))
      setError(null)
    },
    [user, profile],
  )

  const removeActivity = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          activities: current.activities.filter((activity) => activity.id !== id),
        }),
        () => container.activities.remove(id, user.id),
      )
    },
    [user, mutate],
  )

  const createAxis = useCallback(
    async (label: string): Promise<ActivityType | null> => {
      if (!user) return null

      const axis = await container.activityTypes.createCustom({
        userId: user.id,
        label,
        order: data.customAxes.length,
      })

      const next = [...data.customAxes, axis]
      registerCustomActivityTypes(next)
      setData((current) => ({ ...current, customAxes: next }))
      setError(null)
      return axis
    },
    [user, data.customAxes],
  )

  const createObjective = useCallback(
    async (input: Omit<NewObjectiveInput, 'userId'>): Promise<Objective | null> => {
      if (!user) return null
      const objective = await container.objectives.create({ userId: user.id, ...input })
      setData((current) => ({ ...current, objectives: [...current.objectives, objective] }))
      setError(null)
      return objective
    },
    [user],
  )

  const updateObjective = useCallback(
    async (id: string, changes: ObjectiveUpdate) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          objectives: current.objectives.map((objective) =>
            objective.id === id ? { ...objective, ...changes } : objective,
          ),
        }),
        () => container.objectives.update(id, user.id, changes),
      )
    },
    [user, mutate],
  )

  /**
   * Arquivar o objetivo leva o plano dele junto.
   *
   * Etapa não existe fora do objetivo: uma etapa órfã não significa nada e não
   * aparece em lugar nenhum. Ação e hábito NÃO somem — eles perdem só o
   * vínculo com a etapa, porque são trabalho registrado e histórico. É a mesma
   * regra do banco (`cascade` na etapa, `set null` na ação).
   */
  const archiveObjective = useCallback(
    async (id: string) => {
      if (!user) return
      const orphans = new Set(
        data.planStages.filter((stage) => stage.objectiveId === id).map((stage) => stage.id),
      )

      await mutate(
        (current) => ({
          ...current,
          objectives: current.objectives.filter((objective) => objective.id !== id),
          planStages: current.planStages.filter((stage) => stage.objectiveId !== id),
          tasks: current.tasks.map((task) =>
            task.stageId && orphans.has(task.stageId) ? { ...task, stageId: null } : task,
          ),
          habits: current.habits.map((habit) =>
            habit.stageId && orphans.has(habit.stageId) ? { ...habit, stageId: null } : habit,
          ),
        }),
        () => container.objectives.archive(id, user.id),
      )
    },
    [user, data.planStages, mutate],
  )

  const setObjectivePaused = useCallback(
    async (id: string, paused: boolean) => {
      await updateObjective(id, { pausedAt: paused ? new Date() : null })
    },
    [updateObjective],
  )

  /**
   * Concluir o objetivo e limpar o rastro dele no plano.
   *
   * As ações em aberto são canceladas, não apagadas: elas são o registro do que
   * ficou pra trás e a review usa isso. Reabrir só devolve o objetivo — as
   * ações canceladas ficam canceladas, porque ressuscitar tarefa antiga de
   * surpresa é a forma mais rápida de encher o dia de coisa que ninguém pediu.
   */
  /**
   * Grava um momento da jornada.
   *
   * Nunca derruba a ação que o disparou: se a gravação falhar, o objetivo
   * continua concluído e o review continua salvo. O evento é um subproduto —
   * perder um deles é aceitável, perder a conclusão do objetivo não é.
   *
   * A escrita é idempotente por (tipo, origem, dia), então repetir a mesma
   * transição atualiza a linha em vez de empilhar.
   */
  const recordJourneyEvent = useCallback(
    async (input: Omit<NewJourneyEventInput, 'userId'>): Promise<void> => {
      if (!user) return
      try {
        const event = await container.journeyEvents.record({ ...input, userId: user.id })
        setData((current) => ({
          ...current,
          journeyEvents: sortEventsByRecent([
            event,
            ...current.journeyEvents.filter((item) => item.id !== event.id),
          ]),
        }))
      } catch {
        // Silêncio de propósito: ver "falha ao salvar" depois de concluir um
        // objetivo faria a pessoa achar que a conclusão não foi gravada.
      }
    },
    [user],
  )

  /**
   * Muda quem vê um momento.
   *
   * É a ÚNICA porta pra um evento deixar de ser privado, e ela só é chamada
   * onde a pessoa toca. Nenhuma regra do app promove visibilidade sozinha —
   * nem o gravador, nem o Share Studio, nem aceitar uma amizade.
   */
  const setEventVisibility = useCallback(
    async (id: string, visibility: JourneyVisibility) => {
      if (!user) return

      await mutate(
        (current) => ({
          ...current,
          journeyEvents: current.journeyEvents.map((event) =>
            event.id === id ? { ...event, visibility } : event,
          ),
        }),
        async () => {
          await container.journeyEvents.setVisibility(id, user.id, visibility)
        },
      )
    },
    [user, mutate],
  )

  const completeObjective = useCallback(
    async (id: string, done: boolean) => {
      if (!user) return

      await updateObjective(id, { completedAt: done ? new Date() : null })
      if (!done) return

      const objective = data.objectives.find((item) => item.id === id)
      if (objective) {
        void recordJourneyEvent({
          type: 'goal_completed',
          sourceType: 'objective',
          sourceId: objective.id,
          title: objective.title,
          completionPercentage: 1,
          progressAfter: 1,
          metadata: { axis: objective.axis },
        })
      }

      const open = data.tasks.filter(
        (task) => task.objectiveId === id && (task.status === 'pendente' || task.status === 'em-andamento'),
      )

      for (const task of open) {
        await container.tasks.update(task.id, user.id, {
          status: 'cancelada',
          isMainPriority: false,
        })
      }

      if (open.length > 0) {
        const ids = new Set(open.map((task) => task.id))
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            ids.has(task.id) ? { ...task, status: 'cancelada', isMainPriority: false } : task,
          ),
        }))
      }
    },
    [user, data.tasks, data.objectives, updateObjective, recordJourneyEvent],
  )

  /**
   * Cria a etapa e reequilibra os pesos do objetivo.
   *
   * O peso é propriedade do CONJUNTO: criar a quarta etapa muda o valor das
   * outras três. Gravar só a nova deixaria o plano somando 133% até alguém
   * abrir a tela de pesos — e uma barra de progresso passando de 100 destrói a
   * confiança em todos os outros números da tela junto.
   */
  const createStage = useCallback(
    async (input: Omit<NewPlanStageInput, 'userId'>): Promise<PlanStage | null> => {
      if (!user) return null

      const siblings = stagesOfObjective(snapshot.current.planStages, input.objectiveId)
      const created = await container.planStages.create({
        userId: user.id,
        ...input,
        order: input.order ?? siblings.length,
      })

      const balanced =
        input.weight === undefined ? rebalanceWeights([...siblings, created]) : [...siblings, created]

      /*
        Sem peso informado, o conjunto é sempre reescrito — inclusive quando a
        etapa é a primeira. O repositório demo já rebalanceia sozinho no insert,
        o Supabase não: pular essa chamada faria a primeira etapa nascer valendo
        100% num lugar e 0% no outro, e o mesmo objetivo mostraria progressos
        diferentes conforme o modo em que a conta roda.
      */
      if (input.weight === undefined) {
        await container.planStages.reweight(
          user.id,
          balanced.map((stage) => ({ id: stage.id, order: stage.order, weight: stage.weight })),
        )
      }

      const byId = new Map(balanced.map((stage) => [stage.id, stage]))
      const result = byId.get(created.id) ?? created
      setData((current) => ({
        ...current,
        planStages: [...current.planStages.map((stage) => byId.get(stage.id) ?? stage), result],
      }))
      snapshot.current = {
        ...snapshot.current,
        planStages: [
          ...snapshot.current.planStages.map((stage) => byId.get(stage.id) ?? stage),
          result,
        ],
      }
      setError(null)
      return result
    },
    [user],
  )

  const updateStage = useCallback(
    async (id: string, changes: PlanStageUpdate) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          planStages: current.planStages.map((stage) =>
            stage.id === id ? { ...stage, ...changes } : stage,
          ),
        }),
        async () => {
          await container.planStages.update(id, user.id, changes)
        },
      )
    },
    [user, mutate],
  )

  /**
   * Concluir e reabrir a etapa. A data de conclusão anda junto com o estado:
   * etapa concluída sem carimbo quebraria a série que a previsão usa pra medir
   * velocidade.
   */
  const completeStage = useCallback(
    async (id: string, done: boolean) => {
      await updateStage(id, {
        status: done ? 'concluida' : 'em-andamento',
        completedAt: done ? new Date() : null,
      })
    },
    [updateStage],
  )

  /** Reordena e repesa em uma operação: os pesos precisam somar 100 sempre. */
  const reweightStages = useCallback(
    async (objectiveId: string, stages: readonly PlanStage[]) => {
      if (!user) return
      const items = stages.map((stage) => ({
        id: stage.id,
        order: stage.order,
        weight: stage.weight,
      }))
      const byId = new Map(items.map((item) => [item.id, item]))

      await mutate(
        (current) => ({
          ...current,
          planStages: current.planStages.map((stage) => {
            const change = byId.get(stage.id)
            return change ? { ...stage, order: change.order, weight: change.weight } : stage
          }),
        }),
        () => container.planStages.reweight(user.id, items),
      )

      // Silencia o lint sobre o parâmetro: ele existe pra deixar a chamada
      // legível no ponto de uso, onde "repesar as etapas DESSE objetivo" é a
      // informação que importa.
      void objectiveId
    },
    [user, mutate],
  )

  /**
   * Apagar a etapa não apaga o trabalho.
   *
   * As ações voltam pro objetivo sem etapa, onde a pessoa decide o destino —
   * apagar tarefa junto com uma reorganização é a forma mais rápida de alguém
   * perder confiança no app. Os pesos das que sobraram são reequilibrados.
   */
  const removeStage = useCallback(
    async (id: string) => {
      if (!user) return
      const target = data.planStages.find((stage) => stage.id === id)
      if (!target) return

      const remaining = rebalanceWeights(
        stagesOfObjective(data.planStages, target.objectiveId).filter((stage) => stage.id !== id),
      )
      const byId = new Map(remaining.map((stage) => [stage.id, stage]))

      await mutate(
        (current) => ({
          ...current,
          planStages: current.planStages
            .filter((stage) => stage.id !== id)
            .map((stage) => byId.get(stage.id) ?? stage),
          tasks: current.tasks.map((task) =>
            task.stageId === id ? { ...task, stageId: null } : task,
          ),
          habits: current.habits.map((habit) =>
            habit.stageId === id ? { ...habit, stageId: null } : habit,
          ),
        }),
        async () => {
          await container.planStages.remove(id, user.id)
          if (remaining.length > 0) {
            await container.planStages.reweight(
              user.id,
              remaining.map((stage) => ({
                id: stage.id,
                order: stage.order,
                weight: stage.weight,
              })),
            )
          }
        },
      )
    },
    [user, data.planStages, mutate],
  )

  const createGoal = useCallback(
    async (input: Omit<NewGoalInput, 'userId'>): Promise<Goal | null> => {
      if (!user) return null
      const goal = await container.goals.create({ userId: user.id, ...input })
      setData((current) => ({ ...current, goals: [...current.goals, goal] }))
      setError(null)
      return goal
    },
    [user],
  )

  const archiveGoal = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          goals: current.goals.filter((goal) => goal.id !== id),
          // A ação órfã continua existindo, só perde o vínculo com a meta.
          tasks: current.tasks.map((task) =>
            task.goalId === id ? { ...task, goalId: null } : task,
          ),
        }),
        () => container.goals.archive(id, user.id),
      )
    },
    [user, mutate],
  )

  /**
   * A etapa e o objetivo precisam combinar.
   *
   * Uma ação de leitura pendurada numa etapa de treino faz o progresso dos DOIS
   * objetivos mentir ao mesmo tempo, e o erro é invisível: nada quebra, a barra
   * só passa a andar errado. Por isso a checagem acontece aqui, antes de gravar,
   * além do trigger que o banco tem pra quem não passa pelo app.
   *
   * Quando só a etapa vem preenchida, o objetivo é deduzido dela em vez de
   * recusado: escolher a etapa já é escolher o objetivo.
   */
  const resolveStage = useCallback(
    (objectiveId: string | null | undefined, stageId: string | null | undefined) => {
      if (!stageId) return { objectiveId: objectiveId ?? null, stageId: null }

      /*
        Do snapshot, não do render: a ação que nasce junto com a etapa (plano de
        um objetivo novo, sugestão da IA) é gravada no mesmo tick em que a etapa
        foi criada, e ler `data` aqui recusaria como inexistente uma etapa que
        acabou de ser gravada — derrubando a criação do plano no meio.
      */
      const stage = snapshot.current.planStages.find((item) => item.id === stageId)
      if (!stage) throw new DomainError('Essa etapa não existe mais.')

      if (!objectiveId) return { objectiveId: stage.objectiveId, stageId }

      assertStageBelongsTo(stage, objectiveId)
      return { objectiveId, stageId }
    },
    [],
  )

  const createHabit = useCallback(
    async (input: Omit<NewHabitInput, 'userId'>): Promise<Habit | null> => {
      if (!user) return null
      const link = resolveStage(input.objectiveId, input.stageId)
      const habit = await container.habits.create({ userId: user.id, ...input, ...link })
      setData((current) => ({ ...current, habits: [...current.habits, habit] }))
      setError(null)
      return habit
    },
    [user, resolveStage],
  )

  const updateHabit = useCallback(
    async (id: string, changes: HabitUpdate) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          habits: current.habits.map((habit) =>
            habit.id === id ? { ...habit, ...changes } : habit,
          ),
        }),
        async () => {
          await container.habits.update(id, user.id, changes)
        },
      )
    },
    [user, mutate],
  )

  const setHabitPaused = useCallback(
    async (id: string, paused: boolean) => {
      await updateHabit(id, { pausedAt: paused ? new Date() : null })
    },
    [updateHabit],
  )

  const archiveHabit = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({ ...current, habits: current.habits.filter((habit) => habit.id !== id) }),
        () => container.habits.archive(id, user.id),
      )
    },
    [user, mutate],
  )

  const setHabitStatus = useCallback(
    async (habitId: string, status: HabitStatus, day: DayKey = today) => {
      if (!user) return

      const optimisticLog: HabitLog = {
        id: `optimistic-${habitId}-${day}`,
        userId: user.id,
        habitId,
        day,
        status,
        createdAt: new Date(),
      }

      await mutate(
        (current) => {
          const withoutDay = current.habitLogs.filter(
            (log) => !(log.habitId === habitId && log.day === day),
          )
          // Voltar pra pendente é desfazer: o registro some em vez de virar histórico.
          return {
            ...current,
            habitLogs: status === 'pendente' ? withoutDay : [...withoutDay, optimisticLog],
          }
        },
        async () => {
          const saved = await container.habits.setStatus(user.id, habitId, day, status)
          if (status === 'pendente') return
          setData((current) => ({
            ...current,
            habitLogs: current.habitLogs.map((log) => (log.id === optimisticLog.id ? saved : log)),
          }))
        },
      )
    },
    [user, today, mutate],
  )

  const createTask = useCallback(
    async (input: Omit<NewTaskInput, 'userId'>): Promise<Task | null> => {
      if (!user) return null
      const link = resolveStage(input.objectiveId, input.stageId)
      const task = await container.tasks.create({ userId: user.id, ...input, ...link })
      setData((current) => ({
        ...current,
        tasks: [
          ...(task.isMainPriority
            ? current.tasks.map((item) =>
                item.day === task.day ? { ...item, isMainPriority: false } : item,
              )
            : current.tasks),
          task,
        ],
      }))
      setError(null)
      return task
    },
    [user, resolveStage],
  )

  const updateTask = useCallback(
    async (id: string, changes: TaskUpdate) => {
      if (!user) return

      if (changes.stageId !== undefined || changes.objectiveId !== undefined) {
        const target = data.tasks.find((task) => task.id === id)
        const nextObjective =
          changes.objectiveId !== undefined ? changes.objectiveId : (target?.objectiveId ?? null)
        const nextStage =
          changes.stageId !== undefined ? changes.stageId : (target?.stageId ?? null)
        const link = resolveStage(nextObjective, nextStage)
        changes = { ...changes, ...link }
      }

      await mutate(
        (current) => {
          const target = current.tasks.find((task) => task.id === id)
          if (!target) return current
          const updated: Task = { ...target, ...changes }
          return {
            ...current,
            tasks: current.tasks.map((task) => {
              if (task.id === id) return updated
              if (updated.isMainPriority && task.day === updated.day) {
                return { ...task, isMainPriority: false }
              }
              return task
            }),
          }
        },
        async () => {
          await container.tasks.update(id, user.id, changes)
        },
      )
    },
    [user, data.tasks, mutate, resolveStage],
  )

  /**
   * Concluir ou reabrir uma ação. É por aqui que TODA conclusão passa.
   *
   * O domínio é quem carimba a data — `completeTask` e `reopenTask` — em vez de
   * cada tela montar o objeto na mão. Duas telas construindo o mesmo estado é
   * como nasce a ação concluída sem `completedAt`, que some da série da
   * previsão sem nenhum erro aparecer.
   *
   * O resto da cadeia acontece sozinho: progresso da etapa, do objetivo, do
   * dia, do período, momentum, previsão e insights derivam desse mesmo estado
   * por `useMemo`. Não existe cópia pra sincronizar.
   */
  const setTaskDone = useCallback(
    async (id: string, done: boolean) => {
      const target = data.tasks.find((task) => task.id === id)
      if (!target) return

      const next = done ? completeTask(target) : reopenTask(target)
      await updateTask(id, { status: next.status, completedAt: next.completedAt })

      if (!done || !target.stageId) return

      // Primeira ação concluída tira a etapa de "não iniciada". É o único
      // avanço automático que existe: fechar a etapa continua sendo decisão da
      // pessoa, porque só ela sabe se o que faltava acontecia fora do app.
      const stage = data.planStages.find((item) => item.id === target.stageId)
      if (stage && stage.status === 'nao-iniciada') {
        await updateStage(stage.id, { status: 'em-andamento' })
      }
    },
    [data.tasks, data.planStages, updateTask, updateStage],
  )

  const reorderTasks = useCallback(
    async (items: readonly TaskReorder[]) => {
      if (!user || items.length === 0) return
      const order = new Map(items.map((item) => [item.id, item.order]))
      await mutate(
        (current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            order.has(task.id) ? { ...task, order: order.get(task.id) ?? task.order } : task,
          ),
        }),
        () => container.tasks.reorder(user.id, items),
      )
    },
    [user, mutate],
  )

  const removeTask = useCallback(
    async (id: string) => {
      if (!user) return
      await mutate(
        (current) => ({
          ...current,
          // O vínculo de dependência morre junto: senão a próxima ação fica
          // travada por uma que não existe mais.
          tasks: current.tasks
            .filter((task) => task.id !== id)
            .map((task) => (task.dependsOnId === id ? { ...task, dependsOnId: null } : task)),
        }),
        () => container.tasks.remove(id, user.id),
      )
    },
    [user, mutate],
  )

  const saveCheckIn = useCallback(
    async (input: Omit<NewCheckInInput, 'userId'>) => {
      if (!user) return
      const checkIn = await container.checkIns.save({ userId: user.id, ...input })
      setData((current) => ({
        ...current,
        checkIns: [
          ...current.checkIns.filter((item) => item.day !== checkIn.day),
          checkIn,
        ],
      }))
      setError(null)
    },
    [user],
  )

  const saveWin = useCallback(
    async (input: Omit<NewWinInput, 'userId'>) => {
      if (!user) return
      const win = await container.wins.save({ userId: user.id, ...input })
      setData((current) => ({
        ...current,
        wins: [...current.wins.filter((item) => item.day !== win.day), win],
      }))
      setError(null)
    },
    [user],
  )

  const saveWeeklyReview = useCallback(
    async (weekStart: DayKey, draft: WeeklyReviewDraft) => {
      if (!user) return
      const saved = await container.weeklyReviews.save(user.id, weekStart, draft)
      setData((current) => ({
        ...current,
        weeklyReviews: [
          ...current.weeklyReviews.filter((item) => item.weekStart !== weekStart),
          saved,
        ],
      }))
      setError(null)

      // Só a CONCLUSÃO vira momento. O review salva a cada passo, e gravar em
      // cada um deles encheria o histórico de nove versões da mesma semana.
      if (draft.completedAt) {
        void recordJourneyEvent({
          type: 'weekly_review',
          sourceType: 'week',
          sourceId: weekStart,
          title: 'Minha semana',
        })
      }
    },
    [user, recordJourneyEvent],
  )

  /**
   * Os planos gerados no onboarding virando dado de verdade.
   *
   * A ordem dentro de cada plano importa: o objetivo primeiro (é ele que pode
   * ser recusado por já existir um ativo no eixo), depois o ritmo semanal,
   * depois os hábitos e por último as ações — que nascem já apontando pra meta
   * criada, senão o card de "próxima ação" da meta nasceria vazio.
   *
   * Só a primeira ação do primeiro plano fica como prioridade principal: a
   * regra do produto é uma por dia, e três objetivos não podem virar três
   * prioridades disputando o mesmo dia.
   */
  const applyPlan = useCallback(
    async (plans: readonly PlanDraft[]) => {
      if (!user) return

      let priorityTaken = false

      for (const plan of plans) {
        // O objetivo vem primeiro porque hábitos e ações nascem apontando pra
        // ele: é esse vínculo que faz o `Hoje` conseguir dizer pra que serve
        // cada linha, em vez de mostrar uma lista de tarefas soltas.
        const objective = await createObjective(plan.objective)
        const goal = await createGoal(plan.goal).catch(() => null)

        /*
          As etapas vêm antes das ações porque cada ação nasce dentro de uma.
          Sem esse passo o objetivo nasceria como uma lista: a barra mediria
          volume registrado em vez de caminho percorrido, e gargalo, previsão e
          as regras de insight que leem etapa ficariam todas de fora — no
          objetivo recém-criado, que é justamente onde o plano importa mais.
        */
        const stageIds: (string | null)[] = []
        if (objective) {
          for (const [index, stage] of plan.stages.entries()) {
            const created = await createStage({
              objectiveId: objective.id,
              title: stage.title,
              description: stage.description,
              order: index,
              weight: stage.weight,
              dueOn: stage.dueOn,
            })
            stageIds.push(created?.id ?? null)
          }
        }

        for (const habit of plan.habits) {
          await createHabit({ ...habit, objectiveId: objective?.id ?? null })
        }

        let order = 0
        for (const task of plan.tasks) {
          const { stageIndex, ...fields } = task
          const isMainPriority = (fields.isMainPriority ?? false) && !priorityTaken
          if (isMainPriority) priorityTaken = true
          await createTask({
            ...fields,
            isMainPriority,
            goalId: goal?.id ?? null,
            objectiveId: objective?.id ?? null,
            stageId: stageIndex === null ? null : (stageIds[stageIndex] ?? null),
            order: order++,
          })
        }
      }
    },
    [user, createObjective, createGoal, createStage, createHabit, createTask],
  )

  const todayActivities = useMemo(
    () => data.activities.filter((activity) => activity.day === today),
    [data.activities, today],
  )

  /**
   * Dia com movimento é dia com atividade OU com hábito cumprido. Contar só
   * atividade zeraria a sequência de quem manteve os hábitos do dia.
   */
  const streak = useMemo(() => {
    const days = new Set<DayKey>(data.activities.map((activity) => activity.day))
    for (const log of data.habitLogs) {
      if (countsAsDone(log.status)) days.add(log.day)
    }
    return calculateStreakFromDays(days, today)
  }, [data.activities, data.habitLogs, today])

  const goalProgress = useMemo(
    () => data.goals.map((goal) => progressOf(goal, data.activities, today)),
    [data.goals, data.activities, today],
  )

  // Recalculado quando as áreas mudam: o registro global já foi atualizado, e
  // é essa dependência que faz a tela redesenhar com a área nova.
  const axes = useMemo(() => activityTypeList(), [data.customAxes])

  const objectiveProgress = useMemo(
    () =>
      data.objectives.map((objective) => progressOfObjective(objective, data.activities, today)),
    [data.objectives, data.activities, today],
  )

  /**
   * O plano de cada objetivo, calculado uma vez pro app inteiro.
   *
   * Dashboard, plano, progresso, detalhe e insight leem daqui. Foi a
   * divergência entre essas telas — cada uma com a sua conta de "quanto está
   * feito" — que motivou a hierarquia; recalcular por tela traria o problema
   * de volta pela porta dos fundos.
   */
  const plans = useMemo(
    () =>
      data.objectives.map((objective) =>
        planProgressOf(objective, data.planStages, data.tasks, data.habits, today),
      ),
    [data.objectives, data.planStages, data.tasks, data.habits, today],
  )

  const limits = useMemo(() => limitsOf(profile?.plan ?? 'free'), [profile])

  const isNewUser =
    !loading &&
    data.objectives.length === 0 &&
    data.planStages.length === 0 &&
    data.habits.length === 0 &&
    data.goals.length === 0 &&
    data.tasks.length === 0 &&
    data.activities.length === 0

  const value = useMemo<PlannerState>(
    () => ({
      today,
      activities: data.activities,
      todayActivities,
      axes,
      objectives: data.objectives,
      objectiveProgress,
      planStages: data.planStages,
      plans,
      goals: data.goals,
      goalProgress,
      habits: data.habits,
      habitLogs: data.habitLogs,
      tasks: data.tasks,
      checkIns: data.checkIns,
      wins: data.wins,
      weeklyReviews: data.weeklyReviews,
      journeyEvents: data.journeyEvents,
      streak,
      limits,
      loading,
      syncing,
      error,
      online,
      isNewUser,
      logActivity,
      removeActivity,
      createAxis,
      recordJourneyEvent,
      setEventVisibility,
      createObjective,
      updateObjective,
      archiveObjective,
      setObjectivePaused,
      completeObjective,
      applyPlan,
      createStage,
      updateStage,
      completeStage,
      reweightStages,
      removeStage,
      createGoal,
      archiveGoal,
      createHabit,
      updateHabit,
      setHabitPaused,
      archiveHabit,
      setHabitStatus,
      createTask,
      updateTask,
      setTaskDone,
      reorderTasks,
      removeTask,
      saveCheckIn,
      saveWin,
      saveWeeklyReview,
      reload,
    }),
    [
      today,
      data,
      todayActivities,
      axes,
      goalProgress,
      objectiveProgress,
      plans,
      streak,
      limits,
      loading,
      syncing,
      error,
      online,
      isNewUser,
      logActivity,
      removeActivity,
      createAxis,
      recordJourneyEvent,
      setEventVisibility,
      createObjective,
      updateObjective,
      archiveObjective,
      setObjectivePaused,
      completeObjective,
      applyPlan,
      createStage,
      updateStage,
      completeStage,
      reweightStages,
      removeStage,
      createGoal,
      archiveGoal,
      createHabit,
      updateHabit,
      setHabitPaused,
      archiveHabit,
      setHabitStatus,
      createTask,
      updateTask,
      setTaskDone,
      reorderTasks,
      removeTask,
      saveCheckIn,
      saveWin,
      saveWeeklyReview,
      reload,
    ],
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}
