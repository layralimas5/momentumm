import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  BookRules,
  READING_STATUS_LABEL,
  type ReadingStatus,
} from '@/domain/entities/book'
import { useBooks } from '@/presentation/hooks/use-books'
import { Card } from '@/presentation/components/ui/Card'
import { Badge } from '@/presentation/components/ui/Badge'
import { Button } from '@/presentation/components/ui/Button'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'
import { cn } from '@/shared/lib/cn'

const STATUS_ORDER: ReadingStatus[] = ['to_read', 'reading', 'read']

export function BooksPage() {
  const { books, loading, error, create, setStatus, remove } = useBooks()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!BookRules.isValidTitle(title)) {
      setFormError('Informe o título do livro.')
      return
    }
    setSubmitting(true)
    try {
      await create({ title, author: author.trim() || null })
      setTitle('')
      setAuthor('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não consegui salvar o livro.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          Leituras
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Sua evolução em livros — do que quer ler ao que já transformou você.
        </p>
      </header>

      {/* Novo livro */}
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="book-title" className="sr-only">
              Título do livro
            </label>
            <input
              id="book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do livro"
              maxLength={BookRules.maxTitleLength}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="book-author" className="sr-only">
              Autor (opcional)
            </label>
            <input
              id="book-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Autor (opcional)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <Button type="submit" disabled={submitting} className="shrink-0">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </form>
        {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Estante */}
      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-zinc-500">Sua estante está vazia. Adicione o primeiro livro. 📖</p>
      ) : (
        <div className="grid gap-4">
          {books.map((book) => (
            <Card key={book.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {book.title}
                  </h3>
                  {book.author && (
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{book.author}</p>
                  )}
                </div>
                <Badge tone={book.status === 'read' ? 'success' : 'neutral'}>
                  {READING_STATUS_LABEL[book.status]}
                </Badge>
              </div>

              <ProgressBar
                value={book.progress}
                label={`Progresso de ${book.title}`}
                className="mt-4"
              />

              <div className="mt-4 flex items-center gap-2">
                <div
                  role="group"
                  aria-label="Status da leitura"
                  className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
                >
                  {STATUS_ORDER.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatus(book.id, status)}
                      aria-pressed={book.status === status}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        book.status === status
                          ? 'bg-brand-600 text-white'
                          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                      )}
                    >
                      {READING_STATUS_LABEL[status]}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(book.id)}
                  className="ml-auto text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                  aria-label={`Remover ${book.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
