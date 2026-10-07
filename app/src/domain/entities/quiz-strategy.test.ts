import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import { buildQuizPlan, quizAreaContext, type CompleteQuizAnswers } from './quiz'
import {
  buildBehaviorProfile,
  buildQuizStrategy,
  INTERVENTIONS,
  selectInterventions,
  STRATEGY_SIZE,
  type QuizStrategy,
} from './quiz-strategy'

// Segunda-feira.
const today = parseDayKey('2026-09-21')

const base: CompleteQuizAnswers = {
  goal: 'Voltar a treinar',
  areas: ['saude'],
  customArea: '',
  obstacles: ['rotina_muda'],
  time: '20',
  horizon: '90',
  weekdays: [1, 3, 5],
  style: 'passos_pequenos',
  history: 'mantive_e_parei',
}

function strategyOf(answers: CompleteQuizAnswers): QuizStrategy {
  return buildQuizStrategy({
    answers,
    preview: buildQuizPlan({ answers, today, existingAxes: [] }),
    area: quizAreaContext(answers),
    today,
  })
}

describe('quiz-strategy: perfil', () => {
  it('cada ponto do perfil sai de uma resposta guardada como evidência', () => {
    const profile = buildBehaviorProfile(base)
    expect(profile.recoveryDifficulty).toBeGreaterThanOrEqual(3)
    expect(profile.evidence.map((item) => item.answer)).toEqual([
      'Minha rotina muda muito',
      'Mantive por um tempo e parei',
    ])
  })

  it('a dificuldade marcada primeiro pesa mais que a mesma marcada depois', () => {
    const first = buildBehaviorProfile({ ...base, obstacles: ['procrastino', 'rotina_muda'] })
    const second = buildBehaviorProfile({ ...base, obstacles: ['rotina_muda', 'procrastino'] })
    expect(first.startingDifficulty).toBeGreaterThan(second.startingDifficulty)
  })
})

describe('quiz-strategy: padrão e indicadores', () => {
  it('quem muda de rotina e já parou depois de manter tem a retomada como desafio', () => {
    const strategy = strategyOf(base)
    expect(strategy.pattern.dimension).toBe('recoveryDifficulty')
    expect(strategy.pattern.evidence).toContain('Minha rotina muda muito')

    const retomar = strategy.indicators.find((item) => item.label === 'Retomar')
    expect(retomar?.tag).toBe('principal_desafio')
    expect(retomar?.level).toBe('dificil')
  })

  it('só existe um principal desafio, e indicador sem sinal diz que não houve sinal', () => {
    const strategy = strategyOf(base)
    expect(strategy.indicators.filter((item) => item.tag === 'principal_desafio')).toHaveLength(1)
    const comecar = strategy.indicators.find((item) => item.label === 'Começar')
    expect(comecar?.level).toBe('facil')
    expect(comecar?.reason).toContain('Nenhuma resposta')
  })

  it('quem procrastina trava no começo', () => {
    const strategy = strategyOf({ ...base, obstacles: ['procrastino'], history: 'primeira' })
    expect(strategy.pattern.dimension).toBe('startingDifficulty')
  })

  it('nenhum texto da tela traz porcentagem', () => {
    for (const obstacle of ['procrastino', 'abandono', 'pouco_tempo', 'sem_comeco', 'rotina_muda', 'tudo_ao_mesmo_tempo', 'motivacao'] as const) {
      const text = JSON.stringify(strategyOf({ ...base, obstacles: [obstacle] }))
      expect(text).not.toMatch(/\d\s?%/)
    }
  })
})

describe('quiz-strategy: motor de intervenções', () => {
  it('sempre devolve três, sem repetir', () => {
    for (const obstacle of ['procrastino', 'abandono', 'pouco_tempo', 'sem_comeco', 'rotina_muda', 'tudo_ao_mesmo_tempo', 'motivacao'] as const) {
      const keys = selectInterventions(buildBehaviorProfile({ ...base, obstacles: [obstacle] }), { ...base, obstacles: [obstacle] })
      expect(keys).toHaveLength(STRATEGY_SIZE)
      expect(new Set(keys).size).toBe(STRATEGY_SIZE)
      for (const key of keys) expect(INTERVENTIONS).toContain(key)
    }
  })

  it('retomada difícil escolhe plano de retomada e passo mínimo', () => {
    const keys = strategyOf(base).interventions.map((item) => item.key)
    expect(keys.slice(0, 2)).toEqual(['recovery_plan', 'minimum_action'])
  })

  it('quem quer tudo ao mesmo tempo recebe uma prioridade por dia', () => {
    const keys = strategyOf({ ...base, obstacles: ['tudo_ao_mesmo_tempo'], history: 'primeira' }).interventions.map((item) => item.key)
    expect(keys).toContain('daily_priority')
  })

  it('quem não sabe por onde começar recebe a meta em degraus, com os marcos do plano', () => {
    const strategy = strategyOf({ ...base, obstacles: ['sem_comeco'], history: 'primeira' })
    const graded = strategy.interventions.find((item) => item.key === 'graded_task')
    expect(graded?.detail.kind).toBe('steps')
    if (graded?.detail.kind === 'steps') expect(graded.detail.steps).toHaveLength(3)
  })

  it('o porquê cita a resposta que puxou a intervenção', () => {
    const recovery = strategyOf(base).interventions.find((item) => item.key === 'recovery_plan')
    expect(recovery?.reason).toContain('“Minha rotina muda muito”')
  })

  it('a retomada usa os dias reais do plano, sem inventar horário', () => {
    // Hoje é segunda e o plano é seg, qua e sex.
    const strategy = strategyOf(base)
    const rule = strategy.ifThenRules[0]
    expect(rule?.when).toBe('eu perder o passo de hoje')
    expect(rule?.then.startsWith('na quarta')).toBe(true)
    expect(rule?.then).not.toMatch(/\d+h/)
  })
})
