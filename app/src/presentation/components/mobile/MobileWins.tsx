import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { DayKey } from '@/domain/entities/day'
import { formatDayLabel } from '@/domain/entities/day'
import { MAX_WIN_LENGTH, WIN_SUGGESTIONS, recentWins, type Win } from '@/domain/entities/win'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { MobileSection } from './MobileSection'

interface MobileWinsProps {
  readonly wins: readonly Win[]
  readonly todayWin: Win | null
  readonly today: DayKey
  readonly onSave: (text: string) => Promise<void>
}

/**
 * Pequenas vitórias no fim da tela.
 *
 * Uma linha por dia, com sugestões prontas: no celular, digitar é a maior
 * fricção que existe: tocar numa sugestão já resolve o registro pra quem está
 * de pé no ônibus.
 */
export function MobileWins({ wins, todayWin, today, onSave }: MobileWinsProps) {
  const [text, setText] = useState(todayWin?.text ?? '')
  const [editing, setEditing] = useState(todayWin === null)
  const [justSaved, setJustSaved] = useState(false)

  const save = useAsyncAction(async () => {
    await onSave(text)
    setEditing(false)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2200)
  })

  const previous = recentWins(wins, today, 2)
  const canSave = text.trim().length >= 2

  return (
    <MobileSection title="Pequenas vitórias" icon="trofeu">
      <div className="surface-card p-4">
        {todayWin && !editing ? (
          <div className="flex items-start gap-3">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
            <p className="min-w-0 flex-1 text-sm text-ink">{todayWin.text}</p>
            <button
              type="button"
              onClick={() => {
                setText(todayWin.text)
                setEditing(true)
              }}
              className="-my-2 -mr-2 min-h-11 shrink-0 px-2 text-sm text-ink-faint transition-colors active:text-ink"
            >
              Editar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) void save.run()
            }}
          >
            <label htmlFor="mobile-win" className="text-sm text-ink-muted">
              O que avançou hoje, mesmo que tenha sido pequeno?
            </label>

            <input
              id="mobile-win"
              value={text}
              maxLength={MAX_WIN_LENGTH}
              onChange={(event) => setText(event.target.value)}
              placeholder="Abri o livro, mesmo cansada."
              className="mt-2.5 h-13 w-full rounded-xl border border-line bg-surface-hi px-4 text-ink placeholder:text-ink-faint focus:border-brand"
            />

            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {WIN_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setText(suggestion)}
                  className="min-h-11 shrink-0 rounded-full border border-line px-3.5 text-sm whitespace-nowrap text-ink-muted transition-colors active:bg-surface-top"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-3 h-12 w-full"
              disabled={!canSave}
              loading={save.running}
            >
              <Icon name="check" className="size-4" />
              Salvar
            </Button>

            <div aria-live="polite" className="min-h-5">
              {save.error ? <p className="mt-2 text-sm text-danger">{save.error}</p> : null}
            </div>
          </form>
        )}

        <AnimatePresence>
          {justSaved ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-sm text-positive"
              role="status"
            >
              Guardado. Isso conta.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {previous.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
            {previous.map((win) => (
              <li key={win.id} className="flex gap-2.5 text-sm text-ink-faint">
                <span className="shrink-0">{formatDayLabel(win.day, today)}</span>
                <span className="truncate text-ink-muted">{win.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </MobileSection>
  )
}
