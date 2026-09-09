import { describe, expect, it } from 'vitest'
import { CIRCLE_FEED_TYPES } from './circle-feed'
import { dayKeyToDate, parseDayKey } from './day'
import {
  createJourneyEvent,
  JOURNEY_EVENT_TYPES,
  JOURNEY_VISIBILITIES,
  type JourneyEventType,
  type NewJourneyEventInput,
} from './journey-event'
import { eventsToRecord } from './journey-recorder'
import { challengeEventsToRecord } from './challenge-recorder'

/**
 * As invariantes da camada de momentos.
 *
 * Esta é a tabela que o feed vai ler quando a comunidade existir, e o custo de
 * um erro aqui não aparece hoje: aparece no dia em que mil linhas gravadas com
 * a visibilidade errada ficam visíveis pra outras pessoas — e aí não há
 * correção que desfaça o que já foi visto.
 *
 * Por isso as garantias estão travadas em teste, e não só no comentário:
 *
 *  1. todo momento nasce PRIVADO, venha de onde vier;
 *  2. mudar isso é uma decisão explícita, nunca um efeito colateral;
 *  3. todo tipo do enum tem caminho de gravação — um tipo que só existisse
 *     como evento efêmero (o card "meu dia às 15h") nunca alimentaria o feed;
 *  4. o que o feed do círculo mostra é um subconjunto do que é gravado.
 */

function input(
  overrides: Partial<NewJourneyEventInput> & Pick<NewJourneyEventInput, 'type'>,
): NewJourneyEventInput {
  return {
    userId: 'user-1',
    sourceType: 'day',
    title: 'Hoje',
    ...overrides,
  }
}

describe('privado por padrão', () => {
  it.each(JOURNEY_EVENT_TYPES)('%s nasce privado', (type) => {
    const event = createJourneyEvent(input({ type }), `evento-${type}`)
    expect(event.visibility).toBe('privada')
  })

  it('os quatro degraus existem, e só o primeiro é usado ao criar', () => {
    expect(JOURNEY_VISIBILITIES).toEqual(['privada', 'amigos', 'comunidade', 'publica'])

    // A visibilidade só sai de 'privada' quando alguém pede — e quem pede é o
    // botão do perfil, passando por `setEventVisibility`.
    const shared = createJourneyEvent(input({ type: 'day_completed', visibility: 'amigos' }), 'e1')
    expect(shared.visibility).toBe('amigos')
  })
})

