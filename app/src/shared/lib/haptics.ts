/**
 * Vibração curta de confirmação.
 *
 * Marcar um hábito andando na rua costuma acontecer sem olhar a tela; o toque
 * confirma que registrou. Só existe onde o aparelho suporta e onde o sistema
 * permite — é reforço, nunca o único retorno da ação.
 */
export function tapFeedback(pattern: number | readonly number[] = 12): void {
  try {
    navigator.vibrate?.(pattern as number | number[])
  } catch {
    // Navegador sem suporte ou com a permissão negada: a animação já responde.
  }
}
