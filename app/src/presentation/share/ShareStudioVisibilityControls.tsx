import type { JourneyEventType } from '@/domain/entities/journey-event'
import {
  SHARE_FIELD_SPECS,
  availableFieldsFor,
  type ShareField,
  type ShareFieldSet,
} from '@/domain/share/share-card'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

interface VisibilityControlsProps {
  readonly eventType: JourneyEventType
  readonly fields: ShareFieldSet
  readonly onToggle: (field: ShareField, value: boolean) => void
}

/**
 * "Mostrar no card" — o controle de privacidade.
 *
 * A regra do produto é menor exposição: nome do objetivo, lista de hábitos e
 * nome da pessoa começam DESLIGADOS, porque são os três campos que carregam
 * texto escrito por ela. Aqui cada um desses vem com o aviso do que aparece se
 * ligar — a decisão é dela, mas informada.
 *
 * Só aparecem os campos que o tipo de evento suporta. Um toggle que não muda
 * nada ensina a pessoa a desconfiar dos outros.
 */
export function ShareStudioVisibilityControls({
  eventType,
  fields,
  onToggle,
}: VisibilityControlsProps) {
  const available = availableFieldsFor(eventType)

  return (
    <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-hi/40">
      {available.map((field) => {
        const spec = SHARE_FIELD_SPECS[field]
        const checked = fields[field]

        return (
          <li key={field}>
            <label
              className={cn(
                'flex min-h-13 cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors',
                'hover:bg-surface-hi active:bg-surface-top',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{spec.label}</span>
                {spec.warning ? (
                  <span
                    className={cn(
                      'mt-0.5 flex items-center gap-1.5 text-xs',
                      checked ? 'text-flame' : 'text-ink-faint',
                    )}
                  >
                    {checked ? <Icon name="cadeado" className="size-3.5 shrink-0" /> : null}
                    {spec.warning}
                  </span>
                ) : null}
              </span>

              <Switch
                checked={checked}
                label={spec.label}
                onChange={(value) => onToggle(field, value)}
              />
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Interruptor. É um `input[type=checkbox]` de verdade por baixo: teclado, leitor
 * de tela e o clique no rótulo inteiro vêm de graça, e nenhum deles precisaria
 * ser reimplementado à mão.
 */
function Switch({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean
  readonly label: string
  readonly onChange: (value: boolean) => void
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors duration-150',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-hi',
          checked ? 'border-brand bg-brand' : 'border-line-hi bg-surface-top',
        )}
      >
        <span
          className={cn(
            'size-4.5 rounded-full bg-white transition-transform duration-150',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </span>
  )
}
