import { useCallback, useEffect, useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { addDays } from '@/domain/entities/day'
import { countsAsDone, habitsScheduledOn, statusOf } from '@/domain/entities/habit'
import { isDone, isPending } from '@/domain/entities/task'
import type { IconName } from '@/presentation/components/ui/Icon'
import { usePlanner } from '@/presentation/planner/use-planner'
import {
  dismissAlert,
  dismissAllAlerts,
  dismissedAlerts,
} from '@/presentation/planner/alert-dismissals'
import { useClubInvites } from '@/presentation/clubs/use-club-invites'
import { shareNudgeSeen } from '@/presentation/share/share-nudge'
import { useMyRequests, withAnswer } from '@/presentation/support/use-my-requests'

export type AlertTone = 'danger' | 'warn' | 'brand' | 'positive'

/**
 * Um recado que pede decisão.
 *
 * Duas linhas, sempre no mesmo formato: a primeira diz o tamanho do problema
 * ("2 ações atrasadas."), a segunda diz o que dá pra fazer com ele ("Dá pra
 * reorganizar."). A separação existe porque as duas são lidas em velocidades
 * diferentes, o título de relance, o corpo só quando o título interessou.
 */
export interface DayAlert {
  readonly id: string
  readonly tone: AlertTone
  readonly icon: IconName
  readonly title: string
  readonly body: string
  readonly to: string
}

/**
 * Os recados do dia, em ordem de urgência.
 *
 * Existia uma cópia disso dentro da barra de cima, servindo só ao sino. O
 * problema é que notificação escondida atrás de um ícone não muda
 * comportamento nenhum: quem abre o app às 7h da manhã e tem duas ações
 * atrasadas precisa ver isso na tela, não descobrir tocando num sino.
 *
 * Agora a conta é uma só e serve os dois: a tela Hoje mostra os primeiros em
 * cartão, o sino guarda a lista inteira. Duas contas com o mesmo nome dariam
 * dois números diferentes na primeira mudança de regra.
 *
 * Recado só entra quando existe algo real pendente E quando ele muda uma
 * decisão de hoje. "Tudo certo" não é alerta.
 */
export interface DayAlertsView {
  /** Os recados que ainda valem hoje: o que foi dispensado não vem. */
  readonly alerts: readonly DayAlert[]
  /** Existe recado dispensado hoje? O sino usa pra explicar a lista vazia. */
  readonly hasDismissed: boolean
  /** Lido, sai da tela. Volta amanhã se o motivo continuar de pé. */
  dismiss(id: string): void
  /** Limpa a lista inteira de uma vez. Mesma regra: vale pelo dia. */
  dismissAll(): void
}

export function useDayAlerts(): DayAlertsView {
  const planner = usePlanner()
  const { requests } = useMyRequests()
  const { invites } = useClubInvites()
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() =>
    dismissedAlerts(planner.today),
  )

  /*
    Virou o dia com o app aberto (quem deixa o Momentumm em segundo plano à
    noite): a lista de ontem para de valer sozinha, sem precisar recarregar.
  */
  useEffect(() => {
    setDismissed(dismissedAlerts(planner.today))
  }, [planner.today])

  const dismiss = useCallback(
    (id: string) => {
      setDismissed(dismissAlert(planner.today, id))
    },
    [planner.today],
  )

  const alerts: DayAlert[] = []

  /*
    Convite de clube antes de tudo: é o único recado aqui que tem alguém do
    outro lado esperando uma resposta, e o único que não se resolve sozinho
    com o tempo. Um por convite, com o nome de quem chamou: "você tem convites"
    obrigaria a abrir a tela pra descobrir de quem.
  */
  for (const invite of invites) {
    alerts.push({
      id: `clube:${invite.id}`,
      tone: 'brand',
      icon: 'objetivo',
      title: `${invite.inviterName} te chamou pro clube ${invite.clubName}.`,
      body: 'Toca pra aceitar ou recusar.',
      to: '/app/clubes',
    })
  }

  /*
    Resposta de suporte primeiro: é a única que vem de outra pessoa, e a única
    que a pessoa não descobre sozinha olhando a tela.
  */
  const answered = withAnswer(requests)
  const firstAnswered = answered[0]
  if (firstAnswered) {
    alerts.push({
      id: 'suporte',
      tone: 'brand',
      icon: 'sino',
      title:
        answered.length === 1
          ? `A equipe respondeu o chamado ${firstAnswered.protocol}.`
          : `${answered.length} chamados com resposta da equipe.`,
      body: 'Toca pra ler a resposta.',
      to: '/app/suporte',
    })
  }

  const overdue = planner.tasks.filter((task) => isPending(task) && task.day < planner.today)
  if (overdue.length > 0) {
    alerts.push({
      id: 'atrasadas',
      tone: 'danger',
      icon: 'relogio',
      title: `${overdue.length} ${overdue.length === 1 ? 'ação atrasada' : 'ações atrasadas'}.`,
      body: 'Dá pra reorganizar.',
      to: '/app/plano',
    })
  }

  /*
    O que ontem deixou em aberto.

    Não é cobrança e o texto diz isso na cara: o hábito que não saiu ontem não
    vira dívida hoje. O recado existe porque a pessoa decide melhor o dia
    sabendo o que ficou pra trás, e porque descobrir isso só no fim da semana,
    no gráfico, é tarde demais pra mudar alguma coisa.
  */
  const yesterday = addDays(planner.today, -1)
  const missedYesterday = habitsScheduledOn(planner.habits, yesterday).filter(
    (habit) => !countsAsDone(statusOf(planner.habitLogs, habit.id, yesterday)),
  )
  if (missedYesterday.length > 0) {
    alerts.push({
      id: 'ontem',
      tone: 'warn',
      icon: 'insights',
      title: `Ontem ${missedYesterday.length === 1 ? 'ficou 1 hábito' : `ficaram ${missedYesterday.length} hábitos`} sem sair.`,
      body: 'Não precisa compensar: escolhe o que ainda faz sentido hoje e segue daqui.',
      to: '/app/habitos',
    })
  }

  if (planner.streak.atRisk) {
    alerts.push({
      id: 'streak',
      tone: 'warn',
      icon: 'fogo',
      title: `Sua sequência de ${planner.streak.current} dias depende de hoje.`,
      body: 'Um registro qualquer mantém ela viva.',
      to: '/app',
    })
  }

  const pendingHabits = habitsScheduledOn(planner.habits, planner.today).filter(
    (habit) => !countsAsDone(statusOf(planner.habitLogs, habit.id, planner.today)),
  )
  if (pendingHabits.length > 0) {
    alerts.push({
      id: 'habitos',
      tone: 'brand',
      icon: 'habitos',
      title: `${pendingHabits.length} ${pendingHabits.length === 1 ? 'hábito pendente' : 'hábitos pendentes'} hoje.`,
      body: 'Marcar leva um toque.',
      to: '/app/habitos',
    })
  }

  const closingGoal = planner.goalProgress.find(
    (progress) => !progress.achieved && progress.daysLeft === 0,
  )
  if (closingGoal) {
    alerts.push({
      id: 'meta',
      tone: 'brand',
      icon: 'metas',
      title: `Último dia da meta de ${activityType(closingGoal.goal.type).label}.`,
      body: 'Ainda dá tempo de fechar.',
      to: '/app/metas',
    })
  }

  /*
    O convite de mostrar o Momentumm. Depois de um dia com movimento e uma vez
    por dia: o card é o que traz gente nova pro app, e quem acabou de fechar
    uma ação é quem tem o que mostrar.
  */
  const movedToday =
    planner.tasks.some((task) => isDone(task) && task.day === planner.today) ||
    habitsScheduledOn(planner.habits, planner.today).some((habit) =>
      countsAsDone(statusOf(planner.habitLogs, habit.id, planner.today)),
    )
  if (movedToday && !shareNudgeSeen(planner.today)) {
    alerts.push({
      id: 'compartilhar',
      tone: 'positive',
      icon: 'compartilhar',
      title: 'Teu dia rendeu.',
      body: 'Mostra o teu Momentumm nos stories.',
      to: '/app#compartilhar',
    })
  }

  const visible = alerts.filter((alert) => !dismissed.has(alert.id))

  return {
    alerts: visible,
    hasDismissed: alerts.some((alert) => dismissed.has(alert.id)),
    dismiss,
    dismissAll: () => {
      setDismissed(dismissAllAlerts(planner.today, visible.map((alert) => alert.id)))
    },
  }
}
