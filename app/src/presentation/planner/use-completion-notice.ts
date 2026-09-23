import { useEffect, useRef, useState } from 'react'
import { completionNote, type CompletionNote } from '@/domain/entities/completion-note'
import type { DashboardView } from './use-dashboard'

/** Quanto tempo o aviso fica antes de sair sozinho. */
const AUTO_HIDE_MS = 5000

/** O objetivo que acabou de andar, com o progresso já calculado pelo planner. */
export interface CompletionObjective {
  readonly title: string
  readonly done: number
  readonly total: number
  /** 0 a 1. */
  readonly ratio: number
}

export interface CompletionNotice extends CompletionNote {
  /** Muda a cada conclusão: é o que faz a animação rodar de novo. */
  readonly id: number
  /**
   * O destino da ação concluída, quando ela tem um.
   *
   * É a recompensa principal: "essa ação fez meu objetivo avançar" diz mais do
   * que qualquer número de XP. Sai do item que mudou de estado agora, nunca de
   * uma estimativa: ação sem objetivo simplesmente não mostra nada.
   */
  readonly objective: CompletionObjective | null
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
  const doneIds = useRef<ReadonlySet<string> | null>(null)
  const sequence = useRef(0)

  const { done, total, minutes } = view.focus
  const { dayComplete } = view
  const items = view.focus.all
  const objectives = view.objectives

  useEffect(() => {
    const before = previous.current
    previous.current = done

    const seen = doneIds.current
    const current = new Set(
      items.filter((item) => item.done).map((item) => `${item.kind}:${item.id}`),
    )
    doneIds.current = current

    // A primeira leitura é o estado em que a tela abriu, não uma conclusão.
    if (before === null || done <= before) return

    // Qual item acabou de fechar. Sem ele o aviso continua, só não fala de destino.
    const justDone = seen
      ? items.find((item) => item.done && !seen.has(`${item.kind}:${item.id}`))
      : undefined
    const view_ = justDone?.objective
      ? objectives.find((entry) => entry.progress.objective.id === justDone.objective?.id)
      : undefined

    sequence.current += 1
    setNotice({
      ...completionNote({ done, total, openMinutes: minutes, dayComplete }),
      id: sequence.current,
      objective: view_
        ? {
            title: view_.progress.objective.title,
            done: view_.progress.done,
            total: view_.progress.target,
            ratio: view_.progress.ratio,
          }
        : null,
    })
  }, [done, total, minutes, dayComplete, items, objectives])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  return { notice, dismiss: () => setNotice(null) }
}
