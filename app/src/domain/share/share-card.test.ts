import { describe, expect, it } from 'vitest'
import { dayKeyOf } from '@/domain/entities/day'
import { createJourneyEvent, type NewJourneyEventInput } from '@/domain/entities/journey-event'
import { toShareCardData } from './share-card-adapter'
import {
  availableFieldsFor,
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
  it('começa sem nome do objetivo, sem lista e sem nome da pessoa', () => {
    const fields = defaultFieldsFor('routine_completed')
    expect(fields.objective).toBe(false)
    expect(fields.items).toBe(false)
    expect(fields.username).toBe(false)
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
    const data = card({
      type: 'comeback',
      sourceType: 'streak',
      title: 'Voltei hoje',
      metadata: { daysAway: 4 },
    })
    expect(data.kicker).toBe('De volta ao ritmo')
    expect(data.subtitle).toContain('4 dias')
    expect(data.note).toBe('Continue de onde parou.')
  })

  it('nunca escreve elogio genérico', () => {
    for (const type of ['day_completed', 'goal_completed', 'weekly_review'] as const) {
      const data = card({ type })
      expect(data.note?.toLowerCase()).not.toContain('parabéns')
    }
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
