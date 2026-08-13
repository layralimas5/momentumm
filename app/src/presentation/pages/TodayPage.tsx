import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { totalMinutes } from '@/domain/entities/activity'
import type { DayKey } from '@/domain/entities/day'
import { ActivityRow } from '@/presentation/components/activity/ActivityRow'
import { QuickLog } from '@/presentation/components/activity/QuickLog'
import { StreakCard } from '@/presentation/components/activity/StreakCard'
import { GoalProgressCard } from '@/presentation/components/goal/GoalProgressCard'
import { EmptyState, ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useAuth } from '@/presentation/auth/use-auth'
import { useActivities } from '@/presentation/hooks/use-activities'
import { useGoals } from '@/presentation/hooks/use-goals'

export function TodayPage() {
  const { profile } = useAuth()
  const { activities, today, todayActivities, streak, loading, error, log, remove } = useActivities()
  const goals = useGoals(activities, today)

  const activeDays = useMemo(
    () => new Set<DayKey>(activities.map((activity) => activity.day)),
    [activities],
  )

  const minutesToday = totalMinutes(todayActivities)
  const firstName = profile?.name.split(' ')[0]

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {firstName ? `Bom te ver, ${firstName}` : 'Hoje'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {minutesToday > 0
            ? `${minutesToday} minutos de evolução hoje.`
            : 'Nada registrado ainda hoje. Um registro pequeno já conta.'}
        </p>
      </header>

      {error ? <ErrorNote message={error} /> : null}

      <QuickLog onLog={log} />

      {loading ? (
        <LoadingBlock label="Carregando tuas atividades" />
      ) : (
        <>
          <StreakCard streak={streak} today={today} activeDays={activeDays} />

          <section aria-labelledby="hoje-titulo">
            <h2 id="hoje-titulo" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
              Registros de hoje
            </h2>
            {todayActivities.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="Dia ainda em branco"
                  description="Registra o que você já fez hoje, mesmo que tenham sido dez minutos."
                />
              </div>
            ) : (
              <ul className="mt-2 rounded-card border border-line bg-surface px-4">
                {todayActivities.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} onRemove={remove} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="metas-titulo">
            <div className="flex items-center justify-between">
              <h2
                id="metas-titulo"
                className="text-sm font-medium tracking-wide text-ink-muted uppercase"
              >
                Metas
              </h2>
              <Link to="/app/metas" className="text-sm text-brand-hi hover:underline">
                Gerenciar
              </Link>
            </div>

            {goals.progress.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="Nenhuma meta ativa"
                  description="Meta transforma vontade em número. Começa com uma pequena, do tipo que dá pra bater num dia ruim."
                />
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {goals.progress.map((progress) => (
                  <GoalProgressCard key={progress.goal.id} progress={progress} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
