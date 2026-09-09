import { describe, expect, it } from 'vitest'
import { moveItem } from './move-item'

describe('moveItem', () => {
  const lista = ['a', 'b', 'c', 'd']

  it('leva o item pra frente empurrando os do meio', () => {
    expect(moveItem(lista, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('leva o item pra trás empurrando os do meio', () => {
    expect(moveItem(lista, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  /*
    A diferença que motivou a função. Trocar de lugar (o que as setinhas
    faziam) só coincide com mover quando o salto é de uma posição — arrastando
    o terceiro item pro topo, trocar largaria o primeiro no meio da lista.
  */
  it('mover não é trocar de lugar quando o salto é maior que um', () => {
    expect(moveItem(lista, 2, 0)).toEqual(['c', 'a', 'b', 'd'])
    expect(moveItem(lista, 2, 0)).not.toEqual(['c', 'b', 'a', 'd'])
  })

  it('não muda nada quando a posição é a mesma', () => {
    expect(moveItem(lista, 1, 1)).toEqual(lista)
  })

  it('não mexe na lista original', () => {
    const original = [...lista]
    moveItem(lista, 0, 3)
    expect(lista).toEqual(original)
  })

  it('índice que não existe devolve a lista sem o buraco', () => {
    expect(moveItem(lista, 9, 0)).toEqual(lista)
  })
})
