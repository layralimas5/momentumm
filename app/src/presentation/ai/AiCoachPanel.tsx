import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { AiCoachNudge } from '@/domain/ai/ai-service'
import type { DayKey } from '@/domain/entities/day'
import { useAuth } from '@/presentation/auth/use-auth'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'
import { AiErrorNote } from './AiErrorNote'
import { AiQuotaNote, AiSkeleton } from './AiBits'
import type { AiController } from './use-ai'

const CACHE_KEY = 'momentumm.coach.v1'

interface CachedNudge {
  readonly userId: string
  readonly day: DayKey
  readonly nudge: AiCoachNudge
}

/**
 * O toque do coach, no fim das métricas.
 *
 * Três linhas: a frase de impacto, a verdade que os números mostram e a
 * ordem pra hoje. Chega sozinho uma vez por dia (fica guardado no aparelho
 * pra não gastar franquia a cada abertura da tela) e dá pra pedir outro.
 *
 * É do PRO. No gratuito o bloco mostra o convite, não um texto genérico: o
 * coach só existe lendo os números da pessoa.
 */
export function AiCoachPanel({ ai, className }: { readonly ai: AiController; readonly className?: string }) {
  const { user } = useAuth()
  const planner = usePlanner()
  const reduceMotion = useReducedMotion()
  const call = ai.coach
  const [cached, setCached] = useState<AiCoachNudge | null>(() =>
    user ? readCache(user.id, planner.today) : null,
  )

  // Uma leitura por dia, sem clique: é o "sempre me dá um toque".
  useEffect(() => {
    if (!ai.enabled || !user || cached || call.result || call.loading || call.error) return
    if (planner.loading || planner.isNewUser) return
    void call.run()
    // `call` muda de identidade a cada render do hook; só o estado interessa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.enabled, user, cached, call.result, call.loading, call.error, planner.loading, planner.isNewUser])

  useEffect(() => {
    if (!call.result || !user) return
    writeCache({ userId: user.id, day: planner.today, nudge: call.result })
    setCached(call.result)
  }, [call.result, user, planner.today])

  if (!ai.enabled) {
    return (
      <div className={className}>
        <UpgradeHint message="O coach da Momentumm AI lê teus números e te cobra no fim das métricas. Faz parte do PRO." />
      </div>
    )
  }

  const nudge = call.result ?? cached

  return (
    <Panel tone="brand" glow className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
          <Icon name="ia" className="size-4" />
          O coach
        </p>
        <Button
          size="sm"
          variant="ghost"
          loading={call.loading}
          onClick={() => void call.run()}
          className="-mr-2"
        >
          <Icon name="desfazer" className="size-4" />
          Outro toque
        </Button>
      </div>

      {call.error ? <AiErrorNote className="mt-4" message={call.error} code={call.errorCode} /> : null}
      {call.loading && !nudge ? <AiSkeleton className="mt-4" lines={3} /> : null}

      {nudge ? (
        <motion.div
          key={nudge.punch}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 flex flex-col gap-3"
        >
          <p className="text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
            {nudge.punch}
          </p>
          <p className="text-pretty text-base text-ink-muted">{nudge.truth}</p>
          <p className="flex items-start gap-2.5 rounded-xl bg-surface/60 px-3.5 py-3 text-sm font-medium text-ink">
            <Icon name="raio" className="mt-0.5 size-4 shrink-0 text-brand-ink" />
            <span>{nudge.order}</span>
          </p>
        </motion.div>
      ) : null}

      <div className="mt-4">
        <AiQuotaNote quota={ai.quota} simulated={ai.simulated} />
      </div>
    </Panel>
  )
}

function readCache(userId: string, day: DayKey): AiCoachNudge | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedNudge>
    if (parsed.userId !== userId || parsed.day !== day || !parsed.nudge) return null
    return parsed.nudge
  } catch {
    return null
  }
}

function writeCache(value: CachedNudge): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value))
  } catch {
    // Sem armazenamento o coach lê de novo na próxima abertura.
  }
}
