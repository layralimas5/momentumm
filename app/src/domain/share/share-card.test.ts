import { describe, expect, it } from 'vitest'
import { dayKeyOf } from '@/domain/entities/day'
import { createJourneyEvent, type NewJourneyEventInput } from '@/domain/entities/journey-event'
import { toShareCardData } from './share-card-adapter'
import {
  availableFieldsFor,
  availableFieldsForEvent,
  defaultFieldsFor,
  sanitizeFields,
  supportsField,
  SHARE_FIELDS,
  type ShareFieldSet,
} from './share-card'

const today = dayKeyOf(new Date(2026, 8, 7))

function event(input: Partial<NewJourneyEventInput> & Pick<NewJourneyEventInput, 'type'>) {
  return createJourneyEvent(
    {
      userId: 'user-1',
      sourceType: 'day',
      title: 'Hoje',
      ...input,
    },
    'evento',
  )
}

function card(
  input: Partial<NewJourneyEventInput> & Pick<NewJourneyEventInput, 'type'>,
  fields?: Partial<ShareFieldSet>,
) {
  const source = event(input)
  return toShareCardData(source, {
    fields: { ...defaultFieldsFor(source.type), ...fields },
    displayName: 'Lay',
    today,
  })
}

describe('privacidade por padrão', () => {
  /*
    A regra mudou de "menos coisa na tela" para "tudo que é NÚMERO aparece, o
    que é TEXTO ESCRITO pela pessoa não". O card conta o que ela fez; quem ela
    é e como ela chamou aquilo continua sendo escolha dela.
  */
  it('começa sem nome do objetivo, sem área criada por ela e sem o nome dela', () => {
    const fields = defaultFieldsFor('goal_progress')
    expect(fields.objective).toBe(false)
    expect(fields.axis).toBe(false)
    expect(fields.username).toBe(false)
    expect(fields.note).toBe(false)
  })

  it('começa mostrando o que foi feito: lista, contagens e métricas', () => {
    const fields = defaultFieldsFor('day_completed')
    expect(fields.items).toBe(true)
    expect(fields.counts).toBe(true)
    expect(fields.streak).toBe(true)
    expect(fields.activeDays).toBe(true)
  })

  it('começa com número e percentual ligados: é o motivo do card existir', () => {
    const fields = defaultFieldsFor('day_completed')
    expect(fields.momentum).toBe(true)
    expect(fields.completion).toBe(true)
  })

  it('nunca liga campo que o tipo não suporta', () => {
    expect(supportsField('goal_progress', 'duration')).toBe(false)
    expect(defaultFieldsFor('goal_progress').duration).toBe(false)
  })

  it('sanitiza um conjunto que chegou com campo indevido ligado', () => {
    const everything = Object.fromEntries(
      SHARE_FIELDS.map((field) => [field, true]),
    ) as ShareFieldSet

    const clean = sanitizeFields('momentum_record', everything)
    expect(clean.items).toBe(false)
    expect(clean.momentum).toBe(true)
  })

  it('esconde o título escrito pela pessoa enquanto o campo estiver desligado', () => {
    const hidden = card({ type: 'goal_progress', title: 'Sair da terapia', progressAfter: 0.5 })
    expect(hidden.title).not.toContain('terapia')

    const shown = card(
      { type: 'goal_progress', title: 'Sair da terapia', progressAfter: 0.5 },
      { objective: true },
    )
    expect(shown.title).toBe('Sair da terapia')
  })

  it('não expõe título do app atrás do toggle de objetivo', () => {
    expect(card({ type: 'weekly_review', title: 'Minha semana' }).title).toBe('Minha semana')
  })

  it('só mostra o nome da pessoa quando ela liga', () => {
    expect(card({ type: 'day_completed' }).username).toBeNull()
    expect(card({ type: 'day_completed' }, { username: true }).username).toBe('Lay')
  })

  it('desligar o momentum apaga os dois lados e a variação', () => {
    const data = card(
      { type: 'day_completed', momentumBefore: 76, momentumAfter: 81 },
      { momentum: false },
    )
    expect(data.momentumBefore).toBeNull()
    expect(data.momentumAfter).toBeNull()
    expect(data.momentumChange).toBeNull()
  })
})

describe('a métrica dominante', () => {
  it('no dia é o percentual concluído', () => {
    const data = card({ type: 'day_completed', completionPercentage: 0.87 })
    expect(data.primaryMetric.value).toBe('87%')
  })

  it('na rotina é a fração de hábitos', () => {
    const data = card({
      type: 'routine_completed',
      sourceType: 'routine',
      title: 'Rotina da manhã',
      metadata: {
        items: [
          { label: 'Treino', done: true },
          { label: 'Leitura', done: true },
        ],
      },
    })
    expect(data.primaryMetric.value).toBe('2/2')
  })

  it('no momentum é o próprio score, com o antes preservado', () => {
    const data = card({ type: 'momentum_record', momentumBefore: 78, momentumAfter: 84 })
    expect(data.primaryMetric.value).toBe('84')
    expect(data.secondaryMetric?.value).toBe('+6')
  })

  it('cai no momentum quando o percentual foi desligado', () => {
    const data = card(
      { type: 'day_completed', completionPercentage: 0.87, momentumAfter: 81 },
      { completion: false },
    )
    expect(data.primaryMetric.value).toBe('81')
  })

  it('fica vazia quando a pessoa desligou tudo que era número', () => {
    const data = card(
      { type: 'day_completed', completionPercentage: 0.87, momentumAfter: 81 },
      { completion: false, momentum: false, duration: false },
    )
    expect(data.primaryMetric.value).toBe('')
  })
})

