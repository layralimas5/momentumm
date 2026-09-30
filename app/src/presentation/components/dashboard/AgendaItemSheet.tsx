import { useState } from 'react'
import { addDays, type DayKey } from '@/domain/entities/day'
import type { AgendaItem } from '@/domain/entities/day-agenda'
import { planOccurrenceMove } from '@/domain/entities/routine-item'
import type { Task } from '@/domain/entities/task'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { RescheduleForm } from '@/presentation/components/dashboard/RescheduleForm'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * O que dá pra fazer com uma linha do dia.
 *
 * ## Por que um menu, e não mais botões
 *
 * A linha tinha o check e mais dois ícones, 88px de alvo numa tela de 390px, e
 * era isso que fazia título de quatro palavras quebrar em duas linhas. Um menu
 * devolve a largura ao texto e, de quebra, cabe o que não cabia: reagendar,
 * pular, editar.
 *
 * ## Reagendar aqui é SÓ HOJE
 *
 * Mudar o horário desta linha muda ESTE dia. A regra da rotina se muda em
 * "Editar", que diz em voz alta que vale pra todos os dias daqui pra frente.
 * São dois lugares diferentes de propósito: um diálogo perguntando "só hoje ou
 * sempre?" a cada toque é a forma mais rápida de alguém mudar a recorrência
 * inteira sem querer, e depois não descobrir onde desfazer.
 *
 * Por isso o submenu separa os dois em blocos com nome: "Só nesse dia" mexe na
 * ocorrência (mais tarde, amanhã ou um dia e horário escolhidos) e "Na rotina"
 * abre a regra.
 *
 * ## Hábito não muda de data
 *
 * É a mesma regra do Dia Adaptável: hábito não é reagendado, ele encolhe pra
 * versão mínima ou é pulado com consciência. Mover hábito pra amanhã é o começo
 * da dívida que nunca se paga, e ele perderia a sequência do jeito errado.
 */
