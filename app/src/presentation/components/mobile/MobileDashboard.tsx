import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DayLoad } from '@/domain/entities/adaptive-day'
import type { Task } from '@/domain/entities/task'
import type { DayKey } from '@/domain/entities/day'
import { summarizeDay } from '@/domain/entities/day-summary'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFocus } from '@/presentation/focus/use-focus'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import {
  focusSummary,
  goalsSummary,
  insightSummary,
  objectivesSummary,
  winsSummary,
} from '@/domain/entities/day-shortcuts'
import type { DashboardView } from '@/presentation/planner/use-dashboard'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useDayAlerts } from '@/presentation/planner/use-day-alerts'
import { ContextualFab } from './ContextualFab'
import { MobileAlerts } from './MobileAlerts'
import { MobileCheckIn } from './MobileCheckIn'
import { DaySheet } from './DaySheet'
import { AdaptiveDayCard } from '@/presentation/components/dashboard/AdaptiveDayCard'
import { MobileTodayStats } from './MobileTodayStats'
import { MobileWeekStrip } from './MobileWeekStrip'
import { NextUpCard } from '@/presentation/components/dashboard/NextUpCard'
import { DayAgendaCard } from '@/presentation/components/dashboard/DayAgendaCard'
import { MobileMore } from './MobileMore'
import { MobileShortcutRows, type ShortcutRow } from './MobileShortcutRows'
import { MobilePriority } from './MobilePriority'
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
}

