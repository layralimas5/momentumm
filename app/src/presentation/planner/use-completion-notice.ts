import { useEffect, useRef, useState } from 'react'
import { completionNote, type CompletionNote } from '@/domain/entities/completion-note'
import type { DashboardView } from './use-dashboard'

/** Quanto tempo o aviso fica antes de sair sozinho. */
const AUTO_HIDE_MS = 5000

export interface CompletionNotice extends CompletionNote {
  /** Muda a cada conclusão: é o que faz a animação rodar de novo. */
  readonly id: number
}

/**
 * O aviso que responde a uma conclusão.
 *
 * Observa o contador do dia em vez de pendurar um callback em cada botão.
 * Concluir acontece em cinco lugares (a lista do foco, o card da prioridade,
 * os hábitos, o plano e o fim de uma sessão de foco), e a alternativa seria
 * repetir a mesma chamada nos cinco, com cinco chances de esquecer um.
 *
 * Só sobe: desmarcar um item baixa o contador e não merece aviso nenhum, que é
 * o comportamento de quem corrigiu um toque errado.
 */
export function useCompletionNotice(view: DashboardView): {
  readonly notice: CompletionNotice | null
  readonly dismiss: () => void
} {
  const [notice, setNotice] = useState<CompletionNotice | null>(null)
  const previous = useRef<number | null>(null)
  const sequence = useRef(0)

  const { done, total, minutes } = view.focus
  const { dayComplete } = view

  useEffect(() => {
    const before = previous.current
    previous.current = done

    // A primeira leitura é o estado em que a tela abriu, não uma conclusão.
    if (before === null || done <= before) return

    sequence.current += 1
    setNotice({
      ...completionNote({ done, total, openMinutes: minutes, dayComplete }),
      id: sequence.current,
    })
  }, [done, total, minutes, dayComplete])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  return { notice, dismiss: () => setNotice(null) }
}