export function AgendaItemSheet({
  item,
  today,
  onClose,
  onStartFocus,
  onEditTask,
  onEditRoutine,
  onEditHabit,
}: {
  readonly item: AgendaItem | null
  readonly today: DayKey
  readonly onClose: () => void
  readonly onStartFocus: (task: Task) => void
  readonly onEditTask: (task: Task) => void
  readonly onEditRoutine: (itemId: string) => void
  readonly onEditHabit: (habitId: string) => void
}) {
  const planner = usePlanner()
  const [mode, setMode] = useState<'menu' | 'reagendar' | 'escolher'>('menu')

  const close = () => {
    setMode('menu')
    onClose()
  }

  if (!item) {
    return (
      <BottomSheet open={false} title="" onClose={close}>
        <span />
      </BottomSheet>
    )
  }

  const { task, habitState, routineState } = item
  const resolved = item.done || item.skipped

  const concluir = async () => {
    if (task) await planner.setTaskDone(task.id, !item.done)
    else if (habitState)
      await planner.setHabitStatus(habitState.habit.id, item.done ? 'pendente' : 'feito')
    else if (routineState)
      await planner.setRoutineStatus(routineState.item.id, {
        status: item.done ? 'pendente' : 'feito',
        plannedTime: item.time,
      })
    close()
  }

  /** Daqui a uma hora, arredondado pra meia hora. É o "mais tarde" honesto. */
  const maisTarde = (): string => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 60)
    now.setMinutes(now.getMinutes() < 30 ? 30 : 0, 0, 0)
    if (now.getMinutes() === 0) now.setHours(now.getHours() + 1)
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  const adiarPraHoje = async () => {
    const hora = maisTarde()
    if (task) await planner.updateTask(task.id, { timeOfDay: hora })
    else if (routineState)
      await planner.setRoutineStatus(routineState.item.id, {
        status: 'pendente',
        timeOverride: hora,
        plannedTime: item.time,
      })
    close()
  }

  const adiarPraAmanha = async () => {
    const amanha = addDays(today, 1)
    if (task) await planner.updateTask(task.id, { day: amanha })
    else if (routineState)
      await planner.setRoutineStatus(routineState.item.id, {
        status: 'reagendado',
        movedToDay: amanha,
        plannedTime: item.time,
      })
    close()
  }

  const moverPara = async (day: DayKey, time: string | null) => {
    const move = planOccurrenceMove({
      from: today,
      to: day,
      time,
      currentTime: item.time,
      ruleTime: routineState ? routineState.item.timeOfDay : null,
    })

    if (task) {
      await planner.updateTask(
        task.id,
        move.kind === 'mesmo-dia'
          ? { timeOfDay: move.time }
          : { day: move.day, ...(move.time ? { timeOfDay: move.time } : {}) },
      )
    } else if (routineState) {
      const itemId = routineState.item.id
      if (move.kind === 'mesmo-dia') {
        await planner.setRoutineStatus(itemId, {
          status: 'pendente',
          timeOverride: move.time,
          plannedTime: item.time,
        })
      } else {
        await planner.setRoutineStatus(itemId, {
          status: 'reagendado',
          movedToDay: move.day,
          plannedTime: item.time,
        })
        if (move.time) {
          await planner.setRoutineStatus(itemId, { status: 'pendente', timeOverride: move.time }, move.day)
        }
      }
    }
    close()
  }

  const pularHoje = async () => {
    if (habitState) await planner.setHabitStatus(habitState.habit.id, 'pulado')
    else if (routineState)
      await planner.setRoutineStatus(routineState.item.id, {
        status: 'pulado',
        plannedTime: item.time,
      })
    else if (task) await planner.updateTask(task.id, { day: addDays(today, 1) })
    close()
  }

  return (
    <BottomSheet
      open
      title={item.title}
      description={
        item.time
          ? `${item.role} · planejado para ${item.time}`
          : item.role
      }
      onClose={close}
    >
      <div className="flex flex-col gap-1">
        {mode === 'escolher' ? (
          <RescheduleForm
            today={today}
            initialTime={item.time}
            onSubmit={moverPara}
            onCancel={() => setMode('reagendar')}
          />
        ) : mode === 'reagendar' ? (
          <>
            <SheetGroupLabel>Só nesse dia</SheetGroupLabel>
            <SheetAction
              icon={<Icon name="relogio" className="size-5" />}
              label="Hoje, mais tarde"
              hint={`Passa para ${maisTarde()}`}
              tone="brand"
              onClick={() => void adiarPraHoje()}
            />
            <SheetAction
              icon={<Icon name="calendario" className="size-5" />}
              label="Amanhã"
              hint="Sai do dia de hoje e aparece amanhã"
              onClick={() => void adiarPraAmanha()}
            />
            <SheetAction
              icon={<Icon name="adiar" className="size-5" />}
              label="Escolher dia e horário"
              hint={routineState ? 'Move só essa vez, os outros dias ficam iguais' : 'Leva a ação pra outra data ou hora'}
              onClick={() => setMode('escolher')}
            />

            {routineState ? (
              <>
                <SheetGroupLabel>Na rotina</SheetGroupLabel>
                <SheetAction
                  icon={<Icon name="editar" className="size-5" />}
                  label="Mudar em todos os dias"
                  hint="Abre o item: o que mudar ali vale daqui pra frente"
                  onClick={() => {
                    onEditRoutine(routineState.item.id)
                    close()
                  }}
                />
              </>
            ) : null}

            <SheetAction
              icon={<Icon name="seta" className="size-5 rotate-180" />}
              label="Voltar"
              onClick={() => setMode('menu')}
            />
          </>
        ) : (
          <>
            <SheetAction
              icon={<Icon name="check" className="size-5" />}
              label={item.done ? 'Desfazer' : 'Concluir'}
              tone={item.done ? 'neutral' : 'brand'}
              onClick={() => void concluir()}
            />

            {task && !resolved ? (
              <SheetAction
                icon={<Icon name="play" className="size-5" />}
                label="Fazer agora"
                hint="Abre o cronômetro nessa ação"
                onClick={() => {
                  onStartFocus(task)
                  close()
                }}
              />
            ) : null}

            {habitState && !resolved ? (
              <SheetAction
                icon={<Icon name="minimo" className="size-5" />}
                label="Fazer a versão mínima"
                hint="Conta como cumprido e segura a sequência"
                onClick={() => {
                  void planner.setHabitStatus(habitState.habit.id, 'minimo')
                  close()
                }}
              />
            ) : null}

            {/* Hábito não muda de data: ele encolhe ou é pulado. */}
            {(task || routineState) && !resolved ? (
              <SheetAction
                icon={<Icon name="adiar" className="size-5" />}
                label="Reagendar"
                hint={routineState ? 'Só hoje. A rotina continua igual' : 'Outro horário ou outro dia'}
                onClick={() => setMode('reagendar')}
              />
            ) : null}

            {!resolved ? (
              <SheetAction
                icon={<Icon name="desfazer" className="size-5" />}
                label="Pular hoje"
                hint="Sem cobrança, e sem mexer nos outros dias"
                onClick={() => void pularHoje()}
              />
            ) : null}

            <SheetAction
              icon={<Icon name="editar" className="size-5" />}
              label="Editar"
              {...(routineState ? { hint: 'Vale pra todos os dias daqui pra frente' } : {})}
              onClick={() => {
                if (task) onEditTask(task)
                else if (routineState) onEditRoutine(routineState.item.id)
                else if (habitState) onEditHabit(habitState.habit.id)
                close()
              }}
            />
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function SheetGroupLabel({ children }: { readonly children: string }) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-ink-faint uppercase first:pt-0">
      {children}
    </p>
  )
}
