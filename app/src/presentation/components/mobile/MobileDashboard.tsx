import { useMemo, useRef, type ReactNode } from 'react'
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
import { MobileObjectives } from './MobileObjectives'
import { MobilePriority } from './MobilePriority'
import { MobileWins } from './MobileWins'
import { ShareMomentsRow } from '@/presentation/share/ShareMomentsRow'
import { QuoteCard } from '@/presentation/components/dashboard/QuoteCard'

interface MobileDashboardProps {
  readonly view: DashboardView
  /** O tamanho do dia como ele está montado: alimenta o Dia Adaptável. */
  readonly dayLoad: DayLoad
  readonly onAdaptDay: (availableMin: number) => void
  /** A porta da IA no card do dia. Montada pela página, que é quem tem o diálogo. */
  readonly aiDayEntry?: ReactNode
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
  aiDayEntry,
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
  const planRef = useRef<HTMLDivElement>(null)

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

    A ação de hoje, o resto do dia, o que vem depois; então calibrar (check-in
    e tempo disponível), e por último ler (momentum, objetivos, hábitos,
    insight). A pessoa desce a tela e vai encontrando as coisas na ordem em que
    elas mudam a decisão do dia.

    Frase e check-in abriam a tela. Os dois são bons e nenhum dos dois é a
    resposta que a pessoa veio buscar: com eles na frente, a ação de hoje só
    aparecia depois de três blocos de rolagem. Quem quer calibrar antes tem os
    dois a um polegar de distância, e o botão flutuante continua levando ao
    check-in enquanto ele não foi feito.
  */
  return (
    <div className="flex flex-col gap-7">
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

      {/* A ação de hoje abre a tela. Só ganha bloco próprio enquanto está
          aberta: concluída, ela aparece riscada na lista do foco. */}
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

      <TodayFocusCard
        focus={view.focus}
        onStartFocus={onStartFocus}
        onSeeAll={() => navigate('/app/plano')}
        onPlanDay={() => composer.open('acao')}
      />

      <NextUpCard
        nextUp={view.nextUp}
        mainPriority={view.mainPriority}
        today={planner.today}
        onStartFocus={onStartFocus}
        onBringToToday={(task) => void onBringToToday(task)}
      />

      {/* Calibrar o dia: as duas perguntas que mudam o tamanho do que está
          acima, agora depois dele e não na frente dele. */}
      <div ref={checkInRef} className="scroll-mt-20">
        <MobileCheckIn
          checkIn={view.checkIn}
          capacity={view.capacity}
          onSave={async (input) => {
            await planner.saveCheckIn({ ...input, day: planner.today })
            // Respondeu, a tela volta pro dia já ajustado à energia: é a
            // resposta à pergunta que acabou de ser feita.
            planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </div>

      <div ref={planRef} className="scroll-mt-20">
        <AdaptiveDayCard
          plannedMin={dayLoad.minutes}
          openItems={dayLoad.items}
          capacity={view.capacity}
          onAdapt={onAdaptDay}
          aiEntry={aiDayEntry}
        />
      </div>

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

      {/* O momentum vem depois do que precisa sair: é leitura, não ação. */}
      <MomentumStrip
        momentum={view.momentum}
        history={view.momentumSeries}
        today={planner.today}
        streak={planner.streak}
        recommendation={view.recommendation}
        detail={planner.limits.momentumDetail}
        nextAction={view.nextAction}
      />

      <MobileInsight
        insight={view.insight}
        onApply={onApplyInsight}
        onDismiss={view.dismissInsight}
      />

      {/* Daqui pra baixo é consulta e registro do fim do dia. */}
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

      {/* Frase e cards de compartilhar fecham a tela: um é o que se lê depois
          de saber o que fazer, o outro é o que se guarda depois de fazer. */}
      <QuoteCard today={planner.today} />

      <ShareMomentsRow view={view} />

      {/*
        Um botão flutuante por vez, e só quando o card que já oferece a ação
        saiu da tela. A ordem é a da urgência: sessão aberta, depois a ação de
        hoje, e o check-in por último.

        O check-in vinha antes da prioridade, e com ele no fim da tela o botão
        nascia visível: a pessoa abria o app e o primeiro elemento flutuante
        cobria a barra do próprio dia. Executar vem antes de calibrar, e é essa
        a ordem que o botão passa a seguir.
      */}
      {focus.session ? (
        <ContextualFab
          label="Continuar foco"
          icon="play"
          anchor={focusRef}
          onClick={() => focus.setImmersive(true)}
        />
      ) : view.mainPriority && view.mainPriority.status !== 'feita' ? (
        <ContextualFab
          label="Começar prioridade"
          icon="play"
          anchor={priorityRef}
          onClick={() => view.mainPriority && onStartFocus(view.mainPriority)}
        />
      ) : !view.checkIn ? (
        <ContextualFab
          label="Fazer check-in"
          icon="raio"
          anchor={checkInRef}
          onClick={() => checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
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
