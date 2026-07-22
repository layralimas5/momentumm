import { useState, type FormEvent } from 'react'
import { PenLine, Trash2 } from 'lucide-react'
import { DiaryRules } from '@/domain/entities/diary'
import { useDiary } from '@/presentation/hooks/use-diary'
import { Card } from '@/presentation/components/ui/Card'
import { Button } from '@/presentation/components/ui/Button'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export function DiaryPage() {
  const { entries, loading, error, create, remove } = useDiary()
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!DiaryRules.isValid(content)) {
      setFormError('Escreva algo antes de salvar.')
      return
    }
    setSubmitting(true)
    try {
      await create(content)
      setContent('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não consegui salvar sua nota.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          Diário
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Um espaço só seu — o que passou pela sua cabeça hoje?
        </p>
      </header>

      {/* Escrever */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="diary-content" className="sr-only">
            Sua nota de hoje
          </label>
          <textarea
            id="diary-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva livremente..."
            rows={5}
            maxLength={DiaryRules.maxLength}
            className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
          />
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              <PenLine className="h-4 w-4" />
              {submitting ? 'Salvando...' : 'Salvar no diário'}
            </Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Entradas */}
      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Seu diário está em branco. Que tal começar pela nota de hoje? ✨
        </p>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <time className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {capitalize(dateFormatter.format(new Date(entry.createdAt)))}
                </time>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label="Remover nota"
                  className="shrink-0 text-zinc-500 transition-colors hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-pretty text-sm text-zinc-700 dark:text-zinc-200">
                {entry.content}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
