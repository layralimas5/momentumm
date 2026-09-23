import { describe, expect, it } from 'vitest'
import { parseDayKey } from './day'
import {
  buildDiagnosis,
  buildQuizPlan,
  EMPTY_QUIZ_ANSWERS,
  horizonOf,
  isQuizComplete,
  quizBlocker,
  quizIntro,
  suggestHabit,
  toActivationAnswers,
  type CompleteQuizAnswers,
} from './quiz'

const today = parseDayKey('2026-09-21')

const answers: CompleteQuizAnswers = {
  goal: 'Lançar meu projeto',
  areas: ['projeto'],
  customArea: '',
  obstacles: ['pouco_tempo'],
  time: '20',
  horizon: '90',
  weekdays: [1, 3, 5],
  style: 'momentumm_decide',
}

describe('quiz: validação', () => {
  it('cada pergunta bloqueia enquanto não é respondida', () => {
    expect(quizBlocker(0, EMPTY_QUIZ_ANSWERS)).not.toBeNull()
    expect(quizBlocker(0, { ...EMPTY_QUIZ_ANSWERS, goal: 'ab' })).not.toBeNull()
    expect(quizBlocker(0, { ...EMPTY_QUIZ_ANSWERS, goal: 'Correr' })).toBeNull()
    expect(quizBlocker(5, { ...EMPTY_QUIZ_ANSWERS, weekdays: [] })).not.toBeNull()
    expect(quizBlocker(5, { ...EMPTY_QUIZ_ANSWERS, weekdays: [2] })).toBeNull()
  })

  it('completo só com as sete respondidas', () => {
    expect(isQuizComplete(EMPTY_QUIZ_ANSWERS)).toBe(false)
    expect(isQuizComplete(answers)).toBe(true)
    expect(isQuizComplete({ ...answers, style: null })).toBe(false)
  })
})

describe('quiz: diagnóstico', () => {
  it('lê as respostas de verdade, não um texto genérico', () => {
    const diagnosis = buildDiagnosis(answers)
    expect(diagnosis.profile).toBe('Ambição alta, rotina apertada')
    expect(diagnosis.explanation).toContain('20 minutos')
    expect(diagnosis.explanation).toContain('3 dias')
    expect(diagnosis.explanation).toContain('lançar meu projeto')
    expect(diagnosis.obstacle).toBe('Tenho pouco tempo')
  })

  it('"o Momentumm decide" resolve pro estilo recomendado pelo obstáculo', () => {
    expect(buildDiagnosis(answers).style).toBe('passos_pequenos')
    expect(buildDiagnosis({ ...answers, obstacles: ['sem_comeco'] }).style).toBe('rotina_definida')
    expect(buildDiagnosis({ ...answers, style: 'liberdade' }).style).toBe('liberdade')
  })

  it('o perfil muda com o tempo disponível', () => {
    expect(buildDiagnosis({ ...answers, time: '60' }).profile).toBe('Ambição alta, agenda cheia')
    expect(buildDiagnosis({ ...answers, time: 'depende' }).time).toContain('20 minutos')
  })
})

describe('quiz: ponte pro gerador', () => {
  it('vira as mesmas respostas do onboarding', () => {
    const activation = toActivationAnswers(answers, today)
    expect(activation.area).toBe('projeto')
    expect(activation.budget).toEqual({ mode: 'dia', minutes: 20, weekdays: [1, 3, 5] })
    expect(activation.horizon).toEqual({ kind: 'preset', days: 90 })
  })

  it('relacionamentos e "outra" viram área custom', () => {
    expect(toActivationAnswers({ ...answers, areas: ['relacionamentos'] }, today)).toMatchObject({
      area: 'outro',
      customArea: 'Relacionamentos',
    })
    expect(
      toActivationAnswers({ ...answers, areas: ['outra'], customArea: 'Música' }, today),
    ).toMatchObject({ area: 'outro', customArea: 'Música' })
  })

  it('"até o final do ano" é uma data, e no fim de dezembro pula pro ano seguinte', () => {
    expect(horizonOf('fim_do_ano', today)).toEqual({ kind: 'data', date: '2026-12-31' })
    expect(horizonOf('fim_do_ano', parseDayKey('2026-12-28'))).toEqual({
      kind: 'data',
      date: '2027-12-31',
    })
    expect(horizonOf('nao_sei', today)).toEqual({ kind: 'flexivel' })
  })

  it('a prévia tem objetivo, três marcos, primeiro passo hoje e hábito nos dias marcados', () => {
    const preview = buildQuizPlan({ answers, today, existingAxes: [] })
    expect(preview.plan.ready).toBe(true)
    expect(preview.plan.objectiveTitle).toBe('Lançar meu projeto')
    expect(preview.plan.milestones).toHaveLength(3)
    expect(preview.plan.firstStep?.day).toBe(today)
    expect(preview.plan.firstStep?.isMainPriority).toBe(true)
    expect(preview.habit.weekdays).toEqual([1, 3, 5])
    expect(preview.habit.minimalTarget).toBe(5)
    expect(preview.routine).toContain('3 dias por semana')
  })

  it('nunca devolve plano impossível: ajusta sozinho e diz o que mudou', () => {
    const ambitious: CompleteQuizAnswers = {
      ...answers,
      goal: 'Estudar 40 horas',
      areas: ['estudos'],
      time: '10',
      horizon: '30',
      weekdays: [6],
    }
    const preview = buildQuizPlan({ answers: ambitious, today, existingAxes: [] })
    expect(preview.plan.ready).toBe(true)
    expect(preview.adjustmentNote).not.toBeNull()
  })

  it('várias áreas: a primeira vira o plano, as outras viram eixo', () => {
    const activation = toActivationAnswers({ ...answers, areas: ['saude', 'carreira', 'outra'] }, today)
    expect(activation.area).toBe('saude')
    expect(activation.extraAreas).toEqual(['carreira'])
  })

  it('várias dificuldades: a primeira dá o perfil, todas aparecem no diagnóstico', () => {
    const diagnosis = buildDiagnosis({ ...answers, obstacles: ['abandono', 'motivacao'] })
    expect(diagnosis.profile).toBe('Começa forte, perde o fio')
    expect(diagnosis.obstacle).toBe('Começo e abandono · Perco a motivação rapidamente')
    expect(diagnosis.obstacleCount).toBe(2)
  })

  it('o hábito respeita o tempo declarado', () => {
    expect(suggestHabit(answers, 20, 'Saúde').target).toBe(20)
    expect(suggestHabit(answers, 90, 'Saúde').target).toBe(30)
  })

  it('o hábito se chama pela área, não repete o objetivo', () => {
    const habit = suggestHabit(answers, 30, 'Saúde')
    expect(habit.name).toBe('Saúde: um passo de 30 min')
    expect(habit.name).not.toContain(answers.goal)
  })

  it('o tema muda só a introdução', () => {
    expect(quizIntro(null).title).toBe('Transforme sua meta em um plano possível.')
    expect(quizIntro('procrastinacao').title).not.toBe(quizIntro(null).title)
  })
})
