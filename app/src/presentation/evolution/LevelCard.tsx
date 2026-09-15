import { Link } from 'react-router-dom'
import type { LevelProgress } from '@/domain/entities/evolution'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProgressBar } from '@/presentation/components/ui/Surface'
import { cn } from '@/shared/lib/cn'

interface LevelCardProps {
  readonly progress: LevelProgress
  /** Compacto vai no perfil e no dashboard; o completo é o topo da Evolução. */
  readonly compact?: boolean
  readonly title?: string | null
  readonly className?: string
}

/**
 * O nível, o nome da etapa e a barra até o próximo.
 *
 * O número grande é o NÍVEL, não o XP: "Nível 4" cabe na cabeça, "1.240 XP"
 * não diz nada sozinho. O XP aparece como legenda da barra, que é onde ele
 * vira informação ("faltam 260").
 */
export function LevelCard({ progress, compact = false, title, className }: LevelCardProps) {
  const body = (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Nível {progress.level}
          </p>
          <p
            className={cn(
              'truncate font-semibold tracking-tight text-ink',
              compact ? 'text-xl' : 'text-3xl lg:text-4xl',
            )}
          >
            {progress.name}
          </p>
          {title ? <p className="mt-0.5 text-xs text-brand-ink">{title}</p> : null}
        </div>
        <p className="tabular shrink-0 text-right text-sm text-ink-muted">
          <span className="font-semibold text-ink">{formatXp(progress.xpTotal)}</span>
          <span className="text-ink-faint"> / {formatXp(progress.nextMinXp)} XP</span>
        </p>
      </div>

      <ProgressBar
        value={progress.xpInLevel / progress.span}
        label={`${progress.percent}% do nível ${progress.level}`}
        className={cn('mt-3', compact ? 'h-1.5' : 'h-2')}
      />

      <p className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-faint">
        <span>
          Faltam <span className="tabular font-medium text-ink-muted">{formatXp(progress.xpToNext)} XP</span>{' '}
          pro nível {progress.next.level}, {progress.next.name}
        </span>
        {compact ? (
          <span className="inline-flex items-center gap-1 text-brand-ink">
            Evolução
            <Icon name="seta" className="size-3.5" />
          </span>
        ) : null}
      </p>
    </>
  )

  if (compact) {
    return (
      <Link
        to="/app/evolucao"
        className={cn(
          'surface-card block p-4 transition-colors hover:border-line-hi',
          className,
        )}
      >
        {body}
      </Link>
    )
  }

  return <div className={className}>{body}</div>
}

/** 1240 vira "1.240": é a leitura do produto em português. */
export function formatXp(value: number): string {
  return value.toLocaleString('pt-BR')
}
