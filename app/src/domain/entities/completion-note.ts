import { formatDuration } from './activation'

export interface CompletionInput {
  /** Itens do dia já concluídos, depois desta conclusão. */
  readonly done: number
  /** Tudo que o dia tem planejado. */
  readonly total: number
  /** Soma estimada do que continua em aberto. Null sem nenhuma estimativa. */
  readonly openMinutes: number | null
  /** O dia inteiro fechou: ações e hábitos. */
  readonly dayComplete: boolean
}

export interface CompletionNote {
  readonly title: string
  /** A consequência concreta. Null quando não há nada honesto a dizer. */
  readonly detail: string | null
  /** Fecho de dia: a tela dá outro tratamento visual. */
  readonly closing: boolean
}

/**
 * O que o app responde quando uma ação do dia é concluída.
 *
 * Concluir não devolvia nada: o item saía da lista, um número mudava e era
 * isso. A ação mais importante do produto acontecia em silêncio.
 *
 * A resposta é factual de propósito. "Mandou bem!" serve pra qualquer pessoa
 * em qualquer dia, e é exatamente por isso que não significa nada; "faltam
 * dois, cerca de 35 min" é uma frase que só cabe neste dia, e é ela que faz a
 * pessoa entender onde está. A celebração à altura do trabalho é a informação
 * bem escrita, a mesma regra que o aviso de conquista já segue.
 */
export function completionNote(input: CompletionInput): CompletionNote {
  const { done, total, openMinutes, dayComplete } = input

  if (dayComplete || (total > 0 && done >= total)) {
    return {
      title: 'Dia cumprido.',
      detail: 'Tudo que estava planejado saiu.',
      closing: true,
    }
  }

  const left = Math.max(total - done, 0)

  if (left === 0) {
    return { title: 'Registrado.', detail: null, closing: false }
  }

  const rest =
    left === 1 ? 'Falta uma pra fechar o dia.' : `Faltam ${left} pra fechar o dia.`

  /*
    O tempo só entra quando existe estimativa. Um "cerca de 0 min" ao lado de
    duas ações em aberto é a frase que ensina a pessoa a não confiar no resto
    da tela.
  */
  const detail =
    openMinutes !== null && openMinutes > 0
      ? `${rest} Cerca de ${formatDuration(openMinutes)}.`
      : rest

  return { title: 'Feito.', detail, closing: false }
}
