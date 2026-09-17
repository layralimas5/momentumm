import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Insight } from '@/domain/entities/insight'
import { addDays } from '@/domain/entities/day'
import type { RecoveryStep } from '@/domain/entities/recovery'
import type { Task } from '@/domain/entities/task'
import { useAuth } from '@/presentation/auth/use-auth'
import { AdaptiveDayCard } from '@/presentation/components/dashboard/AdaptiveDayCard'
import { AdaptiveDayReview } from '@/presentation/components/dashboard/AdaptiveDayReview'
import { CheckInCard } from '@/presentation/components/dashboard/CheckInCard'
import { DayHeader } from '@/presentation/components/dashboard/DayHeader'
import { DashboardSkeleton } from '@/presentation/components/dashboard/DashboardSkeleton'
import { FocusCard } from '@/presentation/components/dashboard/FocusCard'
import { GoalsInMotionCard } from '@/presentation/components/dashboard/GoalsInMotionCard'
import { HabitsCard } from '@/presentation/components/dashboard/HabitsCard'
import { InsightCard } from '@/presentation/components/dashboard/InsightCard'
import { MomentumStrip } from '@/presentation/components/dashboard/MomentumStrip'
import { NextUpCard } from '@/presentation/components/dashboard/NextUpCard'
import { ObjectivesCard } from '@/presentation/components/dashboard/ObjectivesCard'
import { Activation } from '@/presentation/components/dashboard/Activation'
import { ResumeActivationCard } from '@/presentation/components/dashboard/ResumeActivationCard'
import { PriorityCard } from '@/presentation/components/dashboard/PriorityCard'
import { RecoveryCard } from '@/presentation/components/dashboard/RecoveryCard'
import { WeeklyProgressCard } from '@/presentation/components/dashboard/WeeklyProgressCard'
import { Section } from '@/presentation/components/dashboard/Section'
import { TodayFocusCard } from '@/presentation/components/dashboard/TodayFocusCard'
import { WinsCard } from '@/presentation/components/dashboard/WinsCard'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useActivation } from '@/presentation/planner/use-activation'
import { useInsightActions } from '@/presentation/planner/use-insight-actions'
import { useAdaptiveDay } from '@/presentation/planner/use-adaptive-day'
import { useDashboard, type GoalInMotion } from '@/presentation/planner/use-dashboard'
import { useRecovery } from '@/presentation/planner/use-recovery'
import { useJourneyRecorder } from '@/presentation/planner/use-journey-recorder'
import { usePlanner } from '@/presentation/planner/use-planner'
import { DayCompleteBanner } from '@/presentation/components/dashboard/DayCompleteBanner'
import { MobileDashboard } from '@/presentation/components/mobile/MobileDashboard'
import { ShareMomentsRow } from '@/presentation/share/ShareMomentsRow'
import { QuoteCard } from '@/presentation/components/dashboard/QuoteCard'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { AiDayDialog } from '@/presentation/ai/AiDayDialog'
import { AiRecoveryDialog } from '@/presentation/ai/AiRecoveryDialog'
import { AiEntry } from '@/presentation/ai/AiBits'
import { useAi } from '@/presentation/ai/use-ai'

/**
 * "Hoje" — o dashboard.
 *
 * A tela tem TRÊS níveis de atenção, e a diferença entre eles é deliberada:
 *
 *   1. Saudação, Momentum e **Seu foco de hoje** — a primeira dobra. Responde
 *      "como estou" e "o que faço agora", que é o motivo de a pessoa abrir o app.
 *   2. Objetivos, hábitos e insight — responde "estou avançando".
 *   3. Semana, check-in, foco cronometrado, metas e vitórias — consulta.
 *
 * O que mudou em relação à versão anterior, e por quê: eram doze cards com o
 * mesmo peso visual, e uma tela onde tudo grita é uma tela onde nada é lido. Só
 * o foco de hoje continua sendo card de destaque, porque é o único bloco em que
 * a pessoa ATUA. O resto virou seção — título, espaçamento e uma saída pra tela
 * completa do assunto.
 *
 * A largura é limitada mesmo sobrando tela. Em 1920px o conteúdo chegava a
 * 1648px de largura: linha de texto longa demais pra ler e barra de progresso
 * atravessando o monitor.
 */
