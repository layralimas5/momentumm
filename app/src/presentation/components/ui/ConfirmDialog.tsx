import { Button } from './Button'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly cancelLabel?: string
  /** Ação que não dá pra desfazer sozinha pinta o botão de vermelho. */
  readonly destructive?: boolean
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/**
 * Confirmação de ação difícil de reverter.
 *
 * Existe só pro que apaga ou cancela trabalho. Pedir confirmação pra tudo
 * ensina a pessoa a clicar "sim" sem ler, e aí a confirmação que importava
 * também passa batida.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
