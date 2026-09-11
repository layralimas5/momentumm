import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { countsAsDone, habitsScheduledOn, statusOf } from '@/domain/entities/habit'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { isPending } from '@/domain/entities/task'
import { useAuth } from '@/presentation/auth/use-auth'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { usePlanner } from '@/presentation/planner/use-planner'
import { TAB_ROUTES } from './MobileTabBar'
import { navItemFor } from '@/presentation/layouts/nav-items'

/**
 * Topo do celular: onde a pessoa está, notificações e avatar. Só isso.
 *
 * Em `Hoje` ele cumprimenta e dá a data, porque é a tela que abre o dia. Nas
 * outras fica só a marca: repetir "Boa noite" em cima de "Plano" gastava a
 * primeira dobra com uma frase que não respondia nada. E quando a tela não
 * está na barra de baixo (Hábitos, Progresso, Review...) ou é um detalhe
 * (um objetivo, um desafio), ganha um "voltar" à esquerda: sem ele a única
 * saída era a barra, que não sabia de onde a pessoa tinha vindo.
 *
 * O header do desktop tem busca, atalho de teclado e botão de adicionar. No
 * celular a busca não se usa com uma mão e o adicionar já mora na barra de
 * baixo, ao alcance do polegar.
 */
export function MobileTopBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const alerts = useAlerts()

  const firstName = profile?.name.split(' ')[0] ?? null
  const now = new Date()

  const isHome = pathname === '/app'
  const current = navItemFor(pathname)
  const inTabBar = current ? TAB_ROUTES.includes(current.to) : false
  const detail = current ? pathname !== current.to : false

  const goBack = () => {
    // Histórico do próprio app volta pra onde a pessoa estava; link aberto
    // direto (sem histórico) sobe pra tela pai, e no limite pra Hoje.
    if (hasInAppHistory()) {
      navigate(-1)
      return
    }
    navigate(detail && current ? current.to : '/app')
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md pt-safe">
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          {!isHome && (!inTabBar || detail) ? (
            <button
              type="button"
              onClick={goBack}
              className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors active:bg-surface"
            >
              <Icon name="setaEsq" className="size-5" />
              <span className="sr-only">Voltar</span>
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            {isHome ? (
              <>
                <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
                  {greeting(now)}
                  {firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="mt-0.5 truncate text-sm text-ink-faint">{formatToday(now)}</p>
              </>
            ) : (
              /*
                Fora de Hoje o título visível é o da própria página, logo
                abaixo. Repeti-lo aqui em letra menor seria a mesma palavra
                duas vezes na primeira dobra, então o topo fica com a marca e
                o nome da tela vai só pra leitor de tela.
              */
              <>
                <LogoMark className="size-7" />
                <h1 className="sr-only">{current?.label ?? 'Momentumm'}</h1>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAlertsOpen(true)}
            className="relative grid size-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors active:bg-surface"
          >
            <Icon name="sino" />
            {alerts.length > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-canvas"
              />
            ) : null}
            <span className="sr-only">
              Notificações{alerts.length > 0 ? `: ${alerts.length} pendentes` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/perfil')}
            className="grid size-11 shrink-0 place-items-center rounded-full transition-colors active:bg-surface"
          >
            <Avatar
              name={profile?.name ?? '—'}
              src={profile?.avatarUrl ?? null}
              className="size-9"
              textClassName="text-sm"
            />
            <span className="sr-only">Abrir perfil</span>
          </button>
        </div>
      </header>

      <BottomSheet
        open={alertsOpen}
        title="Precisa da sua atenção"
        onClose={() => setAlertsOpen(false)}
      >
        {alerts.length === 0 ? (
          <p className="pb-2 text-sm text-ink-muted">
            Nada pendente agora. O dia está sob controle.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAlertsOpen(false)
                    navigate(alert.to)
                  }}
                  className="min-h-14 w-full rounded-xl px-3 py-3 text-left text-sm text-ink-muted transition-colors active:bg-surface-hi"
                >
                  {alert.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  )
}

interface Alert {
  readonly id: string
  readonly text: string
  readonly to: string
}

/** Notificação só existe quando há algo real pendente. Sino sem conteúdo é ruído. */
function useAlerts(): Alert[] {
  const planner = usePlanner()
  const alerts: Alert[] = []

  if (planner.streak.atRisk) {
    alerts.push({
      id: 'streak',
      text: `Sua sequência de ${planner.streak.current} dias depende de um registro hoje.`,
      to: '/app',
    })
  }

  const pendingHabits = habitsScheduledOn(planner.habits, planner.today).filter(
    (habit) => !countsAsDone(statusOf(planner.habitLogs, habit.id, planner.today)),
  )
  if (pendingHabits.length > 0) {
    alerts.push({
      id: 'habitos',
      text: `${pendingHabits.length} ${pendingHabits.length === 1 ? 'hábito pendente' : 'hábitos pendentes'} hoje.`,
      to: '/app/habitos',
    })
  }

  const overdue = planner.tasks.filter((task) => isPending(task) && task.day < planner.today)
  if (overdue.length > 0) {
    alerts.push({
      id: 'atrasadas',
      text: `${overdue.length} ${overdue.length === 1 ? 'ação atrasada' : 'ações atrasadas'}. Dá pra adiar sem culpa.`,
      to: '/app',
    })
  }

  const closingGoal = planner.goalProgress.find(
    (progress) => !progress.achieved && progress.daysLeft === 0,
  )
  if (closingGoal) {
    alerts.push({
      id: 'meta',
      text: `Último dia da meta de ${activityType(closingGoal.goal.type).label}.`,
      to: '/app/metas',
    })
  }

  return alerts
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 6) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatToday(now: Date): string {
  const label = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * O React Router numera cada entrada que ele mesmo empilha (`idx`). Zero é a
 * primeira: quem chegou por link direto não tem pra onde voltar dentro do app,
 * e `navigate(-1)` levaria pra fora dele.
 */
function hasInAppHistory(): boolean {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('idx' in state)) return false
  const idx = (state as { idx: unknown }).idx
  return typeof idx === 'number' && idx > 0
}
