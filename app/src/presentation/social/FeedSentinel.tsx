import { useEffect, useRef } from 'react'

/**
 * O gatilho do "carregar mais", sem botão.
 *
 * Um `IntersectionObserver` numa div vazia no fim da lista: quando ela entra
 * na tela, a próxima página é pedida. A margem de 400px faz o pedido sair
 * ANTES de a pessoa chegar ao fim, e é isso que separa "a lista continua" de
 * "a lista trava e depois continua".
 *
 * O botão de "carregar mais" continua existindo como reserva na tela, pra
 * quando o observador não estiver disponível e pra quem navega por teclado: um
 * fim de lista que só responde à rolagem é um fim de lista inalcançável sem
 * mouse.
 */
export function FeedSentinel({
  onReach,
  disabled = false,
}: {
  readonly onReach: () => void
  readonly disabled?: boolean
}) {
  const mark = useRef<HTMLDivElement>(null)
  const callback = useRef(onReach)
  callback.current = onReach

  useEffect(() => {
    const node = mark.current
    if (!node || disabled || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current()
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [disabled])

  return <div ref={mark} aria-hidden="true" className="h-px" />
}
