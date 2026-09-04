import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Insight } from '@/domain/entities/insight'
import { addDays } from '@/domain/entities/day'
import { isPending, shrinkToMinimal, type Task } from '@/domain/entities/task'
import { useAuth } from '@/presentation/auth/use-auth'
import { CheckInCard } from '@/presentation/components/dashboard/CheckInCard'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { FocusCard } from '@/presentation/components/dashboard/FocusCard'
import { GoalsInMotionCard } from '@/presentation/components/dashboard/GoalsInMotionCard'
import { HabitsCard } from '@/presentation/components/dashboard/HabitsCard'
import { InsightCard } from '@/presentation/components/dashboard/InsightCard'
import { MomentumCard } from '@/presentation/components/dashboard/MomentumCard'
import { ObjectivesCard } from '@/presentation/components/dashboard/ObjectivesCard'
import { NextActionsCard } from '@/presentation/components/dashboard/NextActionsCard'
import { Onboarding } from '@/presentation/components/dashboard/Onboarding'
import { PriorityCard } from '@/presentation/components/dashboard/PriorityCard'
import { WeeklyProgressCard } from '@/presentation/components/dashboard/WeeklyProgressCard'
import { WinsCard } from '@/presentation/components/dashboard/WinsCard'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useFocus } from '@/presentation/focus/use-focus'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useDashboard, type GoalInMotion } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { DayCompleteBanner } from '@/presentation/components/dashboard/DayCompleteBanner'
import { MobileDashboard } from '@/presentation/components/mobile/MobileDashboard'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'

/**
 * "Hoje" — o dashboard.
 *
 * A ordem das seções responde, de cima pra baixo, as quatro perguntas do
 * produto: como estou hoje (check-in e momentum), o que importa agora
 * (prioridade), qual é a próxima ação (hábitos e ações) e se estou avançando
 * de verdade (semana, metas, insight).
 */
