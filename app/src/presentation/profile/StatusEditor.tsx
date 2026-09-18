import { useState } from 'react'
import { MAX_STATUS_LENGTH, normalizeStatus, type ProfileStatus } from '@/domain/entities/profile-banner'
import { container } from '@/infrastructure/container'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { cn } from '@/shared/lib/cn'

/**
 * Os emojis oferecidos. Uma grade curta, do universo do app (foco, treino,
 * leitura, descanso, ânimo), em vez de um seletor com milhares: escolher o
 * estado do momento tem que caber num toque.
 */
const EMOJIS = [
  '🔥', '💪', '📚', '🎯', '🧠', '⚡', '🌱', '🧘', '🏃', '✍️', '💻', '🎓',
  '☕', '😴', '🌙', '☀️', '🌧️', '🎧', '🚀', '🏆', '❤️', '🙂', '😤', '🤒',
] as const

const SUGGESTIONS = ['Semana de foco', 'Modo retomada', 'Em ritmo', 'Descansando', 'Estudando pra prova'] as const

interface StatusEditorProps {
  readonly open: boolean
  readonly profileId: string
  readonly status: ProfileStatus | null
  readonly onClose: () => void
  readonly onSaved: () => Promise<void>
}

const TITLE = 'Seu status'
const DESCRIPTION = 'Um emoji e uma frase curta sobre o momento. Aparece no seu perfil.'

/** O formulário do status: emoji, frase, salvar ou limpar. */
export function StatusEditor({ open, profileId, status, onClose, onSaved }: StatusEditorProps) {
  const isDesktop = useIsDesktop()
  const content = open ? (
    <StatusForm profileId={profileId} status={status} onClose={onClose} onSaved={onSaved} />
  ) : null

  return isDesktop ? (
    <Dialog open={open} title={TITLE} description={DESCRIPTION} onClose={onClose}>
      {content}
    </Dialog>
  ) : (
    <BottomSheet open={open} title={TITLE} description={DESCRIPTION} onClose={onClose}>
      {content}
    </BottomSheet>
  )
}

function StatusForm({ profileId, status, onClose, onSaved }: Omit<StatusEditorProps, 'open'>) {
  const [emoji, setEmoji] = useState<string | null>(status?.emoji ?? null)
  const [text, setText] = useState(status?.text ?? '')

  const save = useAsyncAction(async (next: ProfileStatus | null) => {
    await container.profiles.update(profileId, { status: normalizeStatus(next) })
    await onSaved()
    onClose()
  })

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save.run({ emoji, text })
      }}
    >
      {save.error ? <ErrorNote message={save.error} /> : null}

      <div role="radiogroup" aria-label="Emoji" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {EMOJIS.map((item) => {
          const selected = item === emoji
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={item}
              onClick={() => setEmoji(selected ? null : item)}
              className={cn(
                'grid h-11 place-items-center rounded-xl border text-2xl transition-colors',
                selected ? 'border-brand bg-brand-dim/50' : 'border-line bg-surface hover:bg-surface-hi',
              )}
            >
              {item}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="status-texto" className="text-sm font-medium text-ink">
          Frase
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-hi px-3 focus-within:border-brand">
          <span aria-hidden="true" className="w-7 shrink-0 text-center text-xl">
            {emoji ?? '·'}
          </span>
          <input
            id="status-texto"
            value={text}
            maxLength={MAX_STATUS_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="No que você está agora?"
            className="h-11 min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <span className="tabular shrink-0 text-xs text-ink-faint">
            {text.length}/{MAX_STATUS_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setText(suggestion)}
              className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-hi hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {status ? (
          <Button type="button" variant="ghost" onClick={() => void save.run(null)} disabled={save.running}>
            Limpar status
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onClose} disabled={save.running}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.running} disabled={!emoji && !text.trim()}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
