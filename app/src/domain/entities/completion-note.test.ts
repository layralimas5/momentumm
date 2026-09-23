import { describe, expect, it } from 'vitest'
import { completionNote } from './completion-note'

describe('completionNote', () => {
  it('fecha o dia quando tudo saiu', () => {
    const note = completionNote({ done: 3, total: 3, openMinutes: null, dayComplete: true })

    expect(note.title).toBe('Dia cumprido.')
    expect(note.closing).toBe(true)
  })

  it('diz quantas faltam e quanto tempo elas somam', () => {
    const note = completionNote({ done: 1, total: 3, openMinutes: 35, dayComplete: false })

    expect(note.title).toBe('Feito.')
    expect(note.detail).toContain('Faltam 2')
    expect(note.detail).toContain('35')
  })

  it('no singular a frase concorda', () => {
    const note = completionNote({ done: 2, total: 3, openMinutes: null, dayComplete: false })

    expect(note.detail).toBe('Falta uma pra fechar o dia.')
  })

  it('sem estimativa não inventa tempo', () => {
    const note = completionNote({ done: 1, total: 4, openMinutes: 0, dayComplete: false })

    expect(note.detail).not.toContain('Cerca de')
  })
})
