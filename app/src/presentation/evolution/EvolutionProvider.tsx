import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  EMPTY_EVOLUTION,
  levelOf,
  summarizeEvolution,
  unlocksFor,
  type EvolutionSnapshot,
} from '@/domain/entities/evolution'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { usePlanner } from '@/presentation/planner/use-planner'
import { toUserMessage } from '@/shared/errors'
import {
  EvolutionContext,
  type EvolutionNotice,
  type EvolutionState,
  type XpGain,
} from './evolution-context'

/**
 * A evolução como estado, ao lado do planner.
 *
 * O XP é concedido no servidor em reação ao que a pessoa faz. O app não sabe
 * quanto uma ação valeu até reler: por isso o provider observa as coleções do
 * planner que geram XP (ações, hábitos, etapas, objetivos, reviews) e relê a
 * evolução um instante depois de qualquer uma mudar. É uma leitura pequena e
 * ela é a única fonte: nenhuma tela soma pontos por conta própria.
 *
 * ## O aviso de nível
 *
 * Comparar o nível de antes com o de agora é o que faz "subiu de nível"
 * existir sem o servidor precisar avisar. A primeira leitura da sessão não
 * avisa nada: subir de nível ontem, em outro aparelho, não é notícia hoje.
 */

/** Espera entre a mudança no planner e a releitura, pra agrupar cliques seguidos. */
const REFRESH_DELAY_MS = 700

export function EvolutionProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const planner = usePlanner()
  const [snapshot, setSnapshot] = useState<EvolutionSnapshot>(EMPTY_EVOLUTION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<EvolutionNotice | null>(null)
  const [lastGain, setLastGain] = useState<XpGain | null>(null)
  const previous = useRef<EvolutionSnapshot | null>(null)
  const mounted = useRef(true)

  const plan = profile?.plan ?? 'free'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setSnapshot(EMPTY_EVOLUTION)
      setLoading(false)
      return
    }

    try {
      const next = await container.evolution.load(user.id)
      if (!mounted.current) return

      const before = previous.current
      if (before) {
        const gained = next.xpTotal - before.xpTotal
        if (gained > 0) setLastGain({ id: `${next.xpTotal}`, amount: gained })

        const fromLevel = levelOf(before.xpTotal).level
        const progress = levelOf(next.xpTotal)
        const known = new Set(before.achievements.map((item) => item.key))
        const achievements = next.achievements
          .map((item) => item.key)
          .filter((key) => !known.has(key))
        const levelUp = progress.level > fromLevel ? progress : null

        if (levelUp || achievements.length > 0) {
          setNotice({
            id: `${next.xpTotal}:${next.achievements.length}`,
            levelUp,
            unlocks: levelUp
              ? unlocksFor(progress.level, plan).filter(
                  (item) => item.status === 'liberado' && item.level > fromLevel,
                )
              : [],
            achievements,
          })
        }
      }

      previous.current = next
      setSnapshot(next)
      setError(null)
    } catch (cause) {
      if (mounted.current) setError(toUserMessage(cause))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [user, plan])

  useEffect(() => {
    previous.current = null
    void refresh()
  }, [refresh])

  /*
    As coleções que geram XP. Qualquer mudança nelas (inclusive a otimista, que
    chega antes do servidor responder) agenda uma releitura curta. O planner
    grava e o banco concede na mesma transação, então quando a releitura sai o
    XP já está lá.
  */
  const { tasks, habitLogs, planStages, objectives, weeklyReviews, loading: plannerLoading } =
    planner
  useEffect(() => {
    if (plannerLoading || !previous.current) return
    const timer = window.setTimeout(() => void refresh(), REFRESH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [tasks, habitLogs, planStages, objectives, weeklyReviews, plannerLoading, refresh])

  const summary = useMemo(
    () => summarizeEvolution(snapshot, planner.today, plan),
    [snapshot, planner.today, plan],
  )

  const dismissNotice = useCallback(() => setNotice(null), [])

  const value = useMemo<EvolutionState>(
    () => ({ snapshot, summary, loading, error, notice, lastGain, dismissNotice, refresh }),
    [snapshot, summary, loading, error, notice, lastGain, dismissNotice, refresh],
  )

  return <EvolutionContext.Provider value={value}>{children}</EvolutionContext.Provider>
}
