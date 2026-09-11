import { MOMENTUM_RULES } from '@/domain/entities/momentum'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * "Como seu score é calculado".
 *
 * As regras vêm do domínio (`MOMENTUM_RULES`), que é o mesmo texto que a
 * Momentumm AI recebe. Recolhido por padrão: quem abre o diálogo quer saber
 * por que 62, e a lista de regras é a leitura de quem quer entender a conta
 * inteira — vale existir, não vale empurrar.
 */
export function MomentumRules({ className }: { readonly className?: string }) {
  return (
    <details className={cn('group rounded-card border border-line bg-surface', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Como seu score é calculado
        <Icon
          name="expandir"
          className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <ol className="flex flex-col gap-3 border-t border-line px-4 py-3">
        {MOMENTUM_RULES.map((rule) => (
          <li key={rule.title} className="text-sm">
            <p className="font-medium text-ink">{rule.title}</p>
            <p className="mt-0.5 text-xs text-pretty text-ink-muted">{rule.detail}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}
