import { describe, expect, it } from 'vitest'
import {
  EMPTY_QUIZ_LEAD,
  formatPhone,
  isLeadReady,
  leadErrors,
  normalizeLead,
  onlyDigits,
} from './quiz-lead'

const valido = { name: 'Lay', email: 'lay@momentumm.com.br', phone: '(11) 91234-5678' }

describe('contato do quiz', () => {
  it('o formulário vazio não passa', () => {
    const errors = leadErrors(EMPTY_QUIZ_LEAD)
    expect(errors.name).toBeDefined()
    expect(errors.email).toBeDefined()
    // Telefone em branco é válido: é opcional.
    expect(errors.phone).toBeUndefined()
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

  it('o telefone é formatado enquanto se digita', () => {
    expect(formatPhone('11')).toBe('11')
    expect(formatPhone('1191')).toBe('(11) 91')
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678')
    expect(formatPhone('1112345678')).toBe('(11) 1234-5678')
    // Não deixa passar do 11º dígito.
    expect(onlyDigits(formatPhone('119123456789999'))).toHaveLength(11)
  })

  it('normaliza pra o formato que o banco guarda', () => {
    expect(normalizeLead({ name: '  Lay  ', email: '  LAY@Teste.COM ', phone: '(11) 91234-5678' })).toEqual({
      name: 'Lay',
      email: 'lay@teste.com',
      phone: '11912345678',
    })
  })

  it('telefone em branco vira nulo, não string vazia', () => {
    expect(normalizeLead({ name: 'Lay', email: 'lay@teste.com', phone: '' })).toEqual({
      name: 'Lay',
      email: 'lay@teste.com',
      phone: null,
    })
  })
})