describe('tom das mensagens', () => {
  it('a retomada conta os dias parados sem cobrar', () => {
    const data = card(
      {
        type: 'comeback',
        sourceType: 'streak',
        title: 'Voltei hoje',
        metadata: { daysAway: 4 },
      },
      { note: true },
    )
    expect(data.kicker).toBe('De volta ao ritmo')
    expect(data.subtitle).toContain('4 dias')
    expect(data.note).toBe('Continue de onde parou.')
  })

  it('nunca escreve elogio genérico', () => {
    for (const type of ['day_completed', 'goal_completed', 'weekly_review'] as const) {
      const data = card({ type }, { note: true })
      expect(data.note?.toLowerCase()).not.toContain('parabéns')
    }
  })

  it('a frase do app fica de fora até a pessoa pedir', () => {
    expect(defaultFieldsFor('day_completed').note).toBe(false)
    expect(card({ type: 'day_completed' }).note).toBeNull()
  })
})

describe('campos disponíveis por tipo', () => {
  it('não oferece duração em progresso de objetivo', () => {
    expect(availableFieldsFor('goal_progress')).not.toContain('duration')
  })

  it('oferece lista onde existe lista', () => {
    expect(availableFieldsFor('routine_completed')).toContain('items')
  })
})

describe('o card do desafio', () => {
  const meta = {
    axis: 'treino',
    challengeDoneDays: 14,
    challengeRequiredDays: 20,
    challengePeople: 3,
  } as const

  it('mostra DIAS, e não o percentual: é o número que as pessoas combinaram', () => {
    const data = card({
      type: 'challenge_progress',
      sourceType: 'challenge',
      title: 'Treinar 20 dias no mês',
      completionPercentage: 0.7,
      metadata: meta,
    })

    expect(data.primaryMetric.value).toBe('14/20')
    expect(data.primaryMetric.label).toBe('dias')
  })

  it('cai no percentual quando a fração não veio', () => {
    const data = card({
      type: 'challenge_completed',
      sourceType: 'challenge',
      title: 'Treinar 20 dias no mês',
      completionPercentage: 1,
      metadata: { axis: 'treino' },
    })

    expect(data.primaryMetric.value).toBe('100%')
    expect(data.primaryMetric.label).toBe('do desafio')
  })

  it('esconde o nome do desafio enquanto o campo estiver desligado', () => {
    const escondido = card({
      type: 'challenge_progress',
      sourceType: 'challenge',
      title: 'Parar de fumar em 30 dias',
      metadata: meta,
    })
    const mostrado = card(
      {
        type: 'challenge_progress',
        sourceType: 'challenge',
        title: 'Parar de fumar em 30 dias',
        metadata: meta,
      },
      { objective: true },
    )

    // Sem placeholder: um "Desafio oculto" denunciaria que havia algo escondido.
    expect(escondido.title).toBe('Um desafio em andamento')
    expect(mostrado.title).toBe('Parar de fumar em 30 dias')
  })

  it('diz quantas pessoas estão dentro, nunca quem são', () => {
    const data = card({
      type: 'challenge_progress',
      sourceType: 'challenge',
      title: 'Treinar 20 dias no mês',
      metadata: meta,
    })

    expect(data.secondaryMetric?.value).toBe('3 pessoas no desafio')
  })

  it('não anuncia o que falta ao entrar num desafio', () => {
    const data = card({
      type: 'challenge_joined',
      sourceType: 'challenge',
      title: 'Treinar 20 dias no mês',
      metadata: { axis: 'treino', challengeRequiredDays: 20, challengePeople: 2 },
    })

    expect(data.primaryMetric.value).toBe('Topei')
    expect(data.primaryMetric.value).not.toContain('0')
  })
})


// ---------------------------------------------------------------------------
// a linha de apoio
// ---------------------------------------------------------------------------