export function DashboardPage() {
  const { profile } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()
  const focus = useFocus()
  const composer = useComposer()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  const startFocus = useCallback(
    (task: Task) => {
      focus.start({
        axis: task.axis ?? 'estudo',
        label: task.title,
        plannedMin: Math.min(60, Math.max(15, task.estimatedMin)),
        taskId: task.id,
      })
      focus.setImmersive(true)
    },
    [focus],
  )

  const completeTask = useCallback(
    async (task: Task) => {
      await planner.updateTask(task.id, {
        status: 'feita',
        completedAt: new Date(),
      })
    },
    [planner],
  )

  const postponeTask = useCallback(
    async (task: Task) => {
      const base = task.day < planner.today ? planner.today : task.day
      await planner.updateTask(task.id, { day: addDays(base, 1), isMainPriority: false })
    },
    [planner],
  )

  const shrinkTask = useCallback(
    async (task: Task) => {
      const smaller = shrinkToMinimal(task)
      await planner.updateTask(task.id, {
        title: smaller.title,
        minimalVersion: null,
        estimatedMin: smaller.estimatedMin,
        effort: smaller.effort,
      })
    },
    [planner],
  )

  /** "Aplicar sugestão": o insight precisa mudar o dia, não só aconselhar. */
  const applyInsight = useCallback(
    async (insight: Insight) => {
      const pendingToday = planner.tasks.filter(
        (task) => task.day === planner.today && isPending(task),
      )

      switch (insight.action) {
        case 'reduzir-acoes-do-dia': {
          const keep = view.capacity.suggestedActions
          const extras = pendingToday
            .filter((task) => task.id !== view.mainPriority?.id)
            .slice(Math.max(0, keep - 1))
          for (const task of extras) {
            await planner.updateTask(task.id, { day: addDays(planner.today, 1) })
          }
          break
        }
        case 'usar-versao-minima': {
          for (const task of pendingToday.filter((item) => item.minimalVersion)) {
            await shrinkTask(task)
          }
          break
        }
        case 'proteger-sequencia': {
          if (view.mainPriority) startFocus(view.mainPriority)
          else composer.open('acao')
          break
        }
        case 'concentrar-na-manha': {
          if (view.mainPriority && !view.mainPriority.isMainPriority) {
            await planner.updateTask(view.mainPriority.id, { isMainPriority: true })
          }
          break
        }
        case 'criar-primeira-acao': {
          composer.open('acao')
          break
        }
        case 'nenhuma':
          break
      }

      view.dismissInsight(insight.id)
    },
    [planner, view, composer, shrinkTask, startFocus],
  )

  const continueGoal = useCallback(
    (goal: GoalInMotion) => {
      if (goal.nextTask) startFocus(goal.nextTask)
    },
    [startFocus],
  )

  if (planner.loading) return <DashboardSkeleton mobile={!isDesktop} />

  if (planner.isNewUser) {
    return (
      <Onboarding
        firstName={profile?.name.split(' ')[0] ?? null}
        today={planner.today}
        onFinish={planner.applyPlan}
      />
    )
  }

  /*
    Duas árvores, não uma encolhida: o celular reordena o dia inteiro em torno
    de "registrar, decidir, começar" e manda a análise pra depois. Os dados, as
    regras e as ações são exatamente os mesmos.
  */
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6">
        {planner.error ? <ErrorNote message={planner.error} /> : null}
        <MobileDashboard
          view={view}
          onStartFocus={startFocus}
          onCompleteTask={completeTask}
          onPostponeTask={postponeTask}
          onShrinkTask={shrinkTask}
          onApplyInsight={applyInsight}
          onContinueGoal={continueGoal}
        />
      </div>
    )
  }

  const mainGoal =
    planner.goals.find((goal) => goal.id === view.mainPriority?.goalId) ?? null

  return (
    <div className="flex flex-col gap-5">
      {planner.error ? <ErrorNote message={planner.error} /> : null}

      {/*
        Linha de contexto: como estou hoje. O check-in vem primeiro porque é ele
        que calibra tudo que aparece abaixo.
      */}
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <CheckInCard
          checkIn={view.checkIn}
          capacity={view.capacity}
          onSave={(input) => planner.saveCheckIn({ ...input, day: planner.today })}
        />
        <MomentumCard
          momentum={view.momentum}
          recommendation={view.recommendation}
          streak={planner.streak}
        />
      </div>

      {/*
        O destino antes da rotina. Vem logo depois do momentum porque é ele que
        dá sentido a tudo que aparece abaixo: sem objetivo na frente, a pessoa
        cumpre a lista do dia e nunca chega em lugar nenhum.
      */}
      <ObjectivesCard
        objectives={planner.objectiveProgress}
        onCreate={() => composer.open('objetivo')}
        onOpenReview={() => navigate('/app/review')}
      />

      {view.dayComplete ? <DayCompleteBanner win={view.todayWin} /> : null}

      <PriorityCard
        task={view.mainPriority}
        goal={mainGoal}
        capacity={view.capacity}
        dayComplete={view.dayComplete}
        onStartFocus={startFocus}
        onComplete={completeTask}
        onShrink={shrinkTask}
        onReorganize={() =>
          view.mainPriority ? composer.open('acao', { editing: view.mainPriority }) : composer.open('acao')
        }
        onCreate={() => composer.open('acao')}
      />

      {/*
        Corpo do dashboard: execução à esquerda, acompanhamento na coluna
        contextual à direita — que só aparece quando existe largura pra ela.

        A distribuição é proposital: metas dividem a linha com o progresso
        semanal em vez de empilhar na lateral. Coluna lateral muito mais alta
        que a principal deixa um buraco no canto inferior esquerdo da tela.
      */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-5 2xl:grid-cols-2 2xl:items-start">
            <HabitsCard
              states={view.habitStates}
              progress={view.habitProgress}
              onSetStatus={planner.setHabitStatus}
              onSeeAll={() => navigate('/app/habitos')}
              onCreate={() => composer.open('habito')}
            />
            <NextActionsCard
              tasks={planner.tasks}
              goals={planner.goals}
              today={planner.today}
              excludeId={view.mainPriority?.id}
              onComplete={completeTask}
              onPostpone={postponeTask}
              onShrink={shrinkTask}
              onStartFocus={startFocus}
              onEdit={(task) => composer.open('acao', { editing: task })}
              onCreate={() => composer.open('acao')}
              onSeeAll={() => navigate('/app/jornada')}
            />
          </div>

          <div className="grid gap-5 2xl:grid-cols-2 2xl:items-start">
            <WeeklyProgressCard week={view.week} limits={planner.limits} />

            <GoalsInMotionCard
              goals={view.goalsInMotion}
              onContinue={continueGoal}
              onCreateTask={(goal) =>
                composer.open('acao', { presetGoalId: goal.progress.goal.id })
              }
              onManage={() => navigate('/app/metas')}
              onCreateGoal={() => composer.open('meta')}
            />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-24">
          <FocusCard
            task={view.mainPriority}
            capacity={view.capacity}
            minutesToday={view.focusMinutesToday}
            limits={planner.limits}
          />

          <InsightCard
            insight={view.insight}
            limits={planner.limits}
            onApply={applyInsight}
            onDismiss={view.dismissInsight}
          />

          <WinsCard
            wins={planner.wins}
            todayWin={view.todayWin}
            today={planner.today}
            onSave={(text) => planner.saveWin({ day: planner.today, text })}
          />
        </aside>
      </div>
    </div>
  )
}
