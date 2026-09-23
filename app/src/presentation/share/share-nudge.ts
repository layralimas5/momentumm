import type { DayKey } from '@/domain/entities/day'

const KEY = 'momentumm:share-nudge'

/**
 * O convite pra mostrar o Momentumm do dia.
 *
 * O card do Momentumm é o que traz gente nova, e quem acabou de fechar uma
 * ação é justamente quem tem o que mostrar. O convite vive no sino, e não numa
 * faixa fixa na tela: aviso permanente vira mobília e ensina a pessoa a
 * ignorar o sino.
 *
 * Duas condições, as duas honestas: só aparece em dia com movimento de
 * verdade, e só uma vez por dia. Convidar alguém a comemorar um dia parado é
 * cobrança disfarçada de festa.
 *
 * A marca do dia fica no navegador, não no servidor: é conveniência de
 * aparelho, não estado da conta. Perder isso significa, no pior caso, ver o
 * convite outra vez em outro aparelho.
 */
export function shareNudgeSeen(today: DayKey): boolean {
  try {
    return window.localStorage.getItem(KEY) === today
  } catch {
    // Navegador anônimo ou storage bloqueado: sem marca, o convite aparece.
    return false
  }
}

export function markShareNudgeSeen(today: DayKey): void {
  try {
    window.localStorage.setItem(KEY, today)
  } catch {
    // Não poder lembrar não é motivo pra quebrar a tela.
  }
}
