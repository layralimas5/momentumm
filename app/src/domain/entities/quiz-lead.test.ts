import { describe, expect, it } from 'vitest'
import {
  EMPTY_QUIZ_LEAD,
  formatPhone,
  isLeadReady,
  leadErrors,
  normalizeLead,
  onlyDigits,
} from './quiz-lead'

const valido = { name: 'Lay', email: 'lay@momentumm.com.br', phone: '(11) 91234-5678', age: '29' }

describe('contato do quiz', () => {
  it('o formulário vazio não passa', () => {
    const errors = leadErrors(EMPTY_QUIZ_LEAD)
    expect(errors.name).toBeDefined()
    expect(errors.email).toBeDefined()
    // Telefone e idade em branco são válidos: são opcionais.
    expect(errors.phone).toBeUndefined()
    expect(errors.age).toBeUndefined()
  })

  it('nome e e-mail bastam', () => {
    expect(isLeadReady({ ...EMPTY_QUIZ_LEAD, name: 'Lay', email: 'lay@teste.com' })).toBe(true)
  })

  it('e-mail sem forma de e-mail não passa', () => {
    for (const email of ['lay', 'lay@', 'lay@teste', '@teste.com', 'lay teste@x.com']) {
      expect(leadErrors({ ...valido, email }).email).toBeDefined()
    }
  })

  it('telefone só reclama quando foi escrito pela metade', () => {
    expect(leadErrors({ ...valido, phone: '' }).phone).toBeUndefined()
    expect(leadErrors({ ...valido, phone: '(11) 9123' }).phone).toBeDefined()
    expect(leadErrors({ ...valido, phone: '(11) 1234-5678' }).phone).toBeUndefined()
  })

  it('idade fora da faixa não passa', () => {
    expect(leadErrors({ ...valido, age: '12' }).age).toBeDefined()
    expect(leadErrors({ ...valido, age: '121' }).age).toBeDefined()
    expect(leadErrors({ ...valido, age: '' }).age).toBeUndefined()
  })

  it('o telefone é formatado enquanto se digita', () => {
    expect(formatPhone('11')).toBe('11')
    expect(formatPhone('1191')).toBe('(11) 91')
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678')
    expect(formatPhone('1112345678')).toBe('(11) 1234-5678')
    // Não deixa passar do 11º dígito.
    expect(onlyDigits(formatPhone('119123456789999'))).toHaveLength(11)
  })

  it('normaliza pra o formato que o banco guarda', () => {
    expect(normalizeLead({ name: '  Lay  ', email: '  LAY@Teste.COM ', phone: '(11) 91234-5678', age: '29' }))
      .toEqual({ name: 'Lay', email: 'lay@teste.com', phone: '11912345678', age: 29 })
  })

  it('telefone e idade em branco viram nulo, não string vazia', () => {
    expect(normalizeLead({ name: 'Lay', email: 'lay@teste.com', phone: '', age: '' })).toEqual({
      name: 'Lay',
      email: 'lay@teste.com',
      phone: null,
      age: null,
    })
  })
})
