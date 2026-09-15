import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * O menu da conta, atrás do avatar.
 *
 * Antes o avatar levava direto pro perfil, e sair da conta só existia no
 * rodapé da sidebar, que o celular não tem. Aqui as três coisas que a pessoa
 * procura no próprio rosto ficam juntas: a conta, as configurações e a saída.
 *
 * No celular abre como bottom sheet (polegar); no desktop, como dropdown
 * ancorado no avatar, igual aos outros menus do header.
 */

interface AccountMenuProps {
  readonly variant: 'mobile' | 'desktop'
}

interface AccountAction {
  readonly key: string
  readonly icon: IconName
  readonly label: string
  readonly hint: string
  readonly run: () => void
}

export function AccountMenu({ variant }: AccountMenuProps) {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || variant !== 'desktop') return
    const onClickAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, variant])

  if (!profile) return null

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  const actions: readonly AccountAction[] = [
    {
      key: 'conta',
      icon: 'trofeu',
      label: 'Minha conta',
      hint: 'Tua evolução, momentum e conquistas',
      run: () => go('/app/perfil'),
    },
    {
      key: 'config',
      icon: 'config',
      label: 'Configurações',
      hint: 'Perfil, visibilidade e plano',
      run: () => go('/app/configuracoes'),
    },
    {
      key: 'sair',
      icon: 'saida',
      label: 'Sair',
      hint: 'Encerrar a sessão neste aparelho',
      run: () => {
        setOpen(false)
        void signOut()
      },
    },
  ]

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-colors',
        variant === 'mobile' ? 'size-11 active:bg-surface' : 'size-10 hover:bg-surface',
      )}
    >
      <Avatar name={profile.name} src={profile.avatarUrl} className="size-9" textClassName="text-sm" />
      <span className="sr-only">Menu da conta</span>
    </button>
  )

  if (variant === 'mobile') {
    return (
      <>
        {trigger}
        <BottomSheet open={open} title={profile.name} description={user?.email ?? `@${profile.handle}`} onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-1 pb-2">
            {actions.map((action) => (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={action.run}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors active:bg-surface-hi"
                >
                  <Icon name={action.icon} className="size-5 shrink-0 text-ink-faint" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{action.label}</span>
                    <span className="block text-xs text-ink-faint">{action.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      </>
    )
  }

  return (
    <div ref={ref} className="relative shrink-0">
      {trigger}
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-xl border border-line-hi bg-surface-top py-1 shadow-xl"
        >
          <div className="border-b border-line px-3.5 py-2.5">
            <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
            <p className="truncate text-xs text-ink-faint">{user?.email ?? `@${profile.handle}`}</p>
          </div>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={action.run}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink"
            >
              <Icon name={action.icon} className="size-4" />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
