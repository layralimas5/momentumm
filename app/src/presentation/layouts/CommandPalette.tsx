import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { cn } from '@/shared/lib/cn'
import { APP_NAV } from './nav-items'

interface Command {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly icon: IconName
  readonly run: () => void
}

/**
 * Busca e comando rápido (Ctrl/Cmd + K). Navegar e criar sem tirar a mão do
 * teclado — e sem inventar uma busca de conteúdo que ainda não existe: o que
 * ela encontra são telas e ações.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const composer = useComposer()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = APP_NAV.map((item) => ({
      id: `nav-${item.to}`,
      label: `Ir para ${item.label}`,
      hint: item.description,
      icon: item.icon,
      run: () => navigate(item.to),
    }))

    const creation: Command[] = [
      {
        id: 'nova-acao',
        label: 'Criar ação',
        hint: 'Uma ação concreta pra hoje ou amanhã',
        icon: 'mais',
        run: () => composer.open('acao'),
      },
      {
        id: 'novo-habito',
        label: 'Criar hábito',
        hint: 'Uma repetição que sustenta a meta',
        icon: 'habitos',
        run: () => composer.open('habito'),
      },
      {
        id: 'nova-meta',
        label: 'Criar meta',
        hint: 'Um número e um período',
        icon: 'metas',
        run: () => composer.open('meta'),
      },
    ]

    return [...creation, ...navigation]
  }, [navigate, composer])

  const filtered = useMemo(() => {
    const term = normalize(query)
    if (!term) return commands

    /*
      Quem casa pelo NOME vem antes de quem casa só pelo texto de apoio: buscar
      "hábitos" e receber "Ir para Hoje" no topo (porque a descrição dele cita
      hábitos) faz o Enter levar pro lugar errado.
    */
    const byLabel: Command[] = []
    const byHint: Command[] = []

    for (const command of commands) {
      if (normalize(command.label).includes(term)) byLabel.push(command)
      else if (normalize(command.hint).includes(term)) byHint.push(command)
    }

    return [...byLabel, ...byHint]
  }, [commands, query])

  const run = (command: Command | undefined) => {
    if (!command) return
    onClose()
    setQuery('')
    command.run()
  }

  return (
    <Dialog
      open={open}
      title="Buscar ou comandar"
      description="Navegue entre as telas ou crie algo sem sair do teclado."
      onClose={onClose}
    >
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((current) => Math.min(filtered.length - 1, current + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((current) => Math.max(0, current - 1))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            run(filtered[active])
          }
        }}
        placeholder="O que você quer fazer?"
        aria-label="Buscar comando"
        className="h-12 w-full rounded-xl border border-line bg-surface-hi px-4 text-ink placeholder:text-ink-faint focus:border-brand"
      />

      <ul className="mt-3 max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-ink-faint">
            Nada encontrado pra “{query}”.
          </li>
        ) : (
          filtered.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => run(command)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  index === active ? 'bg-surface-hi text-ink' : 'text-ink-muted',
                )}
              >
                <Icon name={command.icon} className="size-4 shrink-0 text-ink-faint" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{command.label}</span>
                  <span className="block truncate text-xs text-ink-faint">{command.hint}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  )
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
