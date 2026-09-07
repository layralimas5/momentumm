import { SHARE_FORMATS, SHARE_FORMAT_SPECS, type ShareFormat } from '@/domain/share/share-card'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'

interface FormatSelectorProps {
  readonly value: ShareFormat
  readonly onChange: (format: ShareFormat) => void
}

/**
 * Formato da imagem.
 *
 * Três opções e nada mais. O padrão é Stories porque é onde o
 * compartilhamento de progresso realmente acontece — e porque o 9:16 é o único
 * que já nasce ocupando a tela inteira de quem vê.
 */
export function ShareStudioFormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <ChoiceGroup
      fill
      label="Formato da imagem"
      value={value}
      onChange={onChange}
      options={SHARE_FORMATS.map((format) => ({
        value: format,
        label: SHARE_FORMAT_SPECS[format].label,
        hint: SHARE_FORMAT_SPECS[format].ratio,
      }))}
    />
  )
}
