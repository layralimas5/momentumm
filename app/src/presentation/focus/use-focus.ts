import { useContext } from 'react'
import { FocusContext, type FocusState } from './focus-context'

export function useFocus(): FocusState {
  const state = useContext(FocusContext)
  if (!state) {
    throw new Error('useFocus precisa estar dentro de <FocusProvider>.')
  }
  return state
}
