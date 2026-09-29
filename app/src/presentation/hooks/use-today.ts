import { useSyncExternalStore } from 'react'
import { dayKeyOf, msUntilNextDay, type DayKey } from '@/domain/entities/day'

/**
 * O dia de hoje como estado de React, que vira sozinho à meia-noite.
 *
 * `dayKeyOf(new Date())` no corpo do componente só muda quando algo mais faz a
 * tela renderizar. O app instalado fica aberto de um dia pro outro, e sem isso
 * a pessoa abria de manhã e marcava as coisas no dia de ontem.
 *
 * Três portas: o timer da meia-noite, a volta pra aba e o foco da janela. As
 * duas últimas cobrem o celular, que congela timers com a tela apagada.
 */
export function useToday(): DayKey {
  return useSyncExternalStore(subscribe, currentDay, currentDay)
}

function currentDay(): DayKey {
  return dayKeyOf(new Date())
}

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      onChange()
      schedule()
    }, msUntilNextDay(new Date()))
  }

  const onWake = () => {
    onChange()
    schedule()
  }

  schedule()
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', onWake)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('focus', onWake)
  }
}
