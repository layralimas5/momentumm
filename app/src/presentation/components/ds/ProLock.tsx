import { Link } from 'react-router-dom'
import { Icon } from '@/presentation/components/ui/Icon'
import { SUBSCRIPTION_PATH } from '@/presentation/plan/subscription-path'
import { cn } from '@/shared/lib/cn'

/**
 * O recurso do PRO no lugar onde ele estaria, sem a lista de benefícios.
 * Uma linha diz o que se ganha; o resto é a assinatura que explica.
 */
export function ProLock({ message, className }: { readonly message: string; readonly className?: string }) {
  return (
    <Link
      to={SUBSCRIPTION_PATH}
      className={cn(
        'well press flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl px-4 py-5 text-center',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-hi">
        <Icon name="cadeado" className="size-4" />
        PRO
      </span>
      <span className="text-sm text-pretty text-ink-muted">{message}</span>
    </Link>
  )
}