export function DashboardPage() {
  const { profile } = useAuth()
  const planner = usePlanner()
  const view = useDashboard()
  const composer = useComposer()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  /*
    Os dois recursos que reagem ao estado do dia em vez de esperarem um clique
    no lugar certo. O Dia Adaptável responde "tenho pouco tempo"; o Modo
    Retomada responde "sumi por uns dias". Os dois desembocam na MESMA revisão
    — reorganizar o dia é uma operação só, e duas telas fazendo isso seriam
    duas contas discordando na primeira mudança de regra.
  */
  const adaptive = useAdaptiveDay(view)
  const recovery = useRecovery(view)

  /*
    As duas portas da IA no Hoje: "Reorganizar meu dia" ao lado do Dia
    Adaptável e "Criar plano de retorno" dentro do Modo Retomada. A IA lê o
    mesmo estado que a aritmética, e devolve propostas que a pessoa confirma
    uma a uma — nunca uma gravação direta.
  */
  const ai = useAi()
  const [aiDayOpen, setAiDayOpen] = useState(false)
  const [aiRecoveryOpen, setAiRecoveryOpen] = useState(false)

  /*
    O onboarding vive fora do `isNewUser` porque ele pode ser adiado: a pessoa
    pula, usa o app vazio e volta depois. O estado de "onde parei" é do hook,
    não desta tela.
  */
  const activation = useActivation()

  /*
    Começar uma ação, encolher pra versão mínima e aplicar a recomendação são
    os mesmos verbos em qualquer tela que mostre um insight. Eles moravam aqui
    dentro, e por isso a tela de Insights só sabia descrever.
  */
  const { apply, startFocus, shrinkTask } = useInsightActions(view)

  /*
    O dia de hoje virando registro: hábito concluído, rotina fechada, dia
    cumprido, retomada, recorde de momentum, objetivo cruzando uma faixa e
    marco alcançado.

    Mora no dashboard porque é a tela que a pessoa abre todo dia. A decisão do
    QUE gravar é uma função pura (`eventsToRecord`) — aqui não há regra, só a
    chamada.
  */
  useJourneyRecorder(view)

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

  /**
   * A ação do plano entrando no dia.
   *
   * É o passo que faltava entre "o plano diz que é isso" e "hoje eu faço
   * isso": sem ele a única saída era editar a ação num diálogo pra trocar a
   * data, e um fluxo que depende de abrir o editor é um fluxo que ninguém faz.
   */
  const bringToToday = useCallback(
    async (task: Task) => {
      await planner.updateTask(task.id, { day: planner.today })
    },
    [planner],
  )

  /** O tempo informado vira uma proposta de dia, nunca uma gravação direta. */
  const adaptDay = useCallback(
    (availableMin: number) => adaptive.open({ availableMin }),
    [adaptive],
  )

  /**
   * O passo de retomada escolhido.
   *
   * Ele é protegido, entra no dia mesmo vindo de outra data e vira a
   * prioridade principal — e é aí que mora a recompensa: prioridade concluída
   * vale o triplo de uma tarefa comum no Momentum, e fechar a pausa de hoje é
   * o que o fator de retomada mede.
   */
  const chooseRecoveryStep = useCallback(
    (step: RecoveryStep) => {
      const isTask = step.kind === 'acao'

      adaptive.open({
        availableMin: recovery.budgetFor(step),
        protectIds: [step.id],
        fromRecovery: true,
        intro: `Passo escolhido: ${step.title}. O resto do dia se reorganiza em volta dele, e nada do que ficou pra trás foi somado aqui.`,
        ...(isTask && step.fromAnotherDay ? { bringId: step.id } : {}),
        ...(isTask ? { promoteId: step.id } : {}),
        ...(isTask && step.minimal ? { minimalId: step.id } : {}),
      })
    },
    [adaptive, recovery],
  )

  const confirmAdaptive = useCallback(async () => {
    const fromRecovery = adaptive.request?.fromRecovery === true
    const applied = await adaptive.confirm()
    // Escolheu o passo: o recado de retomada já foi respondido por hoje.
    if (applied && fromRecovery) recovery.dismiss()
  }, [adaptive, recovery])

  /**
   * Título de cada etapa por id. O dia inteiro lê daqui pra dizer a que ponto
   * do plano cada linha pertence — é o que separa "Finalizar onboarding" de
   * "Finalizar onboarding · Etapa: MVP · Objetivo: Lançar meu SaaS".
   */
  const stageTitles = useMemo(
    () => new Map(planner.planStages.map((stage) => [stage.id, stage.title])),
    [planner.planStages],
  )

  /**
   * "Aplicar sugestão": o insight precisa mudar o dia, não só aconselhar.
   *
   * Dispensar depois de aplicar é decisão DESTA tela: aqui aparece um insight
   * por vez, e repetir o que a pessoa acabou de resolver seria ruído. Na tela
   * de Insights a lista se atualiza sozinha — a regra para de casar porque o
   * dado mudou, que é o único motivo honesto pra um insight sumir.
   */
  const applyInsight = useCallback(
    async (insight: Insight) => {
      await apply(insight)
      view.dismissInsight(insight.id)
    },
    [apply, view],
  )

  const continueGoal = useCallback(
    (goal: GoalInMotion) => {
      if (goal.nextTask) startFocus(goal.nextTask)
    },
    [startFocus],
  )

  const reviewLayer = (
    <>
      <AdaptiveDayReview
        plan={adaptive.plan}
        intro={adaptive.request?.intro}
        applying={adaptive.applying}
        error={adaptive.error}
        onConfirm={() => void confirmAdaptive()}
        onClose={adaptive.close}
      />
      <AiDayDialog
        open={aiDayOpen}
        ai={ai}
        defaultAvailableMin={view.capacity.suggestedFocusMin * view.capacity.suggestedActions}
        plannedMin={adaptive.load.minutes}
        onClose={() => setAiDayOpen(false)}
      />
      {recovery.state ? (
        <AiRecoveryDialog
          open={aiRecoveryOpen}
          ai={ai}
          state={recovery.state}
          onApplied={recovery.dismiss}
          onClose={() => setAiRecoveryOpen(false)}
        />
      ) : null}
    </>
  )

  const aiDayEntry = (
    <AiEntry
      enabled={ai.enabled}
      label="Reorganizar meu dia"
      hint="a IA lê o dia, os próximos sete e os prazos, e propõe o menor conjunto de ajustes que faz o dia caber."
      onClick={() => setAiDayOpen(true)}
    />
  )

  const aiRecoveryEntry = (
    <AiEntry
      enabled={ai.enabled}
      label="Criar plano de retorno"
      hint="a IA monta até três passos pequenos pra hoje, lidos do que já estava no teu plano."
      onClick={() => setAiRecoveryOpen(true)}
    />
  )

  if (planner.loading) return <DashboardSkeleton mobile={!isDesktop} />

  if (planner.isNewUser && !activation.skipped) {
    return (
      <Activation
        firstName={profile?.name.split(' ')[0] ?? null}
        today={planner.today}
        control={activation}
      />
    )
  }

  /* Pulou o onboarding: o dashboard aparece, e com ele a porta de volta. */
  const resumeCard =
    planner.isNewUser && activation.skipped ? (
      <ResumeActivationCard
        step={activation.step}
        started={activation.started}
        onResume={activation.resume}
      />
    ) : null

  /*
    Duas árvores, não uma encolhida: o celular reordena o dia inteiro em torno
    de "registrar, decidir, começar" e manda a análise pra depois. Os dados, as
    regras e as ações são exatamente os mesmos.
  */
  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6">
        {planner.error ? <ErrorNote message={planner.error} /> : null}
        <DayHeader
          compact
          name={profile?.name.split(' ')[0] ?? null}
          today={planner.today}
          headline={view.headline}
          resumeNote={view.resumeNote}
          overdue={view.overdueCount}
          onReviewOverdue={() => navigate('/app/plano')}
        />
        {resumeCard}
        <RecoveryCard
          state={recovery.state}
          budgetFor={recovery.budgetFor}
          onChoose={chooseRecoveryStep}
          onDismiss={recovery.dismiss}
          aiEntry={aiRecoveryEntry}
        />
        <MobileDashboard
          view={view}
          dayLoad={adaptive.load}
          onAdaptDay={adaptDay}
          aiDayEntry={aiDayEntry}
          onStartFocus={startFocus}
          onCompleteTask={completeTask}
          onPostponeTask={postponeTask}
          onBringToToday={bringToToday}
          onShrinkTask={shrinkTask}
          onApplyInsight={applyInsight}
          onContinueGoal={continueGoal}
        />
        {reviewLayer}
      </div>
    )
  }

  const mainGoal =
    planner.goals.find((goal) => goal.id === view.mainPriority?.goalId) ?? null

  const firstName = profile?.name.split(' ')[0] ?? null

  // O que já apareceu no foco não se repete nos hábitos: o mesmo item em dois
  // blocos da mesma tela faz o dia parecer maior do que ele é.
  const focusedHabitIds = new Set(
    view.focus.items.filter((item) => item.kind === 'habito').map((item) => item.id),
  )

  return (
    /*
      Container centralizado com teto de largura. `max-w-5xl` mantém a linha de
      texto na faixa legível e impede que a tela vire uma régua de ponta a ponta
      no monitor grande.
    */
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {planner.error ? <ErrorNote message={planner.error} /> : null}

      {/* ------------------------------------------------------------------
          Primeiro nível: como estou e o que faço agora.
         ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        <DayHeader
          name={firstName}
          today={planner.today}
          headline={view.headline}
          resumeNote={view.resumeNote}
          overdue={view.overdueCount}
          onReviewOverdue={() => navigate('/app/plano')}
        />

        {resumeCard}

        <RecoveryCard
          state={recovery.state}
          budgetFor={recovery.budgetFor}
          onChoose={chooseRecoveryStep}
          onDismiss={recovery.dismiss}
          aiEntry={aiRecoveryEntry}
        />

        <QuoteCard today={planner.today} />

        <CheckInCard
          checkIn={view.checkIn}
          capacity={view.capacity}
          textLogs={planner.limits.textLogs}
          onSave={(input) => planner.saveCheckIn({ ...input, day: planner.today })}
        />

        {view.dayComplete ? <DayCompleteBanner win={view.todayWin} /> : null}

        <AdaptiveDayCard
          plannedMin={adaptive.load.minutes}
          openItems={adaptive.load.items}
          capacity={view.capacity}
          onAdapt={adaptDay}
          aiEntry={aiDayEntry}
        />

        <ShareMomentsRow view={view} />

        <TodayFocusCard
          focus={view.focus}
          onStartFocus={startFocus}
          onSeeAll={() => navigate('/app/plano')}
          onPlanDay={() => composer.open('acao')}
        />

        {/* A prioridade principal só ganha bloco próprio quando ela existe e
            ainda está aberta: concluída, ela já aparece riscada no foco. */}
        {view.mainPriority && view.mainPriority.status !== 'feita' ? (
          <PriorityCard
            task={view.mainPriority}
            stageTitle={stageTitles.get(view.mainPriority?.stageId ?? '') ?? null}
            goal={mainGoal}
            objective={planner.objectives.find(
              (item) => item.id === view.mainPriority?.objectiveId,
            )}
            capacity={view.capacity}
            dayComplete={view.dayComplete}
            onStartFocus={startFocus}
            onComplete={completeTask}
            onShrink={shrinkTask}
            onReorganize={() =>
              view.mainPriority
                ? composer.open('acao', { editing: view.mainPriority })
                : composer.open('acao')
            }
            onCreate={() => composer.open('acao')}
          />
        ) : null}

        <NextUpCard
          nextUp={view.nextUp}
          mainPriority={view.mainPriority}
          today={planner.today}
          onStartFocus={startFocus}
          onBringToToday={(task) => void bringToToday(task)}
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
      </div>

      {/* ------------------------------------------------------------------
          Segundo nível: estou avançando?

          Duas colunas com proporção controlada — execução à esquerda, contexto
          à direita. Nada de sticky: coluna que acompanha a rolagem compete com
          o conteúdo principal durante a tela inteira.
         ------------------------------------------------------------------ */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <Section
          title="Objetivos em andamento"
          to="/app/objetivos"
          toLabel="Ver todos"
        >
          <ObjectivesCard
            bare
            limit={3}
            objectives={view.objectives.filter(
              (item) => item.progress.state === 'em-andamento' || item.progress.state === 'nao-iniciado',
            )}
            onCreate={() => composer.open('objetivo')}
            onOpenReview={() => navigate('/app/review')}
          />
        </Section>

        <Section
          title="Hábitos de hoje"
          hint={
            view.habitProgress.total === 0
              ? undefined
              : `${view.habitProgress.done} de ${view.habitProgress.total} concluídos`
          }
          to="/app/habitos"
        >
          <HabitsCard
            bare
            states={view.habitStates}
            hideIds={focusedHabitIds}
            objectives={planner.objectives}
            stageTitles={stageTitles}
            progress={view.habitProgress}
            onSetStatus={planner.setHabitStatus}
            onSeeAll={() => navigate('/app/habitos')}
            onCreate={() => composer.open('habito')}
          />
        </Section>
      </div>

      {view.insight ? (
        <Section
          title="Seu Momentum"
          to="/app/insights"
          toLabel="Ver todas as leituras"
        >
          <InsightCard
            insight={view.insight}
            limits={planner.limits}
            onApply={applyInsight}
            onDismiss={view.dismissInsight}
          />
        </Section>
      ) : null}

      {/* ------------------------------------------------------------------
          Terceiro nível: consulta. Vem depois e com título menor de propósito —
          gráfico e histórico não podem disputar com o dia.
         ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-6 border-t border-line pt-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Section title="Sua semana" level={3} to="/app/progresso" toLabel="Ver progresso">
            <WeeklyProgressCard week={view.week} limits={planner.limits} />
          </Section>

        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Section title="Sessão de foco" level={3} to="/app/foco" toLabel="Abrir">
            <FocusCard
              task={view.mainPriority}
              capacity={view.capacity}
              minutesToday={view.focusMinutesToday}
            />
          </Section>

          <Section title="Metas em movimento" level={3} to="/app/metas">
            <GoalsInMotionCard
              goals={view.goalsInMotion}
              onContinue={continueGoal}
              onCreateTask={(goal) =>
                composer.open('acao', { presetGoalId: goal.progress.goal.id })
              }
              onManage={() => navigate('/app/metas')}
              onCreateGoal={() => composer.open('meta')}
            />
          </Section>
        </div>

        <Section title="Vitória do dia" level={3}>
          <WinsCard
            wins={planner.wins}
            todayWin={view.todayWin}
            today={planner.today}
            onSave={(text) => planner.saveWin({ day: planner.today, text })}
          />
        </Section>
      </div>

      {reviewLayer}
    </div>
  )
}
