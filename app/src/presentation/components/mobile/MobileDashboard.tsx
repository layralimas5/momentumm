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
import { WeekPulse } from '@/presentation/components/dashboard/WeekPulse'
import { NextUpCard } from '@/presentation/components/dashboard/NextUpCard'
import { TodayFocusCard } from '@/presentation/components/dashboard/TodayFocusCard'
import { MobileInsight } from './MobileInsight'
import { MobileMore } from './MobileMore'
import { MobileObjectives } from './MobileObjectives'
import { MobilePriority } from './MobilePriority'
import { MobileWins } from './MobileWins'
import { ShareInvite } from '@/presentation/share/ShareInvite'
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
    A ordem do celular é uma narrativa vertical, não o desktop espremido, e a
    tela responde três perguntas, nessa ordem:

      como estou -> o que importa hoje -> estou avançando.

    O Momentumm abre porque é o estado atual em um número, e ele mudou de
    lugar: antes vinha depois de tudo, quando a pessoa já tinha rolado meia
    tela pra descobrir como estava. A frase e o check-in continuam ANTES da
    ação, porque é a energia respondida que monta o dia; o que mudou é que
    agora os dois são a antessala curta de um único bloco grande, a ação
    principal, e não mais quatro cards de peso parecido.

    Depois da ação vem o resto do dia recolhido, os hábitos como suporte, e o
    pulso da semana. Análise longa (objetivos, insight, metas, sessões) fica no
    fim: ninguém interpreta gráfico de pé no ponto de ônibus.
  */
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Como estou? O estado atual em um número, na primeira dobra. */}
      <MomentumStrip
        momentum={view.momentum}
        history={view.momentumSeries}
        today={planner.today}
        streak={planner.streak}
        recommendation={view.recommendation}
        detail={planner.limits.momentumDetail}
        nextAction={view.nextAction}
        compact
      />

      {/* O gás pra encarar o que vem, em uma faixa: a frase não pode empurrar
          a ação do dia pra fora da primeira dobra. */}
      <QuoteCard today={planner.today} compact />

      {/* A pergunta que monta o dia: vem antes dele, nunca depois. */}
      <div ref={checkInRef} className="scroll-mt-20">
        <MobileCheckIn
          checkIn={view.checkIn}
          capacity={view.capacity}
          onSave={async (input) => {
            await planner.saveCheckIn({ ...input, day: planner.today })
            // Respondeu, a tela desce pro dia já ajustado à energia: é a
            // resposta à pergunta que acabou de ser feita.
            planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
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

      {/* 2. O que importa hoje. O maior peso visual da tela, montado em cima
          do check-in. Só ganha bloco próprio enquanto está aberta: concluída,
          ela aparece riscada na lista do foco. */}
      {view.mainPriority && view.mainPriority.status !== 'feita' ? (
        <div ref={priorityRef} className="scroll-mt-20">
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

      {/* O resto do dia, com hierarquia menor: recolhido quando a ação
          principal já está decidida, card inteiro quando não há uma. */}
      <TodayFocusCard
        focus={view.focus}
        secondary={Boolean(view.mainPriority && view.mainPriority.status !== 'feita')}
        onStartFocus={onStartFocus}
        onSeeAll={() => navigate('/app/plano')}
        onPlanDay={() => composer.open('acao')}
      />

      {/* Adaptar o dia é a saída elegante pra quem tem pouco tempo: fica logo
          abaixo da ação, em tom secundário, sem disputar com o "começar". */}
      <div ref={planRef} className="scroll-mt-20">
        <AdaptiveDayCard
          plannedMin={dayLoad.minutes}
          openItems={dayLoad.items}
          capacity={view.capacity}
          onAdapt={onAdaptDay}
          aiEntry={aiDayEntry}
          collapsible
        />
      </div>

      {/* Entre a lista e o que vem depois: o convite chega logo abaixo do item
          que a pessoa acabou de marcar. */}
      <ShareInvite view={view} />

      <MobileHabits
        states={view.habitStates}
        hideIds={focusedHabitIds}
        objectiveTitles={objectiveTitles}
        progress={view.habitProgress}
        onSetStatus={planner.setHabitStatus}
        onSeeAll={() => navigate('/app/habitos')}
        onCreate={() => composer.open('habito')}
      />

      {/* 3. Estou avançando? Sete pontos, sem cobrança de sequência. */}
      <WeekPulse week={view.week} />

      {/*
        O compartilhar fica na rolagem principal, colado no avanço da semana:
        é logo depois de ver o progresso que dá vontade de mostrar. Dentro do
        "ver mais" ele virava um recurso que só quem procura encontra, e o
        card do Momentumm é o que traz gente nova pro app.

        A fileira continua aparecendo só quando existe momento digno de card,
        pela mesma razão de sempre: botão sempre visível vira mobília.
      */}
      <ShareMomentsRow view={view} />

      {/*
        Consulta e registro do fim do dia, recolhidos.

        Nada saiu do app: a próxima do plano, os objetivos, o insight, as
        sessões, as metas e as vitórias continuam aqui, a um toque, e também
        nas telas próprias. O que mudou é que eles pararam de disputar a
        rolagem com a decisão do dia.
      */}
      <MobileMore>
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

        <MobileInsight
          insight={view.insight}
          onApply={onApplyInsight}
          onDismiss={view.dismissInsight}
        />

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
      </MobileMore>

      {/*
        Um botão flutuante por vez, e só quando o card que já oferece a ação
        saiu da tela. A ordem é a da urgência: sessão aberta, depois o
        check-in, depois a ação de hoje.

        O check-in vem primeiro porque é ele que monta o dia: quem rolou pra
        longe sem responder ainda não viu o app trabalhar. Com ele de volta ao
        topo da tela, o botão só aparece depois que a pessoa passou por ele.
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
      ) : view.mainPriority && view.mainPriority.status !== 'feita' ? (
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
