import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { totalMinutes } from '@/domain/entities/activity'
import { ACTIVITY_TYPE_LIST } from '@/domain/entities/activity-type'
import type { DayKey } from '@/domain/entities/day'
import { ActivityRow } from '@/presentation/components/activity/ActivityRow'
import { QuickLog } from '@/presentation/components/activity/QuickLog'
import { StreakCard } from '@/presentation/components/activity/StreakCard'
import { TimerCard } from '@/presentation/components/activity/TimerCard'
import { GoalProgressCard } from '@/presentation/components/goal/GoalProgressCard'
import { Stat, StatGrid } from '@/presentation/components/ui/Stat'
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
  const achievedGoals = goals.progress.filter((progress) => progress.achieved).length

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink lg:text-3xl">
          {firstName ? `Bom te ver, ${firstName}` : 'Hoje'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {minutesToday > 0
            ? `${minutesToday} minutos de evolução hoje.`
            : 'Nada registrado ainda hoje. Um registro pequeno já conta.'}
        </p>
      </header>

      {error ? <ErrorNote message={error} /> : null}

      <StatGrid>
        <Stat label="Minutos hoje" value={String(minutesToday)} />
        <Stat
          label="Sequência"
          value={`${streak.current} ${streak.current === 1 ? 'dia' : 'dias'}`}
          hint={`Recorde: ${streak.record}`}
        />
        <Stat label="Registros hoje" value={String(todayActivities.length)} />
        <Stat
          label="Metas batidas"
          value={goals.progress.length === 0 ? '—' : `${achievedGoals}/${goals.progress.length}`}
        />
      </StatGrid>

      {/*
        Até `lg` a tela é uma coluna só. A partir daí o registro fica à esquerda
        (é o que a pessoa abre o app pra fazer) e o acompanhamento à direita,
        numa faixa fixa que não estica junto com o conteúdo.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5 lg:gap-6">
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start xl:gap-6">
            <QuickLog onLog={log} />
            <TimerCard onLog={log} />
          </div>

          <section aria-labelledby="hoje-titulo">
            <h2 id="hoje-titulo" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
              Registros de hoje
            </h2>
            {loading ? (
              <div className="mt-3">
                <LoadingBlock label="Carregando tuas atividades" />
              </div>
            ) : todayActivities.length === 0 ? (
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

          <TodayByAxis activities={todayActivities} />
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:gap-6">
          {loading ? (
            <LoadingBlock label="Carregando tua sequência" />
          ) : (
            <StreakCard streak={streak} today={today} activeDays={activeDays} />
          )}

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
        </aside>
      </div>
    </div>
  )
}

/**
 * Divisão do dia por eixo. Existe pra dar leitura rápida do equilíbrio entre
 * as frentes — e, no desktop, pra largura extra virar informação em vez de vazio.
 */
function TodayByAxis({ activities }: { activities: Parameters<typeof totalMinutes>[0] }) {
  const total = totalMinutes(activities)
  if (total === 0) return null

  return (
    <section aria-labelledby="eixos-titulo">
      <h2 id="eixos-titulo" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
        Distribuição de hoje
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_TYPE_LIST.map((type) => {
          const minutes = totalMinutes(activities.filter((activity) => activity.type === type.slug))
          const percent = Math.round((minutes / total) * 100)
          return (
            <Stat
              key={type.slug}
              label={type.label}
              value={`${minutes} min`}
              hint={`${percent}% do dia`}
              accent={type.colorToken}
            />
          )
        })}
      </dl>
    </section>
  )
}
