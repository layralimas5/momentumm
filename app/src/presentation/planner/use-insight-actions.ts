import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CapacityProfile } from '@/domain/entities/checkin'
import { addDays } from '@/domain/entities/day'
import type { Insight } from '@/domain/entities/insight'
import { isPending, shrinkToMinimal, type Task } from '@/domain/entities/task'
import { useFocus } from '@/presentation/focus/use-focus'
import { useComposer } from './ComposerProvider'
import { usePlanner } from './use-planner'

/**
 * O que o app FAZ com o que ele percebeu.
 *
 * Um insight que só descreve o problema devolve o trabalho pra pessoa: ela
 * lê "você planejou seis ações num dia de três" e ainda precisa abrir a lista,
 * escolher três e mudar a data de cada uma. Aqui cada recomendação tem a
 * execução dela, e é a mesma execução em qualquer tela que mostre o insight.
 *
 * Morava dentro do dashboard, e por isso o mesmo insight era acionável lá e
 * apenas texto na tela de Insights — duas leituras do mesmo dado com poderes
 * diferentes.
 */

/**
 * O mínimo que as ações precisam saber sobre o dia.
 *
 * O contrato é estreito de propósito: `DashboardView` satisfaz ele por
 * estrutura, e telas que não montam o dashboard inteiro — o progresso, por
 * exemplo — conseguem aplicar a mesma recomendação sem recalcular tudo.
 */
export interface InsightContext {
  readonly capacity: CapacityProfile
  readonly mainPriority: Task | null
}

export interface InsightActions {
  /** Executa a recomendação. Não dispensa o insight: quem decide isso é a tela. */
  apply(insight: Insight): Promise<void>
  /** Abre o cronômetro nessa ação. Usado pelo dia e pelas recomendações. */
  startFocus(task: Task): void
  /** Troca a ação pela versão mínima dela. É a saída pro dia ruim. */
  shrinkTask(task: Task): Promise<void>
}

export function useInsightActions(context: InsightContext): InsightActions {
  const planner = usePlanner()
  const composer = useComposer()
  const focus = useFocus()
  const navigate = useNavigate()

  const startFocus = useCallback(
    (task: Task) => {
      focus.start({
        axis: task.axis ?? 'estudo',
        label: task.title,
        plannedMin: Math.min(60, Math.max(15, task.estimatedMin)),
        taskId: task.id,
      })
      focus.setImmersive(true)
    },
    [focus],
  )

  const shrinkTask = useCallback(
    async (task: Task) => {
      const smaller = shrinkToMinimal(task)
      await planner.updateTask(task.id, {
        title: smaller.title,
        minimalVersion: null,
        estimatedMin: smaller.estimatedMin,
        effort: smaller.effort,
      })
    },
    [planner],
  )

  const apply = useCallback(
    async (insight: Insight) => {
      const pendingToday = planner.tasks.filter(
        (task) => task.day === planner.today && isPending(task),
      )

      switch (insight.action) {
        case 'reduzir-acoes-do-dia': {
          const keep = context.capacity.suggestedActions
          const extras = pendingToday
            .filter((task) => task.id !== context.mainPriority?.id)
            .slice(Math.max(0, keep - 1))
          for (const task of extras) {
            await planner.updateTask(task.id, { day: addDays(planner.today, 1) })
          }
          break
        }
        case 'usar-versao-minima': {
          for (const task of pendingToday.filter((item) => item.minimalVersion)) {
            await shrinkTask(task)
          }
          break
        }
        case 'proteger-sequencia': {
          if (context.mainPriority) startFocus(context.mainPriority)
          else composer.open('acao')
          break
        }
        case 'concentrar-na-manha': {
          if (context.mainPriority && !context.mainPriority.isMainPriority) {
            await planner.updateTask(context.mainPriority.id, { isMainPriority: true })
          }
          break
        }
        case 'criar-primeira-acao': {
          composer.open('acao')
          break
        }
        /*
          As três ações da hierarquia levam a pessoa até onde a decisão
          acontece. Um insight que aponta uma etapa travada e não abre essa
          etapa transfere pra pessoa o trabalho de encontrar de novo o que o
          app acabou de achar.
        */
        case 'abrir-objetivo': {
          const target = insight.focus?.objectiveId
          if (target) navigate(`/app/objetivos/${target}`)
          break
        }
        case 'abrir-plano': {
          navigate('/app/plano')
          break
        }
        case 'comecar-acao': {
          const task = planner.tasks.find((item) => item.id === insight.focus?.taskId)
          if (task) startFocus(task)
          break
        }
        case 'nenhuma':
          break
      }
    },
    [planner, context.capacity, context.mainPriority, composer, navigate, shrinkTask, startFocus],
  )

  return { apply, startFocus, shrinkTask }
}
