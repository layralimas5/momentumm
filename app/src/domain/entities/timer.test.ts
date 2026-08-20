import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  canFinish,
  elapsedMinutes,
  elapsedMs,
  finishTimer,
  formatElapsed,
  isRunning,
  needsValue,
  pauseTimer,
  resumeTimer,
  startTimer,
} from './timer'

const START = new Date(2026, 7, 20, 9, 0, 0)

function at(minutes: number, seconds = 0): Date {
  return new Date(START.getTime() + minutes * 60_000 + seconds * 1000)
}

describe('startTimer', () => {
  it('começa correndo e zerado', () => {
    const session = startTimer('estudo', START)
    expect(isRunning(session)).toBe(true)
    expect(elapsedMs(session, START)).toBe(0)
  })
})

describe('elapsedMs', () => {
  it('conta o tempo desde o início enquanto corre', () => {
    const session = startTimer('estudo', START)
    expect(elapsedMinutes(session, at(25))).toBe(25)
  })

  it('congela na pausa e retoma somando', () => {
    const paused = pauseTimer(startTimer('estudo', START), at(10))
    expect(elapsedMinutes(paused, at(45))).toBe(10)

    const resumed = resumeTimer(paused, at(45))
    expect(elapsedMinutes(resumed, at(50))).toBe(15)
  })

  it('ignora relógio do sistema andando pra trás', () => {
    const session = startTimer('estudo', START)
    expect(elapsedMs(session, at(-30))).toBe(0)
  })

  it('pausar e retomar duas vezes não altera o acumulado', () => {
    const session = pauseTimer(startTimer('treino', START), at(5))
    expect(elapsedMs(pauseTimer(session, at(20)), at(20))).toBe(5 * 60_000)
    expect(resumeTimer(resumeTimer(session, at(20)), at(30)).runningSince).toEqual(at(20))
  })
})

describe('finishTimer', () => {
  it('vira atividade com a duração medida nos eixos de minutos', () => {
    const input = finishTimer(startTimer('meditacao', START), at(12))
    expect(input).toMatchObject({ type: 'meditacao', value: 12, durationMin: 12, source: 'timer' })
    expect(input.occurredAt).toEqual(at(12))
  })

  it('recusa sessão de menos de um minuto', () => {
    expect(() => finishTimer(startTimer('estudo', START), at(0, 40))).toThrow(DomainError)
  })

  it('exige o valor no eixo medido em páginas', () => {
    const session = startTimer('leitura', START)
    expect(needsValue(session)).toBe(true)
    expect(() => finishTimer(session, at(30))).toThrow(DomainError)
    expect(finishTimer(session, at(30), { value: 42 })).toMatchObject({
      value: 42,
      durationMin: 30,
    })
  })

  it('limita sessão esquecida aberta a 24 horas', () => {
    const input = finishTimer(startTimer('treino', START), at(60 * 40))
    expect(input.durationMin).toBe(24 * 60)
  })

  it('guarda a nota quando existe', () => {
    expect(finishTimer(startTimer('estudo', START), at(5), { note: ' revisão ' }).note).toBe(
      ' revisão ',
    )
  })
})

describe('canFinish', () => {
  it('libera só a partir de um minuto', () => {
    const session = startTimer('estudo', START)
    expect(canFinish(session, at(0, 59))).toBe(false)
    expect(canFinish(session, at(1))).toBe(true)
  })
})

describe('formatElapsed', () => {
  it('usa MM:SS até uma hora', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(9 * 60_000 + 5000)).toBe('09:05')
  })

  it('usa HH:MM:SS a partir de uma hora', () => {
    expect(formatElapsed(3_600_000 + 62_000)).toBe('1:01:02')
  })
})
