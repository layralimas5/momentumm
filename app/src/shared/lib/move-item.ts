/**
 * Tira o item de uma posição e devolve na outra, sem mexer no original.
 *
 * Trocar os dois de lugar (o que as setinhas faziam) só é igual a isso quando
 * o salto é de uma posição. Arrastando o terceiro item pro topo, trocar deixaria
 * o primeiro no meio da lista; mover empurra todo mundo uma casa, que é o que a
 * pessoa vê acontecendo enquanto arrasta.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return next
  next.splice(to, 0, moved)
  return next
}
