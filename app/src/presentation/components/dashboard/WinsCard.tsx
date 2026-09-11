import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DayKey } from '@/domain/entities/day'
import { formatDayLabel } from '@/domain/entities/day'
import { MAX_WIN_LENGTH, recentWins, type Win } from '@/domain/entities/win'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

interface WinsCardProps {
  readonly wins: readonly Win[]
  readonly todayWin: Win | null
  readonly today: DayKey
  readonly onSave: (text: string) => Promise<void>
}

/**
 * Pequenas vitórias.
 *
 * Compacto de propósito: é uma linha por dia, não um diário. A sensação de "não
 * saí do lugar" quase sempre é falha de registro, e três linhas antigas na tela
 * desmentem isso mais rápido que qualquer gráfico.
 */
export function WinsCard({ wins, todayWin, today, onSave }: WinsCardProps) {
  const [text, setText] = useState(todayWin?.text ?? '')
  const [editing, setEditing] = useState(todayWin === null)

  const save = useAsyncAction(async () => {
    await onSave(text)
    setEditing(false)
  })

  const previous = recentWins(wins, today)
  const canSave = text.trim().length >= 2

  return (
    <Panel aria-labelledby="vitorias-titulo">
      <PanelHeader
        id="vitorias-titulo"
        title="Pequenas vitórias"
        icon="trofeu"
        action={
          todayWin && !editing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(todayWin.text)
                setEditing(true)
              }}
            >
              Editar
            </Button>
          ) : null
        }
      />

      {todayWin && !editing ? (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-positive/25 bg-positive/5 px-3.5 py-3 text-sm text-ink"
        >
          {todayWin.text}
        </motion.p>
      ) : (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSave) void save.run()
          }}
        >
          <label htmlFor="win-input" className="text-sm text-ink-muted">
            O que avançou hoje, mesmo que tenha sido pequeno?
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="win-input"
              value={text}
              maxLength={MAX_WIN_LENGTH}
              onChange={(event) => setText(event.target.value)}
              placeholder="Abri o livro, mesmo sem energia."
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-hi px-3.5 text-ink placeholder:text-ink-faint transition-colors focus:border-brand"
            />
            <Button type="submit" disabled={!canSave} loading={save.running}>
              <Icon name="check" className="size-4" />
              <span className="sr-only sm:not-sr-only">Salvar</span>
            </Button>
          </div>
          <div aria-live="polite" className="min-h-5">
            {save.error ? <p className="mt-1.5 text-sm text-danger">{save.error}</p> : null}
          </div>
        </form>
      )}

      {previous.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
          {previous.map((win) => (
            <li key={win.id} className="flex gap-2.5 text-xs text-ink-faint">
              <span className="shrink-0 tabular">{formatDayLabel(win.day, today)}</span>
              <span className="truncate text-ink-muted">{win.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}
