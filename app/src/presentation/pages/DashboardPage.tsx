import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { XPBadge } from '@/presentation/components/ds/Badges'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { DayCompleteBanner } from '@/presentation/components/dashboard/DayCompleteBanner'
import { RecoveryCard } from '@/presentation/components/dashboard/RecoveryCard'
import { ResumeActivationCard } from '@/presentation/components/dashboard/ResumeActivationCard'
import { ErrorNote } from '@/presentation/components/ui/States'
import { AiEntry } from '@/presentation/ai/AiBits'
import { useEvolution } from '@/presentation/evolution/use-evolution'
import { AddSheet } from '@/presentation/layouts/AddSheet'
import { ReminderCard } from '@/presentation/notifications/ReminderCard'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { ACTIVATION_PATH, useActivation } from '@/presentation/planner/use-activation'
import type { FocusItem } from '@/presentation/planner/use-dashboard'
import { useDayControls } from '@/presentation/planner/use-day-controls'
import { useJourneyRecorder } from '@/presentation/planner/use-journey-recorder'
import { usePlanner } from '@/presentation/planner/use-planner'
import { InstallCard } from '@/presentation/pwa/InstallCard'
import { FirstWinCard } from '@/presentation/quiz/FirstWinCard'
import { useFirstWin } from '@/presentation/quiz/use-first-win'
import { DayTimeline } from '@/presentation/today/DayTimeline'
import { EnergyCard } from '@/presentation/today/EnergyCard'
import { MomentumScoreCard } from '@/presentation/today/MomentumScoreCard'
import { PriorityNowCard } from '@/presentation/today/PriorityNowCard'
import { TodayChecklist } from '@/presentation/today/TodayChecklist'

/**
 * "Hoje", a central do Momentumm. VER → ENTENDER → AGIR, nessa ordem:
 *
 *   1. como estou (o score, sem explicação: a explicação mora em "Ver análise");
 *   2. o que importa agora (uma prioridade, um botão);
 *   3. o dia, em lista e em linha do tempo;
 *   4. a saída pra dia ruim, no fim, sempre à mão.
 *
 * Os avisos que só existem às vezes (retomada, primeira vitória, instalar o
 * app) entram entre o topo e o score, e somem quando resolvidos.
 */
export function DashboardPage() {
  const { profile } = useAuth()
  const planner = usePlanner()
  const composer = useComposer()
  const navigate = useNavigate()
  const evolution = useEvolution()
  const day = useDayControls()
  const { view } = day
  const activation = useActivation()
  const firstWin = useFirstWin()
  const [adding, setAdding] = useState(false)

  useJourneyRecorder(view)

  const stageTitles = useMemo(
    () => new Map(planner.planStages.map((stage) => [stage.id, stage.title])),
    [planner.planStages],
  )

  if (planner.loading) return <DashboardSkeleton mobile />

  const openPriority = view.mainPriority && view.mainPriority.status !== 'feita' ? view.mainPriority : null
  const priority = openPriority ?? view.nextUp?.task ?? null
  const priorityObjective = view.objectives.find((item) => item.progress.objective.id === priority?.objectiveId)

  const openItem = (item: FocusItem) => {
    if (item.task) composer.open('acao', { editing: item.task })
    else if (item.habitState) composer.open('habito', { editingHabit: item.habitState.habit })
  }

  const firstName = profile?.name.split(' ')[0] ?? null
  const now = new Date()

  return (
    <div className="flex flex-col gap-4 pb-2">
      {planner.error ? <ErrorNote message={planner.error} onRetry={() => void planner.reload()} /> : null}

      <header className="flex items-start justify-between gap-3 px-1 pt-1">
        <div className="min-w-0">
          <h2 className="truncate text-[1.1rem] leading-tight font-bold tracking-tight text-ink">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-0.5 text-sm text-ink-faint">{formatToday(now)}</p>
        </div>
        <XPBadge amount={evolution.summary.progress.xpTotal} total className="mt-1" />
      </header>

      {planner.isNewUser && activation.skipped ? (
        <ResumeActivationCard
          step={activation.step}
          started={activation.started}
          onResume={() => {
            activation.resume()
            navigate(ACTIVATION_PATH)
          }}
        />
      ) : null}

      {firstWin.task || firstWin.justCompleted ? (
        <FirstWinCard
          task={firstWin.task}
          justCompleted={firstWin.justCompleted}
          nextUp={view.nextUp}
          onComplete={day.completeTask}
          onStartFocus={day.startFocus}
          onDismiss={firstWin.dismiss}
        />
      ) : null}

      <RecoveryCard
        state={day.recovery.state}
        budgetFor={day.recovery.budgetFor}
        onChoose={day.chooseRecoveryStep}
        onDismiss={day.recovery.dismiss}
        aiEntry={
          <AiEntry
            enabled={day.aiEnabled}
            label="Criar plano de retorno"
            hint="a IA monta até três passos pequenos pra hoje, lidos do que já estava no teu plano."
            onClick={day.openAiRecovery}
          />
        }
      />

      {view.dayComplete ? <DayCompleteBanner win={view.todayWin} /> : null}

      <MomentumScoreCard
        momentum={view.momentum}
        series={view.momentumSeries.map((point) => point.value)}
        showTrend={planner.limits.momentumDetail}
      />

      <PriorityNowCard
        task={priority}
        goal={
          priorityObjective
            ? { title: priorityObjective.progress.objective.title, ratio: priorityObjective.ratio }
            : null
        }
        stageTitle={priority?.stageId ? (stageTitles.get(priority.stageId) ?? null) : null}
        onStartFocus={(task) => day.startFocus(task)}
        onChoose={() => composer.open('acao')}
      />

      <TodayChecklist focus={view.focus} onAdd={() => setAdding(true)} onOpen={openItem} />

      <DayTimeline agenda={view.agenda} />

      <EnergyCard
        active={day.lowEnergy}
        onActivate={() => void day.startLowEnergy()}
        onUndo={() => void day.endLowEnergy()}
        {...(day.aiEnabled ? { onAi: day.openAiDay } : {})}
      />

      <InstallCard />
      <ReminderCard />

      <AddSheet open={adding} onClose={() => setAdding(false)} />
      {day.layer}
    </div>
  )
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatToday(now: Date): string {
  const label = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
