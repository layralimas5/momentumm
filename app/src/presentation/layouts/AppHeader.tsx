import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { activityType } from '@/domain/entities/activity-type'
import { countsAsDone, habitsScheduledOn, statusOf } from '@/domain/entities/habit'
import { initialsOf } from '@/domain/entities/profile'
import { isPending } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAuth } from '@/presentation/auth/use-auth'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { CommandPalette } from './CommandPalette'

/**
 * Header do app. Saudação, data e as três ações que a pessoa realmente usa:
 * buscar, ver o que precisa de atenção e adicionar. Nada de métrica aqui —
 * número no topo compete com a prioridade principal e sempre perde.
 */
export function AppHeader({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { profile } = useAuth()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const firstName = profile?.name.split(' ')[0] ?? null
  const now = new Date()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[112rem] items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          {onOpenMenu ? (
            <button
              type="button"
              onClick={onOpenMenu}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink lg:hidden"
            >
              <Icon name="habitos" />
              <span className="sr-only">Abrir navegação</span>
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-0.5 hidden truncate text-sm text-ink-muted sm:block">
              Vamos transformar intenção em movimento.
            </p>
          </div>

          <p className="hidden shrink-0 items-center gap-2 text-sm text-ink-faint lg:flex">
            <Icon name="calendario" className="size-4" />
            {formatToday(now)}
          </p>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-10 w-64 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm whitespace-nowrap text-ink-faint transition-colors hover:border-line-hi hover:text-ink-muted xl:flex"
          >
            <Icon name="busca" className="size-4" />
            <span className="flex-1 truncate text-left">Buscar ou comandar</span>
            <kbd className="rounded border border-line-hi px-1.5 py-0.5 text-[11px] text-ink-faint">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink xl:hidden"
          >
            <Icon name="busca" />
            <span className="sr-only">Buscar ou comandar</span>
          </button>

          <Notifications />

          <AddMenu />

          <span
            aria-hidden="true"
            className="hidden size-9 shrink-0 place-items-center rounded-full bg-brand-dim text-sm font-semibold text-brand-hi sm:grid"
          >
            {profile ? initialsOf(profile.name) : '—'}
          </span>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}

function AddMenu() {
  const composer = useComposer()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const pick = (kind: 'acao' | 'habito' | 'meta') => {
    setOpen(false)
    composer.open(kind)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <Button size="sm" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <Icon name="mais" className="size-4" />
        <span className="hidden sm:inline">Adicionar</span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-line-hi bg-surface-top py-1 shadow-xl"
        >
          <MenuItem icon="jornada" onClick={() => pick('acao')}>
            Nova ação
          </MenuItem>
          <MenuItem icon="habitos" onClick={() => pick('habito')}>
            Novo hábito
          </MenuItem>
          <MenuItem icon="metas" onClick={() => pick('meta')}>
            Nova meta
          </MenuItem>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Notificações que existem de verdade: sequência em risco, hábito pendente,
 * ação atrasada. Sino com bolinha sem conteúdo é ruído.
 */
function Notifications() {
  const planner = usePlanner()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const items: { id: string; text: string; to: string }[] = []

  if (planner.streak.atRisk) {
    items.push({
      id: 'streak',
      text: `Sua sequência de ${planner.streak.current} dias depende de um registro hoje.`,
      to: '/app',
    })
  }

  const pendingHabits = habitsScheduledOn(planner.habits, planner.today).filter(
    (habit) => !countsAsDone(statusOf(planner.habitLogs, habit.id, planner.today)),
  )
  if (pendingHabits.length > 0) {
    items.push({
      id: 'habitos',
      text: `${pendingHabits.length} ${pendingHabits.length === 1 ? 'hábito pendente' : 'hábitos pendentes'} hoje.`,
      to: '/app/habitos',
    })
  }

  const overdue = planner.tasks.filter((task) => isPending(task) && task.day < planner.today)
  if (overdue.length > 0) {
    items.push({
      id: 'atrasadas',
      text: `${overdue.length} ${overdue.length === 1 ? 'ação atrasada' : 'ações atrasadas'}. Dá pra adiar sem culpa.`,
      to: '/app',
    })
  }

  const behindGoal = planner.goalProgress.find(
    (progress) => !progress.achieved && progress.daysLeft === 0,
  )
  if (behindGoal) {
    items.push({
      id: 'meta',
      text: `Último dia da meta de ${activityType(behindGoal.goal.type).label}.`,
      to: '/app/metas',
    })
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Icon name="sino" />
        {items.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-canvas"
          />
        ) : null}
        <span className="sr-only">
          Notificações{items.length > 0 ? `: ${items.length} pendentes` : ''}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-xl border border-line-hi bg-surface-top shadow-xl">
          <p className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-ink-faint uppercase">
            Precisa da sua atenção
          </p>
          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-muted">
              Nada pendente agora. O dia está sob controle.
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate(item.to)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink"
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: 'jornada' | 'habitos' | 'metas'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink-muted',
        'transition-colors hover:bg-surface-hi hover:text-ink',
      )}
    >
      <Icon name={icon} className="size-4" />
      {children}
    </button>
  )
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 6) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatToday(now: Date): string {
  return now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}