/**
 * O dashboard do celular.
 *
 * A ordem responde ao uso real: quem abre o app no meio do dia quer registrar
 * como está, ver o que importa e começar, nessa sequência. Análise (momentum,
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
}: MobileDashboardProps) {
  const planner = usePlanner()
  const composer = useComposer()
  const focus = useFocus()
  const alerts = useDayAlerts()
  const navigate = useNavigate()

  /*
    O dia aberto pela faixa da semana. Só o dia é guardado, e não o resumo: o
    resumo é uma função pura dos dados que já estão aqui, então recalcular ao
    abrir é mais barato do que manter uma cópia que envelhece a cada hábito
    marcado.
  */
  const [pickedDay, setPickedDay] = useState<DayKey | null>(null)

  const pickedSummary = useMemo(
    () =>
      pickedDay
        ? summarizeDay(
            {
              activities: planner.activities,
              habits: planner.habits,
              habitLogs: planner.habitLogs,
              tasks: planner.tasks,
              checkIns: planner.checkIns,
              wins: planner.wins,
            },
            pickedDay,
          )
        : null,
    [
      pickedDay,
      planner.activities,
      planner.habits,
      planner.habitLogs,
      planner.tasks,
      planner.checkIns,
      planner.wins,
    ],
  )

  const checkInRef = useRef<HTMLDivElement>(null)
  const priorityRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLDivElement>(null)
  const planRef = useRef<HTMLDivElement>(null)

  /*
    As linhas do "ver mais". A ordem é a do ciclo do produto, objetivo vira
    meta, meta vira leitura do ritmo, e foco e vitórias são o registro do que
    saiu. Linha sem número nenhum fica de fora: "Vitórias" sem número não convida
    ninguém a tocar.
  */
  const atalhos = useMemo<ShortcutRow[]>(() => {
    const objetivos = objectivesSummary(view.objectives.map((item) => item.progress))
    const metas = goalsSummary(view.goalsInMotion.map((item) => item.progress))
    const leitura = insightSummary(view.insight !== null)
    const foco = focusSummary(view.focusMinutesToday)
    const vitorias = winsSummary(planner.wins, planner.today)

    const linhas: ShortcutRow[] = [
      { to: '/app/objetivos', icon: 'trofeu', label: 'Objetivos', ...objetivos },
      { to: '/app/metas', icon: 'metas', label: 'Metas', ...metas },
      { to: '/app/insights', icon: 'insights', label: 'Leitura do ritmo', ...leitura },
      { to: '/app/foco', icon: 'relogio', label: 'Sessão de foco', ...foco },
      { to: '/app/jornada', icon: 'jornada', label: 'Vitórias', ...vitorias },
    ]
    return linhas.filter((row) => row.value !== null)
  }, [
    view.objectives,
    view.goalsInMotion,
    view.insight,
    view.focusMinutesToday,
    planner.wins,
    planner.today,
  ])

  /*
    A ordem do celular é uma narrativa vertical, não o desktop espremido, e a
    tela responde três perguntas, nessa ordem:

      o que ficou pra trás -> como cheguei -> o que importa hoje -> estou avançando.

    O que mudou: a frase do dia, a faixa da semana e os três números abriam a
    tela. Três blocos de leitura antes da primeira decisão, e a ação do dia
    nascendo abaixo da dobra todo dia. Eles não sumiram, desceram pra depois
    do botão de começar, que é onde leitura é leitura e não obstáculo.

    No lugar deles entraram os recados: as ações atrasadas e o que ontem
    deixou em aberto, que estavam escondidos atrás do sino. É o que ficou pra
    trás que decide o tamanho do dia, então ele vem antes de montar o dia.

    A energia continua ANTES da ação, porque é ela que define o tamanho da
    sessão, a sugestão de foco e se a versão mínima aparece na frente. Perguntar
    depois de mostrar o dia inverteria a única pergunta que muda o que a tela
    oferece.

    Depois da ação vem o resto do dia recolhido, os hábitos como suporte, e o
    pulso da semana. Análise longa (objetivos, insight, metas, sessões) fica no
    fim: ninguém interpreta gráfico de pé no ponto de ônibus.
  */
  return (
    <div className="flex flex-col gap-5">
      {/* 1. O que ficou pra trás. Dois recados, no máximo, e cada um com a
          saída ao lado: é o que determina o tamanho do dia que vem logo
          abaixo. O resto da lista continua no sino. */}
      <MobileAlerts alerts={alerts.alerts} onDismiss={alerts.dismiss} />

      {/* 2. A pergunta que monta o dia: vem antes dele, nunca depois. Respondida,
          ela encolhe pra uma linha e a ação assume a primeira dobra. */}
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
            dayProgress={view.dayProgress}
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

      {/* 4. O gás e o contexto, depois da decisão.

          A frase abria a tela, e ela é a única coisa aqui que não muda decisão
          nenhuma: em cima, empurrava a ação do dia pra fora da primeira dobra
          todo santo dia. Logo abaixo do botão de começar, ela é o empurrão que
          a pessoa lê no segundo exato em que precisa dele.

          A semana e os três números vêm na sequência porque respondem "estou
          avançando", leitura, não ação. */}
      <QuoteCard today={planner.today} compact />

      <MobileWeekStrip week={view.week} onPickDay={setPickedDay} />

      <MobileTodayStats
        momentum={view.momentum}
        done={view.dayProgress.done}
        total={view.dayProgress.total}
        focusMinutes={view.focusMinutesToday}
      />

      {/*
        O dia inteiro, em ordem de relógio.

        Aqui estava o "resto do dia" recolhido, que prometia N ações e abria com
        as tres do foco, e os hábitos vinham num card separado mais abaixo. Eram
        duas listas do mesmo dia, mais duas telas pra completar a conta. Agora é
        uma: ação, hábito e compromisso, agrupados por trecho do dia, todos com
        o check na própria linha.
      */}
      <div id="seu-dia" className="scroll-mt-20">
        <DayAgendaCard
          agenda={view.agenda}
          onStartFocus={onStartFocus}
          onAdd={() => composer.open('acao')}
          onOpenRoutine={() => navigate('/app/rotina')}
          onAddRoutine={() => navigate('/app/rotina?novo=1')}
          onEditTask={(task) => composer.open('acao', { editing: task })}
          onEditRoutine={(itemId) => navigate(`/app/rotina?editar=${itemId}`)}
          onEditHabit={(habitId) => {
            const habit = planner.habits.find((entry) => entry.id === habitId)
            if (habit) composer.open('habito', { editingHabit: habit })
          }}
        />
      </div>

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

      {/*
        O compartilhar fica na rolagem principal, colado no avanço da semana:
        é logo depois de ver o progresso que dá vontade de mostrar. Dentro do
        "ver mais" ele virava um recurso que só quem procura encontra, e o
        card do Momentumm é o que traz gente nova pro app.

        A fileira continua aparecendo só quando existe momento digno de card,
        pela mesma razão de sempre: botão sempre visível vira mobília.
      */}
      <div id="compartilhar" className="scroll-mt-24">
        <ShareMomentsRow view={view} />
      </div>

      {/*
        Consulta e registro do fim do dia, recolhidos.

        Nada saiu do app: a próxima do plano, os objetivos, o insight, as
        sessões, as metas e as vitórias continuam aqui, a um toque, e também
        nas telas próprias. O que mudou é que eles pararam de disputar a
        rolagem com a decisão do dia.
      */}
      <MobileMore>
        {/*
          A próxima do plano continua como card: é a única coisa aqui que é do
          DIA, e que a pessoa pode começar sem sair da tela.
        */}
        <NextUpCard
          nextUp={view.nextUp}
          mainPriority={view.mainPriority}
          today={planner.today}
          onStartFocus={onStartFocus}
          onBringToToday={(task) => void onBringToToday(task)}
        />

        {/*
          O resto do produto em uma linha cada.

          Aqui havia seis cards completos, objetivos com parágrafo de
          diagnóstico, metas em carrossel, insight com dois botões, seletor de
          foco e campo de vitórias. Seis telas de rolagem, todas versões
          encolhidas de telas que já existem. O resumo de uma tela não
          substitui a tela: compete com ela, e perde.

          Fica o número que faz decidir se vale abrir. O toque leva pro lugar
          onde a coisa é feita de verdade.
        */}
        <MobileShortcutRows rows={atalhos} />
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

      <DaySheet summary={pickedSummary} today={planner.today} onClose={() => setPickedDay(null)} />

      {/*
        Respiro no fim da rolagem: o botão flutuante paira sobre o conteúdo, e
        sem essa faixa ele cobriria as vitórias anteriores, que são a última
        coisa da tela.
      */}
      <span aria-hidden="true" className="h-14 shrink-0" />
    </div>
  )
}
