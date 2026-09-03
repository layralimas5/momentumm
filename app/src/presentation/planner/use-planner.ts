import { useContext } from 'react'
import { PlannerContext, type PlannerState } from './planner-context'

export function usePlanner(): PlannerState {
  const state = useContext(PlannerContext)
  if (!state) {
    throw new Error('usePlanner precisa estar dentro de <PlannerProvider>.')
  }
  return state
}
