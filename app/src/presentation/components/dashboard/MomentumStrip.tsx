import { useState } from 'react'
import type { DayKey } from '@/domain/entities/day'
import {
  MOMENTUM_LEVEL_LABELS,
  type MomentumPoint,
  type MomentumScore,
} from '@/domain/entities/momentum'
import type { MomentumNextAction } from '@/domain/entities/momentum-next-action'
import type { Streak } from '@/domain/entities/streak'
import { Icon } from '@/presentation/components/ui/Icon'
import { Tag } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'
import { MomentumDialog } from './MomentumDialog'
import { MomentumRing } from './MomentumRing'

/**
 * O Momentumm em uma faixa, não em um card.
 *
 * Ele precisa de destaque e não de espaço: é um número de contexto, não a ação
 * do dia. Como card grande ele disputava a primeira dobra com o foco — e a
 * pessoa abre o app pra decidir o que fazer, não pra ler a própria nota.
 *
 * O número nunca aparece sozinho. Sem a variação, a leitura em uma frase e o
 * caminho pro detalhamento, 62 não significa nada e ninguém muda de
 * comportamento por causa dele.
 */
export function MomentumStrip({
  momentum,
  history,
  today,
  streak,
  recommendation,
  detail,
  nextAction = null,
  compact = false,
}: {
  readonly momentum: MomentumScore
  readonly history: readonly MomentumPoint[]
  readonly today: DayKey
  readonly streak: Streak
  readonly recommendation: string
  /** Variação e curva. No gratuito só a pontuação de hoje aparece. */
  readonly detail: boolean
  readonly nextAction?: MomentumNextAction | null
  /**
   * No Hoje do celular a curva da semana sai daqui: quem conta a semana é o
   * pulso, logo abaixo dos hábitos. Repetir sete barras e sete pontos na mesma
   * tela faz a pessoa procurar a diferença entre dois desenhos iguais.
   */
  readonly compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  const rising = momentum.delta > 0
  const flat = momentum.delta === 0

  return (
    <>
      <section
        aria-labelledby="momentum-titulo"
        className="surface-card flex items-center gap-4 px-4 py-4"
      >
        <h2 id="momentum-titulo" className="sr-only">
          Momentumm Score
        </h2>

        <MomentumRing value={momentum.value} size={88}>
          <span className="text-gradient-brand tabular text-3xl leading-none font-semibold tracking-tight">
            {momentum.value}
          </span>
        </MomentumRing>

        <div className="min-w-0 flex-1">
          {/* O nome do número. Sem ele o anel é só um número solto, e a pessoa
              confunde o estado de hoje (0 a 100) com o XP acumulado. */}
          <p aria-hidden="true" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Momentum
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Tag tone={tone}>{MOMENTUM_LEVEL_LABELS[momentum.level]}</Tag>

            {!detail ? null : momentum.hasEnoughData ? (
              <span
                className={cn(
                  'tabular inline-flex items-center gap-1 text-xs',
                  flat ? 'text-ink-faint' : rising ? 'text-positive' : 'text-flame',
                )}
              >
                <Icon name={flat ? 'minimo' : rising ? 'subir' : 'descer'} className="size-3.5" />
                {flat ? 'igual à semana passada' : `${rising ? '+' : ''}${momentum.delta} na semana`}
              </span>
            ) : (
              <span className="text-xs text-ink-faint">primeira semana</span>
            )}

            {streak.current > 0 ? (
              <span className="tabular inline-flex items-center gap-1 text-xs text-ink-faint">
                <Icon name="fogo" className="size-3.5 text-flame" />
                {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
              </span>
            ) : null}
          </div>

          {/* Os últimos sete dias como barras: a semana inteira num olhar. */}
          {history.length > 1 && !compact ? (
            <WeekBars history={history} today={today} />
          ) : (
            <p className="mt-1.5 text-sm text-pretty text-ink-muted">{momentum.headline}</p>
          )}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink-muted"
          >
            Entender meu score
            <Icon name="seta" className="size-3.5" />
          </button>
        </div>
      </section>

      <MomentumDialog
        open={open}
        momentum={momentum}
        history={history}
        today={today}
        recommendation={recommendation}
        detail={detail}
        nextAction={nextAction}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/** Sete barras, a de hoje acesa. Sem eixo nem número: é o desenho da semana. */
function WeekBars({ history, today }: { readonly history: readonly MomentumPoint[]; readonly today: DayKey }) {
  const last = history.slice(-7)
  return (
    <div className="mt-2.5 flex h-7 items-end gap-1" aria-hidden="true">
      {last.map((point) => (
        <span
          key={point.day}
          className={cn(
            'w-3 rounded-sm transition-[height] duration-500 ease-out',
            point.day === today ? 'bg-brand' : 'bg-brand/35',
          )}
          style={{ height: `${Math.max(12, point.value)}%` }}
        />
      ))}
    </div>
  )
}
