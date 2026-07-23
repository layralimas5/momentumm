import { Flame, Sparkles } from 'lucide-react'
import type { JourneyProgress } from '@/domain/entities/journey'
import { ProgressBar } from '@/presentation/components/ui/ProgressBar'
import { LEVEL_NAMES } from '@/domain/entities/journey'

interface JourneyCardProps {
  journey: JourneyProgress
  /** Quantas conquistas já foram desbloqueadas (para a linha de rodapé). */
  unlockedCount: number
  totalAchievements: number
}

/**
 * O coração do dashboard: onde a usuária vê a jornada inteira num número só.
 * Nível, XP rumo ao próximo estágio e a sequência que ela não quer perder.
 */
export function JourneyCard({ journey, unlockedCount, totalAchievements }: JourneyCardProps) {
  const nextLevelName = journey.isMaxLevel
    ? null
    : (LEVEL_NAMES[journey.level] ?? null)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-900/70 bg-gradient-to-br from-brand-950/60 via-zinc-900 to-zinc-900 p-6 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-brand-600/20 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Sua jornada
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-zinc-50">
                {journey.levelName}
              </h2>
              <p className="text-xs text-zinc-400">
                Nível {journey.level} · {journey.totalXp} XP
              </p>
            </div>
          </div>
        </div>

        {/* Sequência global — o que ela não quer quebrar. */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-800/70 bg-brand-950/50 px-3 py-1.5"
          title={`${journey.streak} dias seguidos em movimento`}
        >
          <Flame className={journey.streak > 0 ? 'h-4 w-4 text-brand-400' : 'h-4 w-4 text-zinc-500'} />
          <span className="text-sm font-semibold text-zinc-50">{journey.streak}</span>
          <span className="text-xs text-zinc-400">
            {journey.streak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
      </div>

      {/* Progresso rumo ao próximo nível */}
      <div className="relative mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">
            {journey.isMaxLevel
              ? 'Você chegou ao topo da jornada ✨'
              : `Rumo a ${nextLevelName}`}
          </span>
          {!journey.isMaxLevel && (
            <span className="text-zinc-400">
              faltam {journey.xpForNextLevel - journey.xpIntoLevel} XP
            </span>
          )}
        </div>
        <ProgressBar
          value={journey.progressPercent}
          label={`Progresso rumo ao próximo nível: ${journey.progressPercent}%`}
        />
      </div>

      {totalAchievements > 0 && (
        <p className="relative mt-4 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">{unlockedCount}</span> de {totalAchievements}{' '}
          conquistas desbloqueadas
        </p>
      )}
    </div>
  )
}
