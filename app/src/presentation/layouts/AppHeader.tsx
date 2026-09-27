import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AccountMenu } from '@/presentation/components/account/AccountMenu'
import { ThemeToggle } from '@/presentation/theme/ThemeToggle'
import { Button } from '@/presentation/components/ui/Button'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { useFeature } from '@/presentation/plan/use-feature'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { useDayAlerts } from '@/presentation/planner/use-day-alerts'
import { usePlanner } from '@/presentation/planner/use-planner'
import { markShareNudgeSeen } from '@/presentation/share/share-nudge'
import { cn } from '@/shared/lib/cn'
import { CommandPalette } from './CommandPalette'
import { navItemFor } from './nav-items'

/** O nome da tela atual, pra barra dizer onde a pessoa está. */
function titleOf(pathname: string): string {
  return navItemFor(pathname)?.label ?? 'Momentumm'
}

/**
 * Header do app: onde você está, a data e as três ações que a pessoa realmente
 * usa, buscar, ver o que precisa de atenção e adicionar. Nada de métrica
 * aqui: número no topo compete com a prioridade do dia e sempre perde.
 */
export function AppHeader() {
  const { pathname } = useLocation()
  const pageTitle = titleOf(pathname)
  const [paletteOpen, setPaletteOpen] = useState(false)

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
        <div className="flex w-full items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8 2xl:px-10">
          {/*
            A barra diz ONDE você está, não "bom dia".

            A saudação vive no topo do dashboard, com o nome e a frase de
            contexto do dia. Ter as duas na mesma dobra era literalmente a mesma
            frase duas vezes antes de qualquer conteúdo, e num header que
            acompanha todas as telas, "bom dia" não orienta ninguém.
          */}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
              {pageTitle}
            </h1>
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

          <ThemeToggle />

          <Notifications />

          <AddMenu />

          <AccountMenu variant="desktop" />
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}

/**
 * O menu do "Adicionar".
 *
 * Os quatro primeiros abrem formulário; a dupla é o único que NAVEGA, porque
 * convidar alguém não é preencher campo, é gerar um link e mandar. Ela fica
 * aqui pelo mesmo motivo da folha do celular: é o botão que a pessoa procura
 * quando quer colocar mais uma coisa em movimento, e uma pessoa é uma delas.
 */
function AddMenu() {
  const composer = useComposer()
  const navigate = useNavigate()
  const juntos = useFeature('juntos')
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

  const pick = (kind: 'acao' | 'habito' | 'meta' | 'objetivo') => {
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
          <MenuItem icon="objetivo" onClick={() => pick('objetivo')}>
            Novo objetivo
          </MenuItem>
          {juntos.enabled ? (
            <MenuItem
              icon="metas"
              onClick={() => {
                setOpen(false)
                navigate('/app/juntos')
              }}
            >
              Uma pessoa na dupla
            </MenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * O sino: o que precisa da sua atenção, e o botão de dizer "já li".
 *
 * A conta é a MESMA da tela Hoje (`useDayAlerts`). Existia uma cópia dela aqui
 * dentro, servindo só ao sino, e duas contas com o mesmo nome dão dois números
 * diferentes na primeira mudança de regra.
 *
 * ## Apagar depois de ver
 *
 * Cada linha tem um X, e o rodapé limpa a lista inteira. Um aviso que não some
 * depois de lido vira mobília: no segundo dia o olho pula, no terceiro a tela
 * perde autoridade. A marca vale pelo DIA, se o motivo continuar de pé amanhã,
 * o recado volta, porque esconder um problema para sempre porque alguém o viu
 * uma vez seria o app mentindo por educação. Resolvido, ele nem volta: a lista
 * nasce do estado real, não de uma fila guardada.
 */
function Notifications() {
  const { alerts, hasDismissed, dismiss, dismissAll } = useDayAlerts()
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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <Icon name="sino" />
        {alerts.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-canvas"
          />
        ) : null}
        <span className="sr-only">
          Notificações{alerts.length > 0 ? `: ${alerts.length} pendentes` : ''}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-xl border border-line-hi bg-surface-top shadow-xl">
          <p className="border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-ink-faint uppercase">
            Precisa da sua atenção
          </p>

          {alerts.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-muted">
              {hasDismissed
                ? 'Tudo dispensado por hoje. O que continuar pendente volta amanhã.'
                : 'Nada pendente agora. O dia está sob controle.'}
            </p>
          ) : (
            <>
              <ul>
                {alerts.map((alert) => (
                  /*
                    Dois alvos na mesma linha, como nos cartões do celular: o
                    texto leva pra tela que resolve, o X diz "já li". Um botão
                    dentro de outro seria um alvo dentro de outro.
                  */
                  <li key={alert.id} className="flex items-start gap-1 border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        // Convite atendido não volta no mesmo dia.
                        if (alert.id === 'compartilhar') markShareNudgeSeen(planner.today)
                        navigate(alert.to)
                      }}
                      className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-surface-hi"
                    >
                      <span className="block text-sm text-ink">{alert.title}</span>
                      <span className="mt-0.5 block text-sm text-pretty text-ink-faint">
                        {alert.body}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => dismiss(alert.id)}
                      className="mt-2 mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
                    >
                      <Icon name="fechar" className="size-3.5" />
                      <span className="sr-only">Dispensar: {alert.title}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={dismissAll}
                className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-medium text-ink-faint transition-colors hover:bg-surface-hi hover:text-ink"
              >
                Limpar tudo
              </button>
            </>
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
  icon: IconName
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


function formatToday(now: Date): string {
  return now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}
