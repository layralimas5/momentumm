import { describe, expect, it } from 'vitest'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import { withAxisAdded, type ObjectiveEntry } from './use-journey-draft'

/**
 * Escolher a área no rascunho.
 *
 * O teste nasce de um bug real e visível: no diálogo de "Novo objetivo" a área
 * ficava presa em "Leitura" e clicar em qualquer outro cartão não fazia nada. O
 * diálogo usa `max: 1`, e a guarda de tamanho rodava ANTES da troca — com uma
 * entrada já no rascunho, `current.length >= max` era verdade em todo clique.
 *
 * Trocar de área não aumenta o rascunho, então não pode passar por guarda de
 * tamanho. É essa a ordem que este teste trava.
 */

function entry(axis: ActivityTypeSlug): ObjectiveEntry {
  return { axis, title: '', motive: '', days: 60, target: '' }
}

describe('escolher a área do rascunho', () => {
  it('com limite 1, escolher outra área TROCA em vez de não fazer nada', () => {
    const depois = withAxisAdded([entry('leitura')], 'estudo', 1)
    expect(depois.map((item) => item.axis)).toEqual(['estudo'])
  })

  it('a troca reseta os campos: é outro objetivo, não o mesmo com outra etiqueta', () => {
    const preenchido: ObjectiveEntry = {
      axis: 'leitura',
      title: 'Ler 6 livros',
      motive: 'porque sim',
      days: 90,
      target: '600',
    }
    expect(withAxisAdded([preenchido], 'treino', 1)).toEqual([entry('treino')])
  })

  it('escolher a área que já está no rascunho não muda nada', () => {
    const atual = [entry('leitura')]
    expect(withAxisAdded(atual, 'leitura', 1)).toBe(atual)
  })

  it('com limite maior que 1, escolher empilha', () => {
    const depois = withAxisAdded([entry('leitura')], 'estudo', 3)
    expect(depois.map((item) => item.axis)).toEqual(['leitura', 'estudo'])
  })

  it('com limite maior que 1, o rascunho cheio para de aceitar', () => {
    const cheio = [entry('leitura'), entry('estudo')]
    expect(withAxisAdded(cheio, 'treino', 2)).toBe(cheio)
  })

  it('rascunho vazio recebe a primeira área, em qualquer limite', () => {
    expect(withAxisAdded([], 'meditacao', 1).map((item) => item.axis)).toEqual(['meditacao'])
    expect(withAxisAdded([], 'meditacao', 3).map((item) => item.axis)).toEqual(['meditacao'])
  })
})
