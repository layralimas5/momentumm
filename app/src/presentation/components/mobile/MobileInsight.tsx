import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Insight } from '@/domain/entities/insight'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

interface MobileInsightProps {
  readonly insight: Insight | null
  readonly onApply: (insight: Insight) => Promise<void>
  readonly onDismiss: (id: string) => void
}

/**
 * Um insight por vez.
 *
 * Na tela do celular a recomendação aparece inteira e o "por quê" fica a um
 * toque de distância, no sheet. Empilhar motivo, dado e recomendação aqui
 * transformaria o card num parágrafo que ninguém lê no meio do dia.
 */
export function MobileInsight({ insight, onApply, onDismiss }: MobileInsightProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  const apply = useAsyncAction(async (item: Insight) => {
    await onApply(item)
  })

  if (!insight) return null

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        aria-labelledby="insight-titulo"
        className="surface-brand edge-light p-4"
      >
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
          <Icon name="insights" className="size-4" />
          O que o seu ritmo está mostrando
        </p>

        <h2 id="insight-titulo" className="mt-2.5 text-base font-semibold text-balance text-ink">
          {insight.title}
        </h2>

        <p className="mt-2 text-sm text-ink-muted">{insight.recommendation}</p>

        <div className="mt-4 flex gap-2">
          {insight.action === 'nenhuma' ? null : (
            <Button
              size="md"
              className="h-12 flex-1"
              onClick={() => void apply.run(insight)}
              loading={apply.running}
            >
              Aplicar
            </Button>
          )}
          <Button
            size="md"
            variant="secondary"
            className="h-12 flex-1"
            onClick={() => setDetailOpen(true)}
          >
            Por quê?
          </Button>
        </div>

        <div aria-live="polite" className="min-h-5">
          {apply.error ? <p className="mt-2 text-sm text-danger">{apply.error}</p> : null}
        </div>
      </motion.section>

      <BottomSheet
        open={detailOpen}
        title={insight.title}
        description="Análise do Momentumm a partir dos seus próprios registros."
        onClose={() => setDetailOpen(false)}
      >
        <p className="text-sm text-ink-muted">
          <span className="text-ink-faint">O que os dados mostram: </span>
          {insight.reason}
        </p>

        <p className="mt-4 rounded-xl border border-line bg-surface-hi/60 px-4 py-3.5 text-sm text-ink">
          {insight.recommendation}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {insight.action === 'nenhuma' ? null : (
            <Button
              size="lg"
              className="h-13 w-full"
              onClick={() => {
                setDetailOpen(false)
                void apply.run(insight)
              }}
            >
              {insight.actionLabel}
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            className="h-12 w-full"
            onClick={() => {
              setDetailOpen(false)
              onDismiss(insight.id)
            }}
          >
            Dispensar este insight
          </Button>

          {/* A tela cheia é o lugar de ver os outros padrões. No celular ela
              só era alcançável pelos atalhos do perfil, longe de onde a
              pergunta nasce. */}
          <Link
            to="/app/insights"
            onClick={() => setDetailOpen(false)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm text-brand-ink"
          >
            Ver todas as leituras do ritmo
            <Icon name="seta" className="size-4" />
          </Link>
        </div>
      </BottomSheet>
    </>
  )
}
