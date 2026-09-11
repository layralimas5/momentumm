import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AiQuota } from '@/domain/ai/ai-service'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/** As peças pequenas que toda porta da IA repete: espera, franquia, aviso de simulação, convite. */

export function AiSkeleton({ lines = 4, className }: { readonly lines?: number; readonly className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">A Momentumm AI está lendo os teus dados</span>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-4 animate-pulse rounded bg-surface-top"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  )
}

/** "3 de 150 leituras este mês": aparece depois da primeira chamada, quando o servidor contou. */
export function AiQuotaNote({ quota, simulated }: { readonly quota: AiQuota | null; readonly simulated: boolean }) {
  if (simulated) {
    return (
      <p className="text-xs text-ink-faint">
        Modo demo: as respostas são calculadas por regras fixas, no mesmo formato que a IA devolve.
      </p>
    )
  }
  if (!quota) return null
  return (
    <p className="tabular text-xs text-ink-faint">
      {quota.used} de {quota.limit} leituras da IA este mês.
    </p>
  )
}

/** A frase de origem que toda saída da IA carrega. */
export function AiSource({ children }: { readonly children?: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-ink-faint">
      <Icon name="ia" className="mt-px size-3.5 shrink-0" />
      <span>{children ?? 'Lido dos teus registros: objetivos, hábitos, ações, capacidade e score. Nada além disso sai daqui.'}</span>
    </p>
  )
}

/**
 * O botão de uma porta da IA, ou o convite ao PRO no lugar dele.
 *
 * O botão só existe pra quem tem a IA no plano. Pra quem não tem, a mesma
 * posição mostra o que a porta faria e como liberar — nunca um botão que
 * abre pra dizer "não".
 */
export function AiEntry({
  enabled,
  label,
  hint,
  onClick,
  size = 'sm',
  variant = 'secondary',
  className,
}: {
  readonly enabled: boolean
  readonly label: string
  /** O que a porta faz, dito pela utilidade. Vai no convite ao PRO. */
  readonly hint: string
  readonly onClick: () => void
  readonly size?: 'sm' | 'md'
  readonly variant?: 'primary' | 'secondary' | 'ghost'
  readonly className?: string
}) {
  if (!enabled) {
    return <UpgradeHint {...(className ? { className } : {})} message={`${label}: ${hint} Faz parte do PRO.`} />
  }
  return (
    <button type="button" onClick={onClick} className={cn(buttonClass({ variant, size }), className)}>
      <Icon name="ia" className="size-4" />
      {label}
    </button>
  )
}

export function AiEntryLink({
  enabled,
  label,
  hint,
  to,
  className,
}: {
  readonly enabled: boolean
  readonly label: string
  readonly hint: string
  readonly to: string
  readonly className?: string
}) {
  if (!enabled) {
    return <UpgradeHint {...(className ? { className } : {})} message={`${label}: ${hint} Faz parte do PRO.`} />
  }
  return (
    <Link to={to} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), className)}>
      <Icon name="ia" className="size-4" />
      {label}
    </Link>
  )
}
