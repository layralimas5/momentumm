import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Reordenar arrastando, com o item seguindo o dedo.
 *
 * O plano é uma ordem de execução, e ordem se decide olhando a lista inteira:
 * arrastar o card até o lugar é uma decisão só, enquanto subir de um em um
 * obriga a pessoa a repetir o mesmo clique contando posições.
 *
 * ## O que arrasta é a alça, não o card
 *
 * Só a alça captura o ponteiro (`touch-action: none` mora nela). O resto do
 * card continua rolando a página normalmente no celular — arrastar a lista
 * inteira brigaria com a rolagem justamente onde ela mais é usada.
 *
 * ## Teclado e leitor de tela continuam funcionando
 *
 * A alça é um botão de verdade: com o foco nela, seta pra cima e pra baixo
 * movem o item uma posição. É o que as setinhas faziam, sem ocupar dois alvos
 * em cada linha — e sem deixar de fora quem não usa ponteiro.
 */

interface DragState {
  /** Posição de onde o item saiu. */
  readonly from: number
  /** Posição onde ele cairia se solto agora. */
  readonly to: number
  /** Quanto o ponteiro já andou desde que pegou. */
  readonly offset: number
  /** Altura do item mais o espaço entre um e outro: o quanto os vizinhos abrem. */
  readonly step: number
}

export interface DragSortHandle {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  readonly style: CSSProperties
}

export interface DragSort {
  /** Registra o elemento de cada item: é deles que saem as medidas do arraste. */
  setItemRef(index: number): (element: HTMLElement | null) => void
  handleProps(index: number): DragSortHandle
  itemStyle(index: number): CSSProperties | undefined
  /** Índice sendo arrastado agora, pra tela dar o destaque. */
  readonly activeIndex: number | null
}

export function useDragSort(
  count: number,
  onMove: (from: number, to: number) => void,
): DragSort {
  const elements = useRef<(HTMLElement | null)[]>([])
  const rects = useRef<DOMRect[]>([])
  const startY = useRef(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  /*
    O mesmo estado num ref, e não é redundância: soltar precisa LER o destino
    pra avisar quem reordena, e ler de dentro do atualizador do `useState`
    dispararia a gravação no meio do render de outro componente — o React
    avisa em voz alta e, mais cedo ou mais tarde, isso vira estado perdido.
  */
  const current = useRef<DragState | null>(null)

  const apply = useCallback((next: DragState | null) => {
    current.current = next
    setDrag(next)
  }, [])

  const setItemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      elements.current[index] = element
    },
    [],
  )

  const begin = useCallback((index: number, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return

    const measured = elements.current
      .slice(0, count)
      .map((element) => element?.getBoundingClientRect() ?? null)
    if (measured.some((rect) => rect === null)) return

    rects.current = measured as DOMRect[]
    startY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)

    const own = rects.current[index]
    const next = rects.current[index + 1]
    // O passo é a distância entre o topo de um item e o do seguinte: assim ele
    // já inclui o espaçamento da lista, sem a tela precisar informar qual é.
    const step = own ? (next ? next.top - own.top : own.height) : 0

    apply({ from: index, to: index, offset: 0, step })
  }, [count, apply])

  const move = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const active = current.current
      if (!active) return

      const offset = event.clientY - startY.current
      const own = rects.current[active.from]
      if (!own) return

      /*
        O destino é quantos itens ficaram acima do centro do que está na mão.
        Contar assim (em vez de perguntar "sobre qual item estou") acerta
        sozinho o caso de arrastar pro fim da lista, onde não há item embaixo.
      */
      const center = own.top + own.height / 2 + offset
      const to = rects.current.filter(
        (rect, index) => index !== active.from && rect.top + rect.height / 2 < center,
      ).length

      if (to === active.to && offset === active.offset) return
      apply({ ...active, offset, to })
    },
    [apply],
  )

  const drop = useCallback(() => {
    const active = current.current
    apply(null)
    if (active && active.to !== active.from) onMove(active.from, active.to)
  }, [onMove, apply])

  const handleProps = useCallback(
    (index: number): DragSortHandle => ({
      onPointerDown: (event) => begin(index, event),
      onPointerMove: move,
      onPointerUp: drop,
      onPointerCancel: drop,
      onKeyDown: (event) => {
        const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        if (direction === 0) return
        const target = index + direction
        if (target < 0 || target >= count) return
        event.preventDefault()
        onMove(index, target)
      },
      // Sem isso o navegador do celular entende o arraste como rolagem e o
      // item nunca sai do lugar.
      style: { touchAction: 'none' },
    }),
    [begin, move, drop, onMove, count],
  )

  const itemStyle = useCallback(
    (index: number): CSSProperties | undefined => {
      if (!drag) return undefined

      if (index === drag.from) {
        return {
          transform: `translateY(${drag.offset}px)`,
          zIndex: 20,
          position: 'relative',
          // Sem transição no item na mão: ele precisa acompanhar o dedo sem
          // atraso, enquanto os vizinhos abrem espaço com calma.
          transition: 'none',
          cursor: 'grabbing',
        }
      }

      const goingDown = drag.to > drag.from
      const shifted = goingDown
        ? index > drag.from && index <= drag.to
        : index >= drag.to && index < drag.from

      return {
        transform: shifted ? `translateY(${goingDown ? -drag.step : drag.step}px)` : undefined,
        transition: 'transform 160ms ease',
      }
    },
    [drag],
  )

  return { setItemRef, handleProps, itemStyle, activeIndex: drag?.from ?? null }
}
