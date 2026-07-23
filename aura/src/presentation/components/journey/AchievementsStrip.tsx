import { Check, Lock } from 'lucide-react'
import type { Achievement } from '@/domain/entities/achievement'
import { cn } from '@/shared/lib/cn'
import { ACHIEVEMENT_ICON } from './achievement-icon'

interface AchievementsStripProps {
  achievements: Achievement[]
}

/** Grade de conquistas — desbloqueadas em destaque, próximas com progresso visível. */
export function AchievementsStrip({ achievements }: AchievementsStripProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {achievements.map((achievement) => (
        <li key={achievement.id}>
          <AchievementTile achievement={achievement} />
        </li>
      ))}
    </ul>
  )
}

function AchievementTile({ achievement }: { achievement: Achievement }) {
  const Icon = ACHIEVEMENT_ICON[achievement.icon]
  const { unlocked } = achievement

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-2 rounded-xl border p-3.5 transition-colors',
        unlocked
          ? 'border-brand-800/70 bg-brand-950/40'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            unlocked ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {unlocked ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : (
          <Lock className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" aria-hidden />
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-medium',
            unlocked ? 'text-zinc-50' : 'text-zinc-700 dark:text-zinc-300',
          )}
        >
          {achievement.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {achievement.description}
        </p>
      </div>

      {!unlocked && achievement.target > 1 && (
        <p className="mt-auto pt-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
          {achievement.current} / {achievement.target}
        </p>
      )}
    </div>
  )
}
