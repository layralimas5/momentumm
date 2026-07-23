import { Award, BookOpen, Flag, Flame, PenLine, Target, TrendingUp, type LucideIcon } from 'lucide-react'
import type { AchievementIcon } from '@/domain/entities/achievement'

/**
 * Ponte entre o ícone semântico do domínio e o glifo concreto do lucide. Mantém
 * o domínio livre de detalhe de UI: ele diz "streak", a apresentação escolhe a chama.
 */
export const ACHIEVEMENT_ICON: Record<AchievementIcon, LucideIcon> = {
  start: Flag,
  streak: Flame,
  goal: Target,
  book: BookOpen,
  diary: PenLine,
  mission: Award,
  level: TrendingUp,
}