describe('informações da linha de apoio', () => {
  it('mostra a sequência por padrão, com o plural certo', () => {
    const one = card({ type: 'day_completed', metadata: { streakDays: 1 } })
    const many = card({ type: 'day_completed', metadata: { streakDays: 12 } })

    expect(one.stats).toContainEqual({ value: '1', label: 'dia seguido' })
    expect(many.stats).toContainEqual({ value: '12', label: 'dias seguidos' })
  })

  it('as contagens aparecem por padrão e saem por toggle', () => {
    const open = card({ type: 'day_completed', metadata: { habitsDone: 5, tasksDone: 3 } })
    expect(open.stats).toContainEqual({ value: '5', label: 'hábitos' })
    expect(open.stats).toContainEqual({ value: '3', label: 'ações' })

    const closed = card(
      { type: 'day_completed', metadata: { habitsDone: 5, tasksDone: 3 } },
      { counts: false },
    )
    expect(closed.stats.some((stat) => stat.label === 'hábitos')).toBe(false)
  })

  it('o objetivo mostra volume, etapas e prazo', () => {
    const goal = card({
      type: 'goal_progress',
      sourceType: 'objective',
      progressAfter: 0.58,
      completionPercentage: 0.58,
      metadata: {
        axis: 'leitura',
        doneValue: 1240,
        targetValue: 1800,
        unitLabel: 'páginas',
        stagesDone: 3,
        stagesTotal: 5,
        daysLeft: 23,
      },
    })

    expect(goal.stats).toContainEqual({ value: '1.240 de 1.800', label: 'páginas' })
    expect(goal.stats).toContainEqual({ value: '3 de 5', label: 'etapas' })
    expect(goal.stats).toContainEqual({ value: '23', label: 'dias restantes' })
  })

  it('prazo vencido não vira contagem negativa', () => {
    const goal = card({
      type: 'goal_progress',
      sourceType: 'objective',
      progressAfter: 0.58,
      metadata: { daysLeft: 0 },
    })

    expect(goal.stats).toContainEqual({ value: 'Último dia', label: null })
  })

  it('a semana mostra os dias ativos', () => {
    const week = card({
      type: 'weekly_review',
      sourceType: 'week',
      completionPercentage: 0.8,
      metadata: { activeDays: 5, windowDays: 7 },
    })

    expect(week.stats).toContainEqual({ value: '5 de 7', label: 'dias ativos' })
  })

  /*
    A área é do hábito e do objetivo, não do dia: o dia inteiro atravessa
    várias, e "Leitura" num card que também tem treino e meditação seria
    simplesmente falso.
  */
  it('a área entra no card do hábito, e não no do dia', () => {
    const habit = card(
      { type: 'habit_completed', sourceType: 'habit', metadata: { axis: 'leitura' } },
      { axis: true },
    )
    expect(habit.stats).toContainEqual({ value: 'Leitura', label: null })

    const day = card({ type: 'day_completed', metadata: { axis: 'leitura' } }, { axis: true })
    expect(day.stats.some((stat) => stat.value === 'Leitura')).toBe(false)
  })

  it('o avanço do objetivo mostra os dois lados', () => {
    const moved = card(
      {
        type: 'goal_progress',
        sourceType: 'objective',
        title: 'Lançar meu SaaS',
        progressBefore: 0.42,
        progressAfter: 0.58,
      },
      { progress: true },
    )

    expect(moved.stats).toContainEqual({ value: '42% → 58%', label: 'nesta semana' })
    // A mesma notícia não aparece duas vezes: com o avanço na linha de apoio,
    // a métrica secundária cala.
    expect(moved.secondaryMetric).toBeNull()
  })

  it('não inventa avanço quando os dois lados são iguais', () => {
    const still = card(
      {
        type: 'goal_progress',
        sourceType: 'objective',
        progressBefore: 0.58,
        progressAfter: 0.58,
      },
      { progress: true },
    )

    expect(still.stats.some((stat) => stat.label === 'nesta semana')).toBe(false)
  })

  it('campo sem dado no evento não vira texto neutro', () => {
    const empty = card(
      { type: 'day_completed' },
      { streak: true, axis: true, counts: true, progress: true },
    )

    expect(empty.stats).toEqual([])
  })
})

describe('o painel só oferece o que o evento tem', () => {
  it('esconde sequência, área e contagens quando o evento não carrega nenhuma', () => {
    const bare = event({ type: 'day_completed', completionPercentage: 0.5 })
    const offered = availableFieldsForEvent(bare)

    expect(offered).not.toContain('streak')
    expect(offered).not.toContain('counts')
    expect(offered).toContain('completion')
  })

  it('oferece o que existe, e só isso', () => {
    const rich = event({
      type: 'day_completed',
      completionPercentage: 1,
      durationMin: 45,
      metadata: { streakDays: 9, habitsDone: 4, items: [{ label: 'Ler', done: true }] },
    })
    const offered = availableFieldsForEvent(rich)

    expect(offered).toContain('streak')
    expect(offered).toContain('counts')
    expect(offered).toContain('duration')
    expect(offered).toContain('items')
  })

  it('nunca oferece campo fora da lista do tipo', () => {
    const goal = event({
      type: 'goal_progress',
      sourceType: 'objective',
      durationMin: 30,
      metadata: { streakDays: 5 },
    })

    expect(availableFieldsForEvent(goal)).not.toContain('duration')
    expect(availableFieldsForEvent(goal)).not.toContain('streak')
  })
})
