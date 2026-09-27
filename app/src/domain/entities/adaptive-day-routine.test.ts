import { describe, expect, it } from 'vitest'
import { dayLoadOf, routineReservedMin } from './adaptive-day'
import { parseDayKey } from './day'
import { createRoutineItem, type RoutineItem } from './routine-item'

const HOJE = parseDayKey('2026-09-28')
const NASCIMENTO = new Date('2026-09-01')

function rotina(id: string, objectiveId: string | null, durationMin: number): RoutineItem {
  return createRoutineItem(
    { userId: 'lay', title: `Item ${id}`, objectiveId, durationMin, timeOfDay: '18:30' },
    id,
    NASCIMENTO,
  )
}

/**
 * A linha que decide o recurso: só a rotina LIGADA A OBJETIVO reserva tempo.
 *
 * Quando a pessoa responde "tenho duas horas", ela diz quanto tempo tem PRA
 * ISSO, não quantas horas sobram no relógio depois do expediente. Descontar o
 * almoço e o trabalho desse número devolveria meia hora de plano pra quem tem
 * duas, e o Dia Adaptável pararia de fazer sentido no primeiro uso.
 */
describe('a rotina dentro do Dia Adaptável', () => {
  it('a do objetivo reserva tempo; a da vida, não', () => {
    const doObjetivo = rotina('treino', 'o1', 45)
    const daVida = rotina('almoco', null, 60)

    expect(routineReservedMin([doObjetivo, daVida], [], HOJE)).toBe(45)
  })

  it('item já resolvido no dia não reserva nada', () => {
    const treino = rotina('treino', 'o1', 45)
    const feito = [
      {
        id: 'o-1',
        userId: 'lay',
        itemId: treino.id,
        day: HOJE,
        status: 'feito' as const,
        plannedTime: null,
        timeOverride: null,
        movedToDay: null,
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ]

    expect(routineReservedMin([treino], feito, HOJE)).toBe(0)
  })

  it('a carga do dia soma a rotina do objetivo e ignora a da vida', () => {
    const carga = dayLoadOf({
      today: HOJE,
      tasks: [],
      habits: [],
      habitLogs: [],
      routineItems: [rotina('treino', 'o1', 45), rotina('almoco', null, 60)],
      routineOccurrences: [],
    })

    expect(carga.minutes).toBe(45)
    expect(carga.items).toBe(1)
  })

  it('sem rotina nenhuma, a carga continua exatamente como era', () => {
    expect(dayLoadOf({ today: HOJE, tasks: [], habits: [], habitLogs: [] })).toEqual({
      minutes: 0,
      items: 0,
    })
  })
})
