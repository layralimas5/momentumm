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
 * Seletor de template.
 *
 * A amostra é uma miniatura do FUNDO de cada tema, não um preview do card
 * inteiro: cinco previews completos rodando junto com o principal seriam seis
 * desenhos por tecla apertada, e o que a pessoa procura aqui é "claro, escuro
 * ou sem fundo", que a amostra responde de longe.
 *
 * Rola na horizontal no celular e quebra em grade no desktop — sem passar de
 * cinco opções: template demais transforma a escolha em trabalho.
 */
export function ShareStudioControls({ value, onChange }: TemplateControlsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Template do card"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible"
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
              'flex w-28 shrink-0 flex-col gap-2 rounded-xl border p-2 text-left transition-all duration-150 lg:w-auto',
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
  light: 'bg-[#fafafa]',
  gradient: 'bg-[linear-gradient(150deg,#2a2450_0%,#16142b_55%,#0a0a0b_100%)]',
  minimal: 'bg-[#0a0a0b]',
  transparent:
    'bg-[length:12px_12px] bg-[linear-gradient(45deg,#26262c_25%,transparent_25%),linear-gradient(-45deg,#26262c_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#26262c_75%),linear-gradient(-45deg,transparent_75%,#26262c_75%)] bg-[position:0_0,0_6px,6px_-6px,-6px_0]',
}

/** Miniatura 9:16 do fundo, com um traço no lugar onde o número apareceria. */
function Swatch({ template }: { readonly template: ShareTemplateId }) {
  const light = template === 'light'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-16 w-full flex-col justify-center gap-1 rounded-lg border border-line px-2',
        template === 'minimal' && 'items-center',
        SWATCHES[template],
      )}
    >
      <span
        className={cn('h-2.5 w-8 rounded-full', light ? 'bg-[#0a0a0b]' : 'bg-white/90')}
      />
      <span className={cn('h-1 w-10 rounded-full', light ? 'bg-black/25' : 'bg-white/30')} />
    </span>
  )
}
