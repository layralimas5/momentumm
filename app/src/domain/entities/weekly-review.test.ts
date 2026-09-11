import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import {
  applyDraft,
  BASIC_REVIEW_STEP_META,
  BASIC_REVIEW_STEPS,
  basicReviewProgress,
  emptyReview,
  isComplete,
  MAX_REVIEW_ANSWER,
  REVIEW_STEPS,
  reviewProgress,
  reviewWeekStart,
  weekLabel,
} from './weekly-review'

const WEEK = parseDayKey('2026-08-31')

function review() {
  return emptyReview('user-1', WEEK, 'review-1', new Date('2026-09-07T10:00:00'))
}

describe('applyDraft', () => {
  it('preenche só o que veio no rascunho', () => {
    const next = applyDraft(review(), { achievements: 'Voltei a treinar.' })

    expect(next.achievements).toBe('Voltei a treinar.')
    expect(next.difficulties).toBeNull()
  })

  it('campo ausente não apaga o que já estava salvo', () => {
    const first = applyDraft(review(), { achievements: 'Li 3 capítulos.' })
    const second = applyDraft(first, { difficulties: 'Reuniões demais.' })

    expect(second.achievements).toBe('Li 3 capítulos.')
    expect(second.difficulties).toBe('Reuniões demais.')
  })

  it('null apaga de propósito', () => {
    const first = applyDraft(review(), { achievements: 'Algo' })
    expect(applyDraft(first, { achievements: null }).achievements).toBeNull()
  })

  it('texto em branco vira null em vez de string vazia', () => {
    expect(applyDraft(review(), { achievements: '   ' }).achievements).toBeNull()
  })

  it('recusa resposta acima do limite', () => {
    expect(() =>
      applyDraft(review(), { achievements: 'x'.repeat(MAX_REVIEW_ANSWER + 1) }),
    ).toThrow()
  })

  it('guarda no máximo três prioridades', () => {
    const next = applyDraft(review(), { priorities: ['a', 'b', 'c', 'd'] })
    expect(next.priorities).toEqual(['a', 'b', 'c'])
  })

  it('descarta prioridade vazia', () => {
    const next = applyDraft(review(), { priorities: ['a', '  ', 'b'] })
    expect(next.priorities).toEqual(['a', 'b'])
  })

  it('avança a data de atualização', () => {
    const before = review()
    const after = applyDraft(before, { lastStep: 'ajustes' }, new Date('2026-09-08T10:00:00'))
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
  })
})

describe('reviewProgress', () => {
  it('conta zero no review vazio', () => {
    expect(reviewProgress(review())).toBe(0)
  })

  it('conta cada resposta preenchida', () => {
    const next = applyDraft(review(), {
      achievements: 'a',
      difficulties: 'b',
      priorities: ['x'],
    })
    expect(reviewProgress(next)).toBeCloseTo(0.6)
  })
})

describe('isComplete', () => {
  it('só é completo com data de conclusão', () => {
    expect(isComplete(review())).toBe(false)
    expect(isComplete(applyDraft(review(), { completedAt: new Date() }))).toBe(true)
  })
})

describe('reviewWeekStart', () => {
  it('aponta pra semana anterior, não a corrente', () => {
    // 2026-09-09 é uma quarta; a semana corrente começa em 07/09.
    expect(reviewWeekStart(parseDayKey('2026-09-09'))).toBe('2026-08-31')
  })

  it('na segunda revisa a semana que acabou de fechar', () => {
    expect(reviewWeekStart(parseDayKey('2026-09-07'))).toBe('2026-08-31')
  })
})

describe('weekLabel', () => {
  it('mostra o intervalo de sete dias', () => {
    expect(weekLabel(WEEK)).toContain('31')
  })
})

describe('check-in básico', () => {
  it('usa só passos que a pessoa escreve, todos existentes no review completo', () => {
    expect(BASIC_REVIEW_STEP_META.map((meta) => meta.key)).toEqual([...BASIC_REVIEW_STEPS])
    for (const meta of BASIC_REVIEW_STEP_META) {
      expect(REVIEW_STEPS).toContain(meta.key)
      expect(meta.readOnly).toBe(false)
    }
  })

  it('faz as quatro perguntas do gratuito', () => {
    expect(BASIC_REVIEW_STEP_META.map((meta) => meta.question)).toEqual([
      'Como foi sua semana?',
      'O que funcionou?',
      'O que dificultou sua constância?',
      'Qual será seu foco na próxima semana?',
    ])
  })

  it('mede o progresso só sobre as quatro respostas', () => {
    const half = applyDraft(review(), { learnings: 'Corrida.', achievements: 'Estudar cedo.' })
    expect(basicReviewProgress(half)).toBe(0.5)

    const full = applyDraft(half, { difficulties: 'Reuniões.', priorities: ['Capítulo 5'] })
    expect(basicReviewProgress(full)).toBe(1)
    // O review completo ainda cobra os ajustes: o básico não.
    expect(reviewProgress(full)).toBeLessThan(1)
  })
})
