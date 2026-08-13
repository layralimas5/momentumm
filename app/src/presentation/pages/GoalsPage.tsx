import { useState } from 'react'
import { ACTIVITY_TYPE_LIST, activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { GOAL_PERIODS, GOAL_PERIOD_LABELS, type GoalPeriod } from '@/domain/entities/goal'
import { GoalProgressCard } from '@/presentation/components/goal/GoalProgressCard'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useActivities } from '@/presentation/hooks/use-activities'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useGoals } from '@/presentation/hooks/use-goals'

export function GoalsPage() {
  const { activities, today, loading: loadingActivities } = useActivities()
  const goals = useGoals(activities, today)

  const [type, setType] = useState<ActivityTypeSlug>('leitura')
  const [period, setPeriod] = useState<GoalPeriod>('dia')
  const [target, setTarget] = useState('')

  const create = useAsyncAction(async () => {
    await goals.create({ type, target: Number(target), period })
    setTarget('')
  })

  const unit = activityType(type).unitLabel.many
  const targetIsValid = Number(target) > 0

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Metas</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Uma meta ativa por eixo e período. Menos metas, mais chance de bater.
        </p>
      </header>

      {goals.error ? <ErrorNote message={goals.error} /> : null}

      <form
        className="rounded-card border border-line bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (targetIsValid) void create.run()
        }}
      >
        <h2 className="text-sm font-medium tracking-wide text-ink-muted uppercase">Nova meta</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Eixo">
            {(id) => (
              <Select
                id={id}
                value={type}
                onChange={(event) => setType(event.target.value as ActivityTypeSlug)}
              >
                {ACTIVITY_TYPE_LIST.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={`Quanto (${unit})`} error={create.error}>
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="number"
                inputMode="numeric"
                min={1}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="20"
              />
            )}
          </Field>

          <Field label="Período">
            {(id) => (
              <Select
                id={id}
                value={period}
                onChange={(event) => setPeriod(event.target.value as GoalPeriod)}
              >
                {GOAL_PERIODS.map((item) => (
                  <option key={item} value={item}>
                    {GOAL_PERIOD_LABELS[item]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={!targetIsValid} loading={create.running}>
          Criar meta
        </Button>
      </form>

      {goals.loading || loadingActivities ? (
        <LoadingBlock label="Carregando tuas metas" />
      ) : goals.progress.length === 0 ? (
        <EmptyState
          title="Nenhuma meta ativa"
          description="Começa com uma meta que você conseguiria bater até num dia ruim. Consistência primeiro, volume depois."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.progress.map((progress) => (
            <GoalProgressCard key={progress.goal.id} progress={progress} onArchive={goals.archive} />
          ))}
        </ul>
      )}
    </div>
  )
}
