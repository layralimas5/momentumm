import { useEffect, useRef, useState } from 'react'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { usePlanner } from './use-planner'
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
/** A guarda de "já registrei o dia fechado hoje". Fica no dispositivo. */
const DAY_CLOSED_KEY = 'momentumm.day.closed.v1'

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
  const day = usePlanner().today
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

    /*
      A outra ponta do funil de notificação: a pessoa abriu por um aviso E
      avançou. O servidor só carimba se houver abertura recente, então chamar
      sempre é barato e não credita avanço a aviso nenhum quando não houve.
    */
    void container.push.markConverted().then(
      () => track('notification_converted', 'notificacoes'),
      () => undefined,
    )

    /*
      Concluir é a atividade mais significativa que existe aqui, e é ela que
      reinicia o relógio do lembrete. Sem este carimbo, "quatro horas sem
      atividade" seria medido só por abertura de tela, e quem fechasse o dia
      às 9h receberia um aviso às 13h sobre um dia que já estava resolvido.
    */
    void container.push
      .touchPresence(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .catch(() => undefined)

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

  /*
    O dia inteiro concluído vira UM evento por dia, venha a última conclusão de
    onde vier. Ler o ESTADO em vez de instrumentar cada botão é o que impede
    "fechou o dia pelo Plano" de sumir da métrica.

    A guarda fica no dispositivo: é contagem, não dado de negócio, e sem
    armazenamento o pior caso é o evento repetir na próxima sessão do mesmo
    dia — o que é melhor do que não registrar.
  */
  useEffect(() => {
    if (!dayComplete || total === 0) return
    try {
      if (window.localStorage.getItem(DAY_CLOSED_KEY) === day) return
      window.localStorage.setItem(DAY_CLOSED_KEY, day)
    } catch {
      // Sem armazenamento, segue sem a guarda.
    }
    track('day_completed', 'hoje', { count: total })
  }, [dayComplete, total, day])

  return { notice, dismiss: () => setNotice(null) }
}
