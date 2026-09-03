import { AnimatePresence, motion } from 'framer-motion'
import type { Insight } from '@/domain/entities/insight'
import type { PlanLimits } from '@/domain/entities/plan'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { UpgradeHint } from './UpgradeHint'

interface InsightCardProps {
  readonly insight: Insight | null
  readonly limits: PlanLimits
  readonly onApply: (insight: Insight) => Promise<void>
  readonly onDismiss: (id: string) => void
}

/**
 * O que o ritmo está mostrando.
 *
 * Cada insight nasce de uma contagem real e vem com motivo, recomendação e uma
 * ação que o app aplica sozinho. Sem padrão detectado, o card não aparece — é
 * melhor não dizer nada do que encher a tela de frase motivacional.
 */
export function InsightCard({ insight, limits, onApply, onDismiss }: InsightCardProps) {
  const apply = useAsyncAction(async (item: Insight) => {
    await onApply(item)
  })

  if (!insight) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={insight.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Panel tone="brand" aria-labelledby="insight-titulo">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
            <Icon name="insights" className="size-4" />
            O que o seu ritmo está mostrando
          </p>

          <h2 id="insight-titulo" className="mt-3 text-base font-semibold text-balance text-ink">
            {insight.title}
          </h2>

          <p className="mt-2 text-sm text-ink-muted">{insight.reason}</p>

          <p className="mt-3 rounded-xl border border-brand/25 bg-canvas/40 px-3.5 py-3 text-sm text-ink">
            {insight.recommendation}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {insight.action === 'nenhuma' ? null : (
              <Button size="sm" onClick={() => void apply.run(insight)} loading={apply.running}>
                {insight.actionLabel}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDismiss(insight.id)}>
              Dispensar
            </Button>
          </div>

          <p className="mt-3 text-xs text-ink-faint">
            Análise do Momentumm a partir dos seus próprios registros.
          </p>

          <div aria-live="polite" className="min-h-5">
            {apply.error ? <p className="mt-1 text-sm text-danger">{apply.error}</p> : null}
          </div>

          {limits.adaptiveRecommendations ? null : (
            <UpgradeHint
              className="mt-3"
              message="No PRO os insights ficam contínuos e se adaptam ao seu histórico completo."
            />
          )}
        </Panel>
      </motion.div>
    </AnimatePresence>
  )
}
