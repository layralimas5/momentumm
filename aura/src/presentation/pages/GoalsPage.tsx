import { useState, type FormEvent } from 'react'
import { Plus, Check, Trash2, Minus } from 'lucide-react'
import { GoalRules } from '@/domain/entities/goal'
import { useGoals } from '@/presentation/hooks/use-goals'
import { Card } from '@/presentation/components/ui/Card'
import { Badge } from '@/presentation/components/ui/Badge'
import { Button } from '@/presentation/components/ui/Button'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'

export function GoalsPage() {
  const { goals, loading, error, create, setProgress, complete, remove } = useGoals()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!GoalRules.isValidTitle(title)) {
      setFormError('Dê um título com pelo menos 2 caracteres.')
      return
    }
    setSubmitting(true)
    try {
      await create({ title, description: description.trim() || null })
      setTitle('')
      setDescription('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não consegui salvar a meta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          Metas
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Onde você decidiu chegar — um passo de cada vez.
        </p>
      </header>

      {/* Nova meta */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="goal-title" className="sr-only">
              Título da meta
            </label>
            <input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Qual meta você quer perseguir?"
              maxLength={GoalRules.maxTitleLength}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div>
            <label htmlFor="goal-desc" className="sr-only">
              Descrição (opcional)
            </label>
            <input
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Uma nota pra lembrar o porquê (opcional)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <Button type="submit" disabled={submitting}>
            <Plus className="h-4 w-4" />
            {submitting ? 'Salvando...' : 'Adicionar meta'}
          </Button>
        </form>
      </Card>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-zinc-500">Carregando...</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma meta ainda. Comece pela primeira acima. ✨</p>
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const done = GoalRules.isComplete(goal)
            return (
              <Card key={goal.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge tone={done ? 'success' : 'brand'}>
                    {done ? 'Concluída' : `${goal.progress}%`}
                  </Badge>
                </div>

                <ProgressBar
                  value={goal.progress}
                  label={`Progresso de ${goal.title}`}
                  className="mt-4"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setProgress(goal.id, goal.progress - 10)}
                    disabled={goal.progress <= 0}
                    aria-label="Diminuir progresso"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setProgress(goal.id, goal.progress + 10)}
                    disabled={done}
                    aria-label="Aumentar progresso"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {!done && (
                    <Button variant="secondary" size="sm" onClick={() => complete(goal.id)}>
                      <Check className="h-4 w-4" />
                      Concluir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(goal.id)}
                    className="ml-auto text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Remover meta ${goal.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
