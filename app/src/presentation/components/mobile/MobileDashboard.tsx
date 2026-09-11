import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Insight } from '@/domain/entities/insight'
import type { DayLoad } from '@/domain/entities/adaptive-day'
import type { Task } from '@/domain/entities/task'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFocus } from '@/presentation/focus/use-focus'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import type { DashboardView, GoalInMotion } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { ContextualFab } from './ContextualFab'
import { MobileCheckIn } from './MobileCheckIn'
import { MobileFocus } from './MobileFocus'
import { MobileGoals } from './MobileGoals'
import { MobileHabits } from './MobileHabits'
import { AdaptiveDayCard } from '@/presentation/components/dashboard/AdaptiveDayCard'
import { MomentumStrip } from '@/presentation/components/dashboard/MomentumStrip'
import { NextUpCard } from '@/presentation/components/dashboard/NextUpCard'
import { TodayFocusCard } from '@/presentation/components/dashboard/TodayFocusCard'
import { MobileInsight } from './MobileInsight'
import { MobileMomentum } from './MobileMomentum'
import { MobileObjectives } from './MobileObjectives'
import { MobilePriority } from './MobilePriority'
import { MobileWins } from './MobileWins'
import { ShareMomentsRow } from '@/presentation/share/ShareMomentsRow'

interface MobileDashboardProps {
  readonly view: DashboardView
  /** O tamanho do dia como ele está montado: alimenta o Dia Adaptável. */
  readonly dayLoad: DayLoad
  readonly onAdaptDay: (availableMin: number) => void
  readonly onStartFocus: (task: Task) => void
  readonly onCompleteTask: (task: Task) => Promise<void>
  readonly onPostponeTask: (task: Task) => Promise<void>
  readonly onBringToToday: (task: Task) => Promise<void>
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
  dayLoad,
  onAdaptDay,
  onStartFocus,
  onBringToToday,
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

  const checkInRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLDivElement>(null)

  const mainGoal = planner.goals.find((goal) => goal.id === view.mainPriority?.goalId) ?? null

  // Os dois mapas de contexto do dia. Montados uma vez: cada linha da tela
  // precisa dizer a que etapa e a que objetivo ela pertence, e uma busca por
  // linha em cada render seria trabalho repetido à toa.
  const stageTitles = useMemo(
    () => new Map(planner.planStages.map((stage) => [stage.id, stage.title])),
    [planner.planStages],
  )

  const objectiveTitles = useMemo(
    () => new Map(planner.objectives.map((objective) => [objective.id, objective.title])),
    [planner.objectives],
  )

  // O que já apareceu no foco não se repete na lista de hábitos.
  const focusedHabitIds = new Set(
    view.focus.items.filter((item) => item.kind === 'habito').map((item) => item.id),
  )

  /*
    A ordem do celular é uma narrativa vertical, não o desktop espremido.

    Momentum, foco de hoje, objetivos, hábitos, insight, semana — e a análise
    depois. A pessoa desce a tela e vai encontrando as coisas na ordem em que
    elas mudam a decisão do dia. O check-in desceu do topo: ele calibra o dia,
    mas quem abre o app às sete da manhã quer ver o que precisa sair, não
    responder um formulário antes de qualquer coisa.
  */
  return (
    <div className="flex flex-col gap-7">
      <MomentumStrip
        momentum={view.momentum}
        history={view.momentumSeries}
        today={planner.today}
        streak={planner.streak}
        recommendation={view.recommendation}
        detail={planner.limits.momentumDetail}
      />

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

      {/* Antes do foco de propósito: no celular o app é aberto no meio do dia,
          e "quanto tempo eu tenho agora" é a pergunta que reordena o resto. */}
      <AdaptiveDayCard
        plannedMin={dayLoad.minutes}
        openItems={dayLoad.items}
        capacity={view.capacity}
        onAdapt={onAdaptDay}
      />

      <ShareMomentsRow view={view} />

      <TodayFocusCard
        focus={view.focus}
        onStartFocus={onStartFocus}
        onSeeAll={() => navigate('/app/plano')}
        onPlanDay={() => composer.open('acao')}
      />

      {/* A prioridade só ganha bloco próprio enquanto está aberta: concluída,
          ela já aparece riscada no foco logo acima. */}
      {view.mainPriority && view.mainPriority.status !== 'feita' ? (
        <div ref={priorityRef}>
          <MobilePriority
            task={view.mainPriority}
            stageTitle={stageTitles.get(view.mainPriority?.stageId ?? '') ?? null}
            goal={mainGoal}
            objective={planner.objectives.find(
              (item) => item.id === view.mainPriority?.objectiveId,
            )}
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
      ) : null}

      <NextUpCard
        nextUp={view.nextUp}
        mainPriority={view.mainPriority}
        today={planner.today}
        onStartFocus={onStartFocus}
        onBringToToday={(task) => void onBringToToday(task)}
      />

      <MobileObjectives
        objectives={view.objectives}
        onCreate={() => composer.open('objetivo')}
        onOpenReview={() => navigate('/app/review')}
      />

      <MobileHabits
        states={view.habitStates}
        hideIds={focusedHabitIds}
        objectiveTitles={objectiveTitles}
        progress={view.habitProgress}
        onSetStatus={planner.setHabitStatus}
        onSeeAll={() => navigate('/app/habitos')}
        onCreate={() => composer.open('habito')}
      />

      <MobileInsight
        insight={view.insight}
        onApply={onApplyInsight}
        onDismiss={view.dismissInsight}
      />

      <MobileMomentum
        momentum={view.momentum}
        history={view.momentumSeries}
        today={planner.today}
        streak={planner.streak}
        recommendation={view.recommendation}
        detail={planner.limits.momentumDetail}
      />

      {/* Daqui pra baixo é consulta e registro do fim do dia. */}
      <div ref={checkInRef}>
        <MobileCheckIn
          checkIn={view.checkIn}
          capacity={view.capacity}
          onSave={(input) => planner.saveCheckIn({ ...input, day: planner.today })}
        />
      </div>

      <div ref={focusRef}>
        <MobileFocus
          task={view.mainPriority}
          capacity={view.capacity}
          minutesToday={view.focusMinutesToday}
        />
      </div>

      <MobileGoals
        goals={view.goalsInMotion}
        onContinue={onContinueGoal}
        onCreateTask={(goal) => composer.open('acao', { presetGoalId: goal.progress.goal.id })}
        onManage={() => navigate('/app/metas')}
        onCreateGoal={() => composer.open('meta')}
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
    </div>
  )
}
