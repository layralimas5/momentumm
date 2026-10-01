import { describe, expect, it } from 'vitest'
import { readRoutinePrefill, routinePrefillPath } from './routine-prefill'

describe('routine prefill', () => {
  it('a etapa vira um link que a Rotina lê de volta', () => {
    const path = routinePrefillPath({ objectiveId: 'obj-1', title: 'Treinar & correr' })
    const params = new URLSearchParams(path.split('?')[1])
    expect(params.get('novo')).toBe('1')
    expect(readRoutinePrefill(params)).toEqual({ objectiveId: 'obj-1', title: 'Treinar & correr' })
  })

  it('sem objetivo, não é um item vindo do plano', () => {
    expect(readRoutinePrefill(new URLSearchParams('novo=1&titulo=X'))).toBeNull()
  })

  it('corta título longo demais', () => {
    expect(readRoutinePrefill(new URLSearchParams({ objetivo: 'o', titulo: 'a'.repeat(200) }))?.title).toHaveLength(80)
  })
})
