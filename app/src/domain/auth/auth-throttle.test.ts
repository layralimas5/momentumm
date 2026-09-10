import { describe, expect, it } from 'vitest'
import { DomainError } from '@/shared/errors'
import {
  assertThrottle,
  checkThrottle,
  clearAttempts,
  FREE_ATTEMPTS,
  registerFailure,
  type AttemptLog,
} from './auth-throttle'

const T0 = 1_770_000_000_000

/** Falha `count` vezes seguidas, todas no mesmo instante. */
function afterFailures(count: number, at = T0): AttemptLog {
  let log: AttemptLog = {}
  for (let i = 0; i < count; i += 1) log = registerFailure(log, 'login', at)
  return log
}

describe('checkThrottle', () => {
  it('deixa passar enquanto as tentativas são humanas', () => {
    for (let count = 0; count <= FREE_ATTEMPTS; count += 1) {
      expect(checkThrottle(afterFailures(count), 'login', T0).allowed).toBe(true)
    }
  })

  it('trava depois das tentativas livres', () => {
    const verdict = checkThrottle(afterFailures(FREE_ATTEMPTS + 1), 'login', T0)

    expect(verdict.allowed).toBe(false)
    expect(verdict.waitSeconds).toBeGreaterThan(0)
    expect(verdict.message).toContain('Muitas tentativas')
  })

  it('a espera cresce a cada tentativa e tem teto', () => {
    const esperas = [1, 2, 3, 4, 5, 6, 7, 8].map(
      (extra) => checkThrottle(afterFailures(FREE_ATTEMPTS + extra), 'login', T0).waitSeconds,
    )

    // Cresce...
    expect(esperas[1]).toBeGreaterThan(esperas[0] ?? 0)
    expect(esperas[2]).toBeGreaterThan(esperas[1] ?? 0)
    // ...e para de crescer: freio é proteção, não punição.
    expect(Math.max(...esperas)).toBeLessThanOrEqual(300)
  })

  it('libera quando o tempo de espera passa', () => {
    const log = afterFailures(FREE_ATTEMPTS + 1)
    const travado = checkThrottle(log, 'login', T0)

    expect(travado.allowed).toBe(false)
    expect(checkThrottle(log, 'login', T0 + travado.waitSeconds * 1000).allowed).toBe(true)
  })

  it('esquece a contagem depois de um bom tempo parado', () => {
    const log = afterFailures(20)
    expect(checkThrottle(log, 'login', T0 + 16 * 60 * 1000).allowed).toBe(true)
  })

  it('cada ação tem a própria contagem', () => {
    // Errar a senha não pode travar o cadastro de outra pessoa no mesmo
    // navegador — nem o pedido de recuperação de quem esqueceu a senha.
    const log = afterFailures(FREE_ATTEMPTS + 3)

    expect(checkThrottle(log, 'login', T0).allowed).toBe(false)
    expect(checkThrottle(log, 'cadastro', T0).allowed).toBe(true)
    expect(checkThrottle(log, 'recuperacao', T0).allowed).toBe(true)
  })
})

describe('registerFailure e clearAttempts', () => {
  it('só o fracasso conta: acertar zera a escada', () => {
    const log = clearAttempts(afterFailures(FREE_ATTEMPTS + 2), 'login')
    expect(checkThrottle(log, 'login', T0).allowed).toBe(true)
  })

  it('não muda o registro anterior', () => {
    const antes = afterFailures(2)
    const depois = registerFailure(antes, 'login', T0)

    expect(antes.login?.attempts).toBe(2)
    expect(depois.login?.attempts).toBe(3)
  })
})

describe('assertThrottle', () => {
  it('explode com mensagem de usuário quando está travado', () => {
    expect(() => assertThrottle(afterFailures(FREE_ATTEMPTS + 1), 'login', T0)).toThrow(DomainError)
  })

  it('não faz nada quando está liberado', () => {
    expect(() => assertThrottle({}, 'login', T0)).not.toThrow()
  })
})
