import { useState } from 'react'
import type { DayKey } from '@/domain/entities/day'
import {
  MOMENTUM_LEVEL_LABELS,
  type MomentumPoint,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { Streak } from '@/domain/entities/streak'
import { MomentumDialog } from '@/presentation/components/dashboard/MomentumDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface MobileMomentumProps {
  readonly momentum: MomentumScore
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly streak: Streak
  readonly recommendation: string
}

/**
 * Resumo do ritmo no celular.
 *
 * O card inteiro é um botão: tocar abre "Entender meu score" — o mesmo diálogo
 * do desktop, que no celular sobe como folha. Antes ele levava pra tela de
 * insights, que responde outra pergunta; quem toca no número quer saber do
 * número.
 *
 * Aqui ficam só o número, a classificação, a variação e uma frase. As barras
 * são tendência, não leitura precisa: gráfico que exige interpretação numa tela
 * de 360px não é informação, é enfeite.
 */
export function MobileMomentum({
  momentum,
  history,
  today,
  streak,
  recommendation,
}: MobileMomentumProps) {
  const [open, setOpen] = useState(false)

  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  const top = momentum.drivers[0]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Momentum ${momentum.value} de 100, ${MOMENTUM_LEVEL_LABELS[momentum.level]}. Tocar para entender o score.`}
        className="surface-card w-full p-4 text-left transition-colors active:bg-surface-hi"
      >
        <div className="flex items-center gap-3">
          <span className="text-gradient-brand tabular text-4xl leading-none font-semibold tracking-tight">
            {momentum.value}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>
              {streak.current > 0 ? (
                <Tag tone={streak.atRisk ? 'warn' : 'neutral'}>
                  <Icon name="fogo" className="size-3.5" />
                  {streak.current}
                </Tag>
              ) : null}
            </span>
            <span className="mt-1 block text-sm text-ink-faint">
              {!momentum.hasEnoughData
                ? 'primeira semana de registro'
                : momentum.delta === 0
                  ? 'igual à semana passada'
                  : `${momentum.delta > 0 ? '+' : '−'}${Math.abs(momentum.delta)} vs. semana passada`}
            </span>
          </span>

          <Sparkline history={history} />
          <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
        </div>

        <p className="mt-3 text-sm text-pretty text-ink-muted">{momentum.headline}</p>

        {/* Um fator só: no celular, a lista inteira do que mudou vive dentro do
            diálogo. Aqui cabe o que explica a variação em uma linha. */}
        {top && momentum.hasEnoughData ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
            <Icon
              name={top.delta > 0 ? 'subir' : 'descer'}
              className={cn('size-3.5', top.delta > 0 ? 'text-positive' : 'text-flame')}
            />
            {top.label}: {top.delta > 0 ? '+' : ''}
            {top.delta} pts
          </p>
        ) : null}

        <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-ink">
          Entender meu score
          <Icon name="seta" className="size-3.5" />
        </span>
      </button>

      <MomentumDialog
        open={open}
        momentum={momentum}
        history={history}
        today={today}
        recommendation={recommendation}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/** A forma dos últimos dias, não o valor exato de cada um. */
function Sparkline({ history }: { readonly history: readonly MomentumPoint[] }) {
  const last = history.slice(-7)
  if (last.length < 2) return null

  return (
    <span aria-hidden="true" className="hidden h-8 shrink-0 items-end gap-1 min-[360px]:flex">
      {last.map((point) => (
        <span
          key={point.day}
          className={cn(
            'w-1.5 rounded-full',
            point.value >= 60 ? 'bg-brand' : point.value > 0 ? 'bg-brand/50' : 'bg-line-hi',
          )}
          style={{ height: `${Math.max(4, Math.round((point.value / 100) * 32))}px` }}
        />
      ))}
    </span>
  )
}
