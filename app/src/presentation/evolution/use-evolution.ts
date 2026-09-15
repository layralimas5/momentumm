import { useContext } from 'react'
import { EvolutionContext, type EvolutionState } from './evolution-context'

export function useEvolution(): EvolutionState {
  const state = useContext(EvolutionContext)
  if (!state) {
    throw new Error('useEvolution precisa estar dentro de <EvolutionProvider>.')
  }
  return state
}
