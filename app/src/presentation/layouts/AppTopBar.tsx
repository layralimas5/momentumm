import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { StreakBadge } from '@/presentation/components/ds/Badges'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useDayAlerts } from '@/presentation/planner/use-day-alerts'
import { usePlanner } from '@/presentation/planner/use-planner'
import { markShareNudgeSeen } from '@/presentation/share/share-nudge'
import { isShellRoot, ownsTitle, PROFILE_PATH, sectionLabelFor, tabFor } from './shell-nav'

/**
 * O topo de todas as telas: marca e seção à esquerda, sequência e avatar à
 * direita. O sino só aparece quando há algo pendente: um ícone sempre aceso
 * ensina a ignorá-lo.
 */
export function AppTopBar() {
  const { profile } = useAuth()
  const planner = usePlanner()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const { alerts, dismiss, dismissAll } = useDayAlerts()

  const root = isShellRoot(pathname)
  const label = sectionLabelFor(pathname)

  const goBack = () => {
    if (hasInAppHistory()) {
      navigate(-1)
      return
    }
    navigate(tabFor(pathname)?.to ?? '/app')
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-canvas/60 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5 sm:px-6">
          {root ? null : (
            <button
              type="button"
              onClick={goBack}
              className="chip press grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted"
            >
              <Icon name="setaEsq" className="size-5" />
              <span className="sr-only">Voltar</span>
            </button>
          )}

          <p className="eyebrow min-w-0 flex-1 truncate text-[0.8rem] tracking-[0.16em] text-ink-muted" aria-hidden="true">
            {ownsTitle(pathname) ? null : label}
          </p>
          <h1 className="sr-only">{label}</h1>

          {alerts.length > 0 ? (
            <button
              type="button"
              onClick={() => setAlertsOpen(true)}
              className="chip press relative grid size-10 shrink-0 place-items-center rounded-full text-ink-muted"
            >
              <Icon name="sino" className="size-[1.15rem]" />
              <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-surface" />
              <span className="sr-only">Notificações: {alerts.length} pendentes</span>
            </button>
          ) : null}

          <StreakBadge days={planner.streak.current} atRisk={planner.streak.atRisk} />

          <Link
            to={PROFILE_PATH}
            className="press shrink-0 rounded-full p-0.5 ring-2 ring-surface shadow-[var(--shadow-card)]"
          >
            <Avatar name={profile?.name ?? 'Você'} src={profile?.avatarUrl ?? null} className="size-10" textClassName="text-sm" />
            <span className="sr-only">Abrir teu perfil</span>
          </Link>
        </div>
      </header>

      <BottomSheet open={alertsOpen} title="Precisa da sua atenção" onClose={() => setAlertsOpen(false)}>
        <ul className="flex flex-col gap-1">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen(false)
                  if (alert.id === 'compartilhar') markShareNudgeSeen(planner.today)
                  navigate(alert.to)
                }}
                className="min-h-14 min-w-0 flex-1 rounded-xl px-3 py-3 text-left transition-colors active:bg-surface-hi"
              >
                <span className="block text-sm font-medium text-ink">{alert.title}</span>
                <span className="mt-0.5 block text-sm text-pretty text-ink-faint">{alert.body}</span>
              </button>
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi"
              >
                <Icon name="fechar" className="size-4" />
                <span className="sr-only">Dispensar: {alert.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            dismissAll()
            setAlertsOpen(false)
          }}
          className="mt-2 min-h-11 w-full rounded-xl text-sm font-medium text-ink-muted transition-colors active:bg-surface-hi"
        >
          Limpar tudo
        </button>
      </BottomSheet>
    </>
  )
}

function hasInAppHistory(): boolean {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null || !('idx' in state)) return false
  const idx = (state as { idx: unknown }).idx
  return typeof idx === 'number' && idx > 0
}
