import {
  SHARE_TEMPLATES,
  SHARE_TEMPLATE_SPECS,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { cn } from '@/shared/lib/cn'

interface TemplateControlsProps {
  readonly value: ShareTemplateId
  readonly onChange: (template: ShareTemplateId) => void
}

/**
 * Seletor de COR.
 *
 * Quatro: preto, neon, branco e o PNG sem fundo. Como o arranjo virou uma
 * escolha própria — o carrossel do preview —, aqui sobrou só a pergunta que a
 * amostra responde de longe: claro, escuro, aceso ou sem fundo.
 *
 * A amostra é o fundo de cada cor, não um preview do card: quatro previews
 * completos rodando junto com os seis do carrossel seriam dez desenhos por
 * toque, e nenhum deles responderia melhor que o quadradinho.
 */
export function ShareStudioControls({ value, onChange }: TemplateControlsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Cor do card"
      className="grid grid-cols-4 gap-2"
    >
      {SHARE_TEMPLATES.map((template) => {
        const spec = SHARE_TEMPLATE_SPECS[template]
        const selected = template === value

        return (
          <button
            key={template}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(template)}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-2 text-left transition-all duration-150',
              selected
                ? 'border-brand bg-brand-dim/40 shadow-[0_0_0_1px_var(--color-brand)]'
                : 'border-line bg-surface-hi/50 hover:border-line-hi active:bg-surface-top',
            )}
          >
            <Swatch template={template} />
            <span className="min-w-0">
              <span
                className={cn(
                  'block truncate text-xs font-medium',
                  selected ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {spec.label}
              </span>
              <span className="block truncate text-[11px] text-ink-faint">{spec.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const SWATCHES: Readonly<Record<ShareTemplateId, string>> = {
  dark: 'bg-[#0a0a0b]',
  neon: 'bg-[#0a0a0b] ring-1 ring-inset ring-brand',
  light: 'bg-[#fafafa]',
  transparent:
    'bg-[length:12px_12px] bg-[linear-gradient(45deg,#26262c_25%,transparent_25%),linear-gradient(-45deg,#26262c_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#26262c_75%),linear-gradient(-45deg,transparent_75%,#26262c_75%)] bg-[position:0_0,0_6px,6px_-6px,-6px_0]',
}

/** Miniatura 9:16 do fundo, com dois traços no lugar do texto. */
function Swatch({ template }: { readonly template: ShareTemplateId }) {
  const light = template === 'light'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-14 w-full flex-col justify-center gap-1 rounded-lg border border-line px-2',
        SWATCHES[template],
      )}
    >
      <span className={cn('h-2.5 w-8 rounded-full', light ? 'bg-[#0a0a0b]' : 'bg-white/90')} />
      <span className={cn('h-1 w-10 rounded-full', light ? 'bg-black/25' : 'bg-white/30')} />
    </span>
  )
}
