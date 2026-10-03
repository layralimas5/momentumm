import { useCallback, useMemo, useState } from 'react'
import { comebackToday, type Comeback } from '@/domain/entities/rhythm'
import { useMomentumInput } from '@/presentation/planner/use-momentum-input'

const SEEN_KEY = 'momentumm.comeback.seen.v1'

/** A volta de hoje, se houver e se a pessoa ainda não fechou o recado. */
export function useComeback(): { readonly comeback: Comeback | null; dismiss(): void } {
  const input = useMomentumInput()
  const [seenDay, setSeenDay] = useState<string | null>(readSeen)

  const comeback = useMemo(
    () => (seenDay === input.today ? null : comebackToday(input)),
    [input, seenDay],
  )

  const dismiss = useCallback(() => {
    setSeenDay(input.today)
    try {
      window.localStorage.setItem(SEEN_KEY, input.today)
    } catch {
      // Sem armazenamento, o recado some só nesta sessão.
    }
  }, [input.today])

  return { comeback, dismiss }
}

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}
