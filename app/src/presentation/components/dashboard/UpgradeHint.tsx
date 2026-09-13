import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Chamada de upgrade contextual.
 *
 * Regra dura do produto: o dashboard NUNCA é bloqueado por banner. O PRO aparece
 * onde o limite realmente encosta, em uma linha discreta, e some do caminho.
 */
export function UpgradeHint({
  message,
  className,
}: {
  readonly message: string
  readonly className?: string
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border border-line bg-surface-hi/40 px-3 py-2 text-xs text-ink-faint',
        className,
      )}
    >
      <Icon name="raio" className="mt-px size-3.5 shrink-0 text-brand-hi" />
      <span>
        {message}{' '}
        <Link to="/app/assinatura" className="font-medium text-brand-hi underline-offset-2 hover:underline">
          Ver o PRO
        </Link>
      </span>
    </p>
  )
}
