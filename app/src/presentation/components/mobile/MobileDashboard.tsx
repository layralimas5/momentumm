import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Insight } from '@/domain/entities/insight'
import type { Task } from '@/domain/entities/task'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFocus } from '@/presentation/focus/use-focus'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import type { DashboardView, GoalInMotion } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { ContextualFab } from './ContextualFab'
import { MobileActions } from './MobileActions'
import { MobileCheckIn } from './MobileCheckIn'
import { MobileFocus } from './MobileFocus'
import { MobileGoals } from './MobileGoals'
import { MobileHabits } from './MobileHabits'
import { MobileInsight } from './MobileInsight'
import { MobileMomentum } from './MobileMomentum'
import { MobileObjectives } from './MobileObjectives'
import { MobilePriority } from './MobilePriority'
import { MobileWins } from './MobileWins'
import { ProSheet } from './ProSheet'

interface MobileDashboardProps {
  readonly view: DashboardView
  readonly onStartFocus: (task: Task) => void
  readonly onCompleteTask: (task: Task) => Promise<void>
  readonly onPostponeTask: (task: Task) => Promise<void>
  readonly onShrinkTask: (task: Task) => Promise<void>
  readonly onApplyInsight: (insight: Insight) => Promise<void>
  readonly onContinueGoal: (goal: GoalInMotion) => void
}

/**
 * O dashboard do celular.
 *
 * A ordem responde ao uso real: quem abre o app no meio do dia quer registrar
 * como está, ver o que importa e começar — nessa sequência. Análise (momentum,
 * metas, insight) vem depois, porque ninguém interpreta gráfico de pé no ponto
 * de ônibus. As regras, os dados e os cálculos são exatamente os do desktop;
 * o que muda é a ordem, a densidade e o tamanho dos alvos.
 */
export function MobileDashboard({
  view,
  onStartFocus,
  onCompleteTask,
  onPostponeTask,
  onShrinkTask,
  onApplyInsight,
  onContinueGoal,
}: MobileDashboardProps) {
  const planner = usePlanner()
  const composer = useComposer()
  const focus = useFocus()
  const navigate = useNavigate()

  const [proFeature, setProFeature] = useState<string | null>(null)

  const checkInRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLDivElement>(null)

  const mainGoal = planner.goals.find((goal) => goal.id === view.mainPriority?.goalId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div ref={checkInRef}>
        <MobileCheckIn
          checkIn={view.checkIn}
          capacity={view.capacity}
          onSave={(input) => planner.saveCheckIn({ ...input, day: planner.today })}
        />
      </div>

      {view.dayComplete ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-card border border-positive/30 bg-positive/8 px-4 py-3 text-sm text-ink"
        >
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
          <span>
            <strong className="font-semibold">Dia cumprido.</strong> Tudo que estava planejado saiu.
          </span>
        </p>
      ) : null}

      <div ref={priorityRef}>
        <MobilePriority
          task={view.mainPriority}
          goal={mainGoal}
          capacity={view.capacity}
          dayComplete={view.dayComplete}
          onStartFocus={onStartFocus}
          onComplete={onCompleteTask}
          onShrink={onShrinkTask}
          onPostpone={onPostponeTask}
          onEdit={(task) => composer.open('acao', { editing: task })}
          onCreate={() => composer.open('acao')}
        />
      </div>

      <MobileHabits
        states={view.habitStates}
        progress={view.habitProgress}
        onSetStatus={planner.setHabitStatus}
        onSeeAll={() => navigate('/app/habitos')}
        onCreate={() => composer.open('habito')}
      />

      <MobileActions
        tasks={planner.tasks}
        goals={planner.goals}
        today={planner.today}
        excludeId={view.mainPriority?.id}
        onComplete={onCompleteTask}
        onPostpone={onPostponeTask}
        onShrink={onShrinkTask}
        onStartFocus={onStartFocus}
        onEdit={(task) => composer.open('acao', { editing: task })}
        onCreate={() => composer.open('acao')}
        onSeeAll={() => navigate('/app/jornada')}
      />

      <MobileMomentum
        momentum={view.momentum}
        series={view.week.series}
        streak={planner.streak}
        onOpen={() => navigate('/app/insights')}
      />

      <div ref={focusRef}>
        <MobileFocus
          task={view.mainPriority}
          capacity={view.capacity}
          minutesToday={view.focusMinutesToday}
          limits={planner.limits}
          onNeedPro={setProFeature}
        />
      </div>

      <MobileObjectives
        objectives={planner.objectiveProgress}
        onCreate={() => composer.open('objetivo')}
        onOpenReview={() => navigate('/app/review')}
      />

      <MobileGoals
        goals={view.goalsInMotion}
        onContinue={onContinueGoal}
        onCreateTask={(goal) => composer.open('acao', { presetGoalId: goal.progress.goal.id })}
        onManage={() => navigate('/app/metas')}
        onCreateGoal={() => composer.open('meta')}
      />

      <MobileInsight
        insight={view.insight}
        onApply={onApplyInsight}
        onDismiss={view.dismissInsight}
      />

      <MobileWins
        wins={planner.wins}
        todayWin={view.todayWin}
        today={planner.today}
        onSave={(text) => planner.saveWin({ day: planner.today, text })}
      />

      {/*
        Um botão flutuante por vez, e só quando o card que já oferece a ação
        saiu da tela. A ordem é a da urgência: sessão aberta, depois check-in,
        depois a prioridade.
      */}
      {focus.session ? (
        <ContextualFab
          label="Continuar foco"
          icon="play"
          anchor={focusRef}
          onClick={() => focus.setImmersive(true)}
        />
      ) : !view.checkIn ? (
        <ContextualFab
          label="Fazer check-in"
          icon="raio"
          anchor={checkInRef}
          onClick={() => checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
      ) : view.mainPriority ? (
        <ContextualFab
          label="Começar prioridade"
          icon="play"
          anchor={priorityRef}
          onClick={() => view.mainPriority && onStartFocus(view.mainPriority)}
        />
      ) : null}

      {/*
        Respiro no fim da rolagem: o botão flutuante paira sobre o conteúdo, e
        sem essa faixa ele cobriria as vitórias anteriores, que são a última
        coisa da tela.
      */}
      <span aria-hidden="true" className="h-14 shrink-0" />

      <ProSheet
        open={proFeature !== null}
        feature={proFeature}
        onClose={() => setProFeature(null)}
      />
    </div>
  )
}
