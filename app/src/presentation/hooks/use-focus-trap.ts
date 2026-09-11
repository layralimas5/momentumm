import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Armadilha de foco de camada modal: Esc fecha, Tab circula dentro, o foco
 * entra ao abrir e volta pra quem abriu ao fechar, e o fundo para de rolar.
 *
 * Escrito à mão porque são poucas regras e todas cabem aqui — e porque diálogo
 * e bottom sheet precisam exatamente das mesmas.
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return

    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Espera o painel montar pra levar o foco pra dentro dele.
    const frame = requestAnimationFrame(() => {
      initialFocusIn(panelRef.current)?.focus()
    })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [open, panelRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const items = focusableIn(panelRef.current)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, panelRef, onClose])
}

/**
 * Onde o foco entra ao abrir: o primeiro campo, quando existe.
 *
 * O primeiro focável de todo painel é o botão de fechar do cabeçalho. Abrir a
 * busca rápida, digitar e nada acontecer, porque o foco estava no "Fechar", é
 * o diálogo ensinando a usar o mouse. Sem campo (confirmação, folha de
 * escolhas) o primeiro focável continua sendo o destino: ali o botão de fechar
 * é a opção mais segura pra um Enter apressado.
 */
function initialFocusIn(root: HTMLElement | null): HTMLElement | undefined {
  const items = focusableIn(root)
  return items.find((element) => element.matches(FIELD)) ?? items[0]
}

const FIELD = 'input:not([type="checkbox"]):not([type="radio"]),textarea,select'

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}