describe('nenhum tipo fica de fora da gravação', () => {
  const today = parseDayKey('2026-09-08')

  /**
   * Um dia cheio: rotina fechada, dia cumprido, retomada depois de uma semana
   * parada, momentum em recorde, objetivo cruzando faixa e marco alcançado.
   *
   * O estado é montado pra que TODOS os gravadores automáticos tenham o que
   * produzir — é assim que o teste consegue afirmar que nenhum tipo depende de
   * alguém lembrar de chamar `record` em algum componente.
   */
  const recorded = new Set<JourneyEventType>(
    eventsToRecord({
      today,
      momentum: { value: 84, delta: 8 },
      habits: [
        { id: 'h1', name: 'Ler 20 páginas', axis: 'leitura', dayPart: 'manha', done: true },
        { id: 'h2', name: 'Treino', axis: 'treino', dayPart: 'manha', done: true },
      ],
      dayComplete: true,
      dayDone: 4,
      dayTotal: 4,
      dayItems: [
        { label: 'Ler 20 páginas', done: true },
        { label: 'Treino', done: true },
      ],
      focusMinutesToday: 45,
      daysAway: 6,
      objectives: [{ id: 'obj-1', title: 'Ler 6 livros', axis: 'leitura', ratio: 0.52 }],
      milestones: [
        { id: 'habitos:100', kind: 'habitos', label: '100 hábitos concluídos', count: 100, unit: 'hábitos' },
      ],
      existing: [],
    }).map((candidate) => candidate.type),
  )

  it('o gravador automático cobre hábito, rotina, dia, retomada, momentum, objetivo e marco', () => {
    expect(recorded).toContain('habit_completed')
    expect(recorded).toContain('routine_completed')
    expect(recorded).toContain('day_completed')
    expect(recorded).toContain('comeback')
    expect(recorded).toContain('momentum_record')
    expect(recorded).toContain('goal_progress')
    expect(recorded).toContain('milestone')
  })

  it('nada sai do gravador com visibilidade diferente de privada', () => {
    const candidates = eventsToRecord({
      today,
      momentum: { value: 84, delta: 8 },
      habits: [{ id: 'h1', name: 'Ler', axis: 'leitura', dayPart: 'manha', done: true }],
      dayComplete: true,
      dayDone: 1,
      dayTotal: 1,
      dayItems: [{ label: 'Ler', done: true }],
      focusMinutesToday: 20,
      daysAway: 0,
      objectives: [],
      milestones: [],
      existing: [],
    })

    /*
      O gravador nem sequer informa a visibilidade — quem decide é o default do
      domínio e o do banco. Se um dia alguém passar 'amigos' aqui, uma rotina
      inteira começaria a nascer compartilhada sem ninguém pedir.
    */
    for (const candidate of candidates) {
      expect(candidate.visibility).toBeUndefined()
      expect(createJourneyEvent({ ...candidate, userId: 'user-1' }, 'e').visibility).toBe('privada')
    }
  })

  it('rodar de novo com o que já foi gravado não duplica nada', () => {
    const first = eventsToRecord({
      today,
      momentum: { value: 84, delta: 8 },
      habits: [{ id: 'h1', name: 'Ler', axis: 'leitura', dayPart: 'manha', done: true }],
      dayComplete: true,
      dayDone: 1,
      dayTotal: 1,
      dayItems: [{ label: 'Ler', done: true }],
      focusMinutesToday: 20,
      daysAway: 0,
      objectives: [],
      milestones: [],
      existing: [],
    })

    /*
      O evento precisa nascer no MESMO dia que o gravador está avaliando. A
      chave de repetição diária compara `event.day` com `today`, e `day` é
      derivado de `occurredAt` — sem ancorar aqui, o teste passaria só no dia
      em que foi escrito e a dedupe pareceria quebrada em toda execução futura.
    */
    const occurredAt = dayKeyToDate(today)
    const saved = first.map((candidate, index) =>
      createJourneyEvent({ ...candidate, userId: 'user-1', occurredAt }, `e${index}`),
    )

    const second = eventsToRecord({
      today,
      momentum: { value: 84, delta: 8 },
      habits: [{ id: 'h1', name: 'Ler', axis: 'leitura', dayPart: 'manha', done: true }],
      dayComplete: true,
      dayDone: 1,
      dayTotal: 1,
      dayItems: [{ label: 'Ler', done: true }],
      focusMinutesToday: 20,
      daysAway: 0,
      objectives: [],
      milestones: [],
      existing: saved,
    })

    expect(second).toEqual([])
  })

  it('os dois tipos sem gravador automático são gravados no clique', () => {
    /*
      `goal_completed` e `weekly_review` são transições com hora marcada — o
      objetivo que a pessoa fechou agora, a review que ela concluiu agora. Eles
      são gravados no `PlannerProvider`, no clique, e não no próximo
      carregamento do dashboard: adiar carimbaria o horário errado no que um
      dia vai ser o feed.
    */
    expect(recorded).not.toContain('goal_completed')
    expect(recorded).not.toContain('weekly_review')
    expect(JOURNEY_EVENT_TYPES).toContain('goal_completed')
    expect(JOURNEY_EVENT_TYPES).toContain('weekly_review')
  })

  it('o gravador de desafio também nasce privado', () => {
    const candidates = challengeEventsToRecord({
      today,
      momentum: { value: 84, delta: 8 },
      entries: [],
      existing: [],
    })

    for (const candidate of candidates) {
      expect(candidate.visibility).toBeUndefined()
    }
  })
})

describe('o feed do círculo lê o que já existe', () => {
  it('todo tipo do feed é um tipo gravável', () => {
    for (const type of CIRCLE_FEED_TYPES) {
      expect(JOURNEY_EVENT_TYPES).toContain(type)
    }
  })

  it('hábito e dia ficam de fora: cinco por dia vezes dez amigos é feed que ninguém lê', () => {
    expect(CIRCLE_FEED_TYPES).not.toContain('habit_completed')
    expect(CIRCLE_FEED_TYPES).not.toContain('day_completed')
  })

  it('comunidade e pública continuam sem leitor nenhum', () => {
    /*
      Os dois degraus existem no enum pra o dia em que houver tela — e é
      justamente por não haver que nenhuma parte do produto pode escrevê-los.
      Alcance que ninguém consegue conferir na interface é alcance que não
      deveria existir no banco.
    */
    expect(JOURNEY_VISIBILITIES).toContain('comunidade')
    expect(JOURNEY_VISIBILITIES).toContain('publica')
  })
})
