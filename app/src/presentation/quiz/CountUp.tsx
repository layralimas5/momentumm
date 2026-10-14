import { animate } from 'framer-motion'
import { useEffect, useState } from 'react'
import { EASE_ENTER } from './quiz-motion'

/**
 * Um número que sobe de zero até o valor. O valor final é o único que o
 * leitor de tela ouve: o que muda no caminho é só desenho.
 */
export function CountUp({
  to,
  reduced,
  delay = 0.3,
  duration = 1.2,
  format = String,
}: {
  readonly to: number
  readonly reduced: boolean
  readonly delay?: number
  readonly duration?: number
  readonly format?: (value: number) => string
}) {
  const [value, setValue] = useState(reduced ? to : 0)

  useEffect(() => {
    if (reduced) {
      setValue(to)
      return
    }
    const controls = animate(0, to, {
      duration,
      delay,
      ease: EASE_ENTER,
      onUpdate: (latest) => setValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [to, reduced, delay, duration])

  return (
    <>
      <span aria-hidden="true">{format(value)}</span>
      <span className="sr-only">{format(to)}</span>
    </>
  )
}
