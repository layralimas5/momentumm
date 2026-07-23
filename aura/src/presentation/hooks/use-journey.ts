import { useMemo } from 'react'
import type { Goal } from '@/domain/entities/goal'
import type { Book } from '@/domain/entities/book'
import type { Habit } from '@/domain/entities/habit'
import type { DiaryEntry } from '@/domain/entities/diary'
import { dayKey, type DayKey } from '@/domain/entities/day'
import { computeJourney, type JourneyProgress, type JourneySnapshot } from '@/domain/entities/journey'
import { computeAchievements, countUnlocked, type Achievement } from '@/domain/entities/achievement'

interface JourneyInputs {
  goals: Goal[]
  books: Book[]
  habits: Habit[]
  diary: DiaryEntry[]
  missionDates: DayKey[]
}

interface UseJourneyResult {
  journey: JourneyProgress
  achievements: Achievement[]
  unlockedCount: number
}

/**
 * Deriva a jornada (XP, nível, sequência, conquistas) dos dados que a UI já tem
 * em mãos. Não busca nada: é cálculo puro memoizado, para o dashboard ser a única
 * fonte de IO e não disparar fetches em duplicidade.
 */
export function useJourney({ goals, books, habits, diary, missionDates }: JourneyInputs): UseJourneyResult {
  return useMemo(() => {
    const snapshot: JourneySnapshot = {
      habits: habits.map((h) => ({ completedDates: h.completedDates })),
      missionDates,
      diaryDates: diary.map((e) => e.createdAt.slice(0, 10) as DayKey),
      goals: goals.map((g) => ({ progress: g.progress, status: g.status })),
      books: books.map((b) => ({ status: b.status })),
      today: dayKey(),
    }
    const journey = computeJourney(snapshot)
    const achievements = computeAchievements({ snapshot, journey })
    return { journey, achievements, unlockedCount: countUnlocked(achievements) }
  }, [goals, books, habits, diary, missionDates])
}
