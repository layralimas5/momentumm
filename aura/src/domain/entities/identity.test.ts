import { describe, expect, it } from 'vitest'
import { IDENTITY_QUESTIONS, IdentityRules, identityReminder } from './identity'

const FULL = {
  becoming: 'uma mulher que confia em si.',
  morning: 'cedo, sem pressa',
  dressing: 'com intenção',
  daily: 'cuida do corpo e da mente!',
  neverAgain: 'se abandonar…',
}

describe('IdentityRules.emptyAnswers', () => {
  it('devolve uma resposta vazia para cada pergunta', () => {
    const empty = IdentityRules.emptyAnswers()
    for (const q of IDENTITY_QUESTIONS) {
      expect(empty[q.key]).toBe('')
    }
  })
})

describe('IdentityRules.isComplete', () => {
  it('reconhece o conjunto completo', () => {
    expect(IdentityRules.isComplete(FULL)).toBe(true)
  })

  it('rejeita o conjunto vazio', () => {
    expect(IdentityRules.isComplete(IdentityRules.emptyAnswers())).toBe(false)
  })

  it('rejeita quando falta qualquer uma das respostas', () => {
    for (const q of IDENTITY_QUESTIONS) {
      expect(IdentityRules.isComplete({ ...FULL, [q.key]: '' })).toBe(false)
    }
  })

  it('não aceita resposta só de espaço em branco', () => {
    expect(IdentityRules.isComplete({ ...FULL, daily: '    ' })).toBe(false)
  })

  it('lida com chaves ausentes, não só vazias', () => {
    const { daily: _omitted, ...partial } = FULL
    expect(IdentityRules.isComplete(partial)).toBe(false)
  })
})

describe('IdentityRules.trim', () => {
  it('remove espaços das bordas de todas as respostas', () => {
    const messy = {
      becoming: '  a  ',
      morning: '\tb\n',
      dressing: ' c ',
      daily: '  d',
      neverAgain: 'e  ',
    }
    expect(IdentityRules.trim(messy)).toEqual({
      becoming: 'a',
      morning: 'b',
      dressing: 'c',
      daily: 'd',
      neverAgain: 'e',
    })
  })
})

describe('identityReminder', () => {
  it('é determinístico — o mesmo dia gera a mesma frase', () => {
    const day = new Date(2026, 6, 22)
    expect(identityReminder(FULL, day)).toBe(identityReminder(FULL, day))
  })

  it('cita a resposta da usuária sem a pontuação final', () => {
    // Dia 1 → template de `becoming` ("uma mulher que confia em si.").
    const reminder = identityReminder(FULL, new Date(2026, 6, 1))
    expect(reminder).toBe('Você decidiu se tornar uma mulher que confia em si. Continue.')
  })

  it('remove reticências do fim da citação', () => {
    // Dia 2 → template de `neverAgain` ("se abandonar…").
    const reminder = identityReminder(FULL, new Date(2026, 6, 2))
    expect(reminder).toBe('Ela não volta pra se abandonar.')
  })

  it('remove exclamação do fim da citação', () => {
    // Dia 4 → template de `daily` ("cuida do corpo e da mente!").
    const reminder = identityReminder(FULL, new Date(2026, 6, 4))
    expect(reminder).toBe(
      'A mulher que você quer ser já estaria vivendo isto hoje: cuida do corpo e da mente.',
    )
  })

  it('varia ao longo dos dias em vez de repetir sempre a mesma', () => {
    const frases = new Set(
      Array.from({ length: 8 }, (_, i) => identityReminder(FULL, new Date(2026, 6, i + 1))),
    )
    expect(frases.size).toBeGreaterThan(1)
  })

  it('sempre devolve uma frase, para qualquer dia do mês', () => {
    for (let day = 1; day <= 31; day += 1) {
      expect(identityReminder(FULL, new Date(2026, 0, day))).toBeTruthy()
    }
  })
})
