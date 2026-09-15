import type { JourneyEventType } from '@/domain/entities/journey-event'

/**
 * O contrato do card compartilhável.
 *
 * `ShareCardData` é a fronteira entre "o que aconteceu" e "o que aparece na
 * imagem". Nenhum template conhece hábito, objetivo, etapa ou momentum: eles
 * recebem título, métrica e lista já resolvidos. É o que permite ter cinco
 * templates sem cinco cópias da mesma regra — e trocar a origem do dado
 * (evento salvo hoje, item de feed amanhã) sem tocar em desenho.
 */

// ---------------------------------------------------------------------------
// formato
// ---------------------------------------------------------------------------

/**
 * Um formato só: o Story.
 *
 * O card do Momentumm existe pra ser postado em Story — vertical, cheio de
 * tela, some em 24h. Feed e quadrado saíram porque nenhum dos dois é o lugar
 * de um progresso do dia: post de feed é publicação permanente, e um card
 * gerado por app no meio do perfil de alguém é o que ninguém posta duas vezes.
 * Com um formato só, o desenho é afinado pra ele em vez de servir aos três pela
 * metade.
 */
export const SHARE_FORMATS = ['stories'] as const
export type ShareFormat = (typeof SHARE_FORMATS)[number]

export interface ShareFormatSpec {
  readonly id: ShareFormat
  readonly label: string
  readonly ratio: string
  readonly width: number
  readonly height: number
}

/**
 * 1080 de largura: é o lado curto que as redes usam como referência, e subir
 * além disso engorda o arquivo sem ganhar nitidez em tela de celular.
 */
export const SHARE_FORMAT_SPECS: Readonly<Record<ShareFormat, ShareFormatSpec>> = {
  stories: { id: 'stories', label: 'Stories', ratio: '9:16', width: 1080, height: 1920 },
}

export const DEFAULT_SHARE_FORMAT: ShareFormat = 'stories'

// ---------------------------------------------------------------------------
// template
// ---------------------------------------------------------------------------

/**
 * A COR do card. Quatro, e só.
 *
 * Preto, neon, branco e o PNG sem fundo. Gradiente, cartaz colorido e escala de
 * cinza saíram porque o que muda entre um card e outro não é o tom da tinta: é
 * como a informação se organiza dentro dele — e isso agora tem dimensão
 * própria (`ShareComposition`). Cor e arranjo separados dão 4 x 6 combinações
 * com dez descrições, em vez de vinte e quatro templates pra manter.
 */
export const SHARE_TEMPLATES = ['dark', 'neon', 'light', 'transparent'] as const
export type ShareTemplateId = (typeof SHARE_TEMPLATES)[number]

export interface ShareTemplateSpec {
  readonly id: ShareTemplateId
  readonly label: string
  readonly hint: string
  /** Sem fundo: exporta PNG com alpha pra ir por cima de uma foto da pessoa. */
  readonly transparent: boolean
}

export const SHARE_TEMPLATE_SPECS: Readonly<Record<ShareTemplateId, ShareTemplateSpec>> = {
  dark: { id: 'dark', label: 'Preto', hint: 'A identidade do app', transparent: false },
  neon: { id: 'neon', label: 'Neon', hint: 'Moldura acesa no escuro', transparent: false },
  light: { id: 'light', label: 'Branco', hint: 'Fundo claro, muito ar', transparent: false },
  transparent: {
    id: 'transparent',
    label: 'PNG',
    hint: 'Sem fundo, pra sua foto',
    transparent: true,
  },
}

// ---------------------------------------------------------------------------
// composição: como a informação se organiza dentro do card
// ---------------------------------------------------------------------------

/**
 * O ARRANJO do card.
 *
 * É a dimensão que responde "como isso aparece", e ela é independente da cor:
 * qualquer composição funciona em preto, neon, branco ou PNG. Cada uma conta a
 * mesma história de um jeito, e todas leem os MESMOS dados, sem que nenhuma
 * conheça hábito, objetivo ou etapa.
 *
 * As oito vêm da referência do Strava e do Hevy, adaptadas: lá o assunto é
 * treino (volume, recorde, músculo); aqui é ritmo (momentum, sequência,
 * execução). O que ficou igual é a gramática — selo de recorde, resumo em
 * linha, lista com figura, gráfico, grade de números, pilha centrada, recap
 * em frase — porque é a gramática que as pessoas já sabem postar.
 */
export const SHARE_COMPOSITIONS = [
  'selo',
  'resumo',
  'lista',
  'anel',
  'figura',
  'grade',
  'pilha',
  'recap',
] as const
export type ShareCompositionId = (typeof SHARE_COMPOSITIONS)[number]

export interface ShareCompositionSpec {
  readonly id: ShareCompositionId
  readonly label: string
  readonly hint: string
}

export const SHARE_COMPOSITION_SPECS: Readonly<
  Record<ShareCompositionId, ShareCompositionSpec>
> = {
  selo: { id: 'selo', label: 'Selo', hint: 'O selo do momento e o número' },
  resumo: { id: 'resumo', label: 'Resumo', hint: 'Números em linha e a lista do dia' },
  lista: { id: 'lista', label: 'Lista', hint: 'O que saiu, com os dias da semana' },
  anel: { id: 'anel', label: 'Anel', hint: 'Números em cima, o progresso desenhado' },
  figura: { id: 'figura', label: 'Figura', hint: 'O desenho no centro, os números embaixo' },
  grade: { id: 'grade', label: 'Grade', hint: 'Quatro números, um em cada canto' },
  pilha: { id: 'pilha', label: 'Pilha', hint: 'Tudo centrado, um embaixo do outro' },
  recap: { id: 'recap', label: 'Recap', hint: 'O número e a frase que o explica' },
}

export const DEFAULT_SHARE_COMPOSITION: ShareCompositionId = 'selo'

/**
 * O que o gratuito leva: três arranjos e TODAS as cores, inclusive o PNG.
 *
 * Três arranjos e não um, porque um card só não deixa ninguém descobrir que
 * existe escolha, e é a escolha que faz a pessoa voltar ao estúdio. As cores
 * são todas de graça: cor não é o que diferencia o PRO (arranjo, foto de fundo
 * e os toggles são), e um card preso no preto parecia castigo, não plano.
 */
export const FREE_SHARE_COMPOSITIONS: readonly ShareCompositionId[] = ['selo', 'resumo', 'pilha']
export const FREE_SHARE_TEMPLATES: readonly ShareTemplateId[] = [...SHARE_TEMPLATES]

/**
 * O que a EVOLUÇÃO libera, por cima do plano.
 *
 * A chave é a do desbloqueio (`UNLOCKS`, em `evolution.ts`). O plano continua
 * mandando: o PRO já tem tudo, e o gratuito ganha arranjo por arranjo conforme
 * sobe de nível. Nada aqui tira o que o plano dá; só acrescenta.
 */
const COMPOSITION_UNLOCKS: Readonly<Record<string, ShareCompositionId>> = {
  share_lista: 'lista',
  share_anel: 'anel',
  share_figura: 'figura',
}

const TEMPLATE_UNLOCKS: Readonly<Record<string, ShareTemplateId>> = {}

export function compositionsAllowedFor(
  unlimited: boolean,
  unlocked: ReadonlySet<string> = new Set(),
): readonly ShareCompositionId[] {
  if (unlimited) return SHARE_COMPOSITIONS
  const extra = Object.entries(COMPOSITION_UNLOCKS)
    .filter(([key]) => unlocked.has(key))
    .map(([, id]) => id)
  // Na ordem da tabela, não na ordem em que foram liberados.
  return SHARE_COMPOSITIONS.filter((id) => FREE_SHARE_COMPOSITIONS.includes(id) || extra.includes(id))
}

export function templatesAllowedFor(
  unlimited: boolean,
  unlocked: ReadonlySet<string> = new Set(),
): readonly ShareTemplateId[] {
  if (unlimited) return SHARE_TEMPLATES
  const extra = Object.entries(TEMPLATE_UNLOCKS)
    .filter(([key]) => unlocked.has(key))
    .map(([, id]) => id)
  return SHARE_TEMPLATES.filter((id) => FREE_SHARE_TEMPLATES.includes(id) || extra.includes(id))
}

export const DEFAULT_SHARE_TEMPLATE: ShareTemplateId = 'dark'

// ---------------------------------------------------------------------------
// o que aparece no card
// ---------------------------------------------------------------------------

export const SHARE_FIELDS = [
  'momentum',
  'items',
  'completion',
  'objective',
  'duration',
  /** Sequência de dias — o dado mais compartilhável que o app tem. */
  'streak',
  /** A área do evento: Leitura, Treino, ou a que a pessoa criou. */
  'axis',
  /** O antes e o depois do objetivo: "42% → 58%". */
  'progress',
  /** Hábitos e ações concluídos, em números. */
  'counts',
  /** O volume registrado contra o alvo: "1240 de 1800 páginas". */
  'volume',
  /** Quanto falta pro prazo do objetivo. */
  'deadline',
  /** Etapas do plano fechadas: "3 de 5 etapas". */
  'stages',
  /** Dias com movimento na janela: "5 de 7 dias ativos". */
  'activeDays',
  'date',
  'username',
  'note',
  'branding',
] as const

export type ShareField = (typeof SHARE_FIELDS)[number]

export type ShareFieldSet = Readonly<Record<ShareField, boolean>>

export interface ShareFieldSpec {
  readonly id: ShareField
  readonly label: string
  /** Por que ligar isso expõe alguma coisa. Vazio quando não expõe nada. */
  readonly warning: string | null
}

export const SHARE_FIELD_SPECS: Readonly<Record<ShareField, ShareFieldSpec>> = {
  momentum: { id: 'momentum', label: 'Momentum Score', warning: null },
  items: {
    id: 'items',
    label: 'Atividades concluídas',
    warning: 'Mostra o nome de cada hábito da rotina.',
  },
  completion: { id: 'completion', label: 'Percentual de execução', warning: null },
  objective: {
    id: 'objective',
    label: 'Nome do objetivo ou desafio',
    warning: 'O título que você escreveu aparece na imagem.',
  },
  duration: { id: 'duration', label: 'Duração', warning: null },
  streak: { id: 'streak', label: 'Sequência de dias', warning: null },
  axis: {
    id: 'axis',
    label: 'Área',
    // Área de fábrica é genérica, mas a que a pessoa criou tem o nome que ela
    // deu — "Terapia" conta uma história que ela pode não querer no Stories.
    warning: 'A área aparece com o nome que você deu a ela.',
  },
  progress: { id: 'progress', label: 'Avanço do objetivo', warning: null },
  counts: { id: 'counts', label: 'Hábitos e ações concluídos', warning: null },
  volume: { id: 'volume', label: 'Volume registrado', warning: null },
  deadline: { id: 'deadline', label: 'Prazo restante', warning: null },
  stages: { id: 'stages', label: 'Etapas concluídas', warning: null },
  activeDays: { id: 'activeDays', label: 'Dias ativos', warning: null },
  note: { id: 'note', label: 'Frase do Momentumm', warning: null },
  date: { id: 'date', label: 'Data', warning: null },
  username: { id: 'username', label: 'Seu nome', warning: 'Identifica você na imagem.' },
  branding: { id: 'branding', label: 'Assinatura Momentumm', warning: null },
}

/**
 * Quais campos fazem sentido em cada tipo de evento.
 *
 * Um toggle que não muda nada é pior que toggle nenhum: a pessoa liga, não vê
 * diferença e para de confiar nos outros. Duração não existe em progresso de
 * objetivo; lista não existe em momentum.
 */
const FIELDS_BY_TYPE: Readonly<Record<JourneyEventType, readonly ShareField[]>> = {
  habit_completed: ['momentum', 'completion', 'objective', 'duration', 'streak', 'axis', 'activeDays', 'date', 'username', 'note', 'branding'],
  routine_completed: ['momentum', 'items', 'completion', 'duration', 'streak', 'counts', 'activeDays', 'date', 'username', 'note', 'branding'],
  day_completed: ['momentum', 'items', 'completion', 'duration', 'streak', 'counts', 'activeDays', 'date', 'username', 'note', 'branding'],
  goal_progress: ['momentum', 'completion', 'objective', 'progress', 'axis', 'volume', 'deadline', 'stages', 'date', 'username', 'note', 'branding'],
  goal_completed: ['momentum', 'completion', 'objective', 'progress', 'axis', 'volume', 'stages', 'date', 'username', 'note', 'branding'],
  milestone: ['momentum', 'streak', 'axis', 'date', 'username', 'note', 'branding'],
  weekly_review: ['momentum', 'items', 'completion', 'duration', 'streak', 'counts', 'activeDays', 'date', 'username', 'note', 'branding'],
  comeback: ['momentum', 'streak', 'date', 'username', 'note', 'branding'],
  momentum_record: ['momentum', 'streak', 'date', 'username', 'note', 'branding'],
  challenge_joined: ['momentum', 'objective', 'axis', 'date', 'username', 'note', 'branding'],
  challenge_progress: ['momentum', 'completion', 'objective', 'axis', 'streak', 'date', 'username', 'note', 'branding'],
  challenge_milestone: ['momentum', 'completion', 'objective', 'axis', 'streak', 'date', 'username', 'note', 'branding'],
  challenge_completed: ['momentum', 'completion', 'objective', 'axis', 'streak', 'date', 'username', 'note', 'branding'],
}

export function availableFieldsFor(type: JourneyEventType): readonly ShareField[] {
  return FIELDS_BY_TYPE[type]
}

export function supportsField(type: JourneyEventType, field: ShareField): boolean {
  return FIELDS_BY_TYPE[type].includes(field)
}

/** O que o painel precisa saber pra decidir se um campo tem o que mostrar. */
export interface ShareFieldSource {
  readonly type: JourneyEventType
  readonly durationMin: number | null
  readonly progressBefore: number | null
  readonly progressAfter: number | null
  readonly momentumAfter: number | null
  readonly completionPercentage: number | null
  readonly metadata: {
    readonly items?: readonly unknown[]
    readonly axis?: string
    readonly streakDays?: number
    readonly habitsDone?: number
    readonly tasksDone?: number
    readonly focusMinutes?: number
    readonly targetValue?: number
    readonly daysLeft?: number
    readonly stagesTotal?: number
    readonly activeDays?: number
  }
}

/**
 * Os campos que ESTE evento consegue mostrar.
 *
 * O tipo diz o que faz sentido; o evento diz o que existe. Um card de habito
 * suporta duracao, mas o habito marcado sem cronometro nao tem nenhuma, e um
 * toggle que nao muda nada ensina a pessoa a desconfiar dos outros. Por isso o
 * painel le daqui, e nao da lista por tipo.
 */
export function availableFieldsForEvent(event: ShareFieldSource): readonly ShareField[] {
  return FIELDS_BY_TYPE[event.type].filter((field) => {
    switch (field) {
      case 'duration':
        return Boolean(event.durationMin ?? event.metadata.focusMinutes)
      case 'streak':
        return (event.metadata.streakDays ?? 0) > 0
      case 'axis':
        return Boolean(event.metadata.axis)
      case 'counts':
        return Boolean(event.metadata.habitsDone ?? event.metadata.tasksDone)
      case 'progress':
        return event.progressBefore !== null && event.progressAfter !== null
      case 'volume':
        return Boolean(event.metadata.targetValue)
      case 'deadline':
        return event.metadata.daysLeft !== undefined
      case 'stages':
        return Boolean(event.metadata.stagesTotal)
      case 'activeDays':
        return event.metadata.activeDays !== undefined
      case 'items':
        return (event.metadata.items?.length ?? 0) > 0
      case 'momentum':
        return event.momentumAfter !== null
      case 'completion':
        return event.completionPercentage !== null || event.progressAfter !== null
      default:
        return true
    }
  })
}

/**
 * O estado inicial dos toggles: MENOR EXPOSIÇÃO e MENOS COISA NA TELA.
 *
 * Duas regras se somam aqui.
 *
 * Privacidade: nome do objetivo, lista de hábitos e nome da pessoa começam
 * desligados. São os três campos que carregam conteúdo escrito por ela — "Sair
 * da terapia", "Remédio 8h", o nome completo — e nenhum deles deveria ir pro
 * Instagram por omissão.
 *
 * Estética: a frase do app ("Você avançou hoje.") também começa desligada. Ela
 * é a coisa mais "de aplicativo" do card, e o card que a pessoa quer postar é o
 * que parece dela — não o print de um dashboard. Quem quiser, liga.
 *
 * Número e percentual começam ligados: são o motivo do card existir e não dizem
 * nada sobre a vida de ninguém.
 */
export function defaultFieldsFor(type: JourneyEventType): ShareFieldSet {
  const available = FIELDS_BY_TYPE[type]
  const on = (field: ShareField, value: boolean) => available.includes(field) && value

  return {
    /*
      Tudo que é NÚMERO nasce ligado: percentual, momentum, duração, volume,
      prazo, etapas, sequência, contagens, dias ativos e a lista do que foi
      feito. O card conta a história inteira do que aconteceu, e quem quiser um
      card mais seco desliga o que sobra — que é uma decisão mais fácil de tomar
      olhando o preview do que imaginando o que falta.
    */
    momentum: on('momentum', true),
    completion: on('completion', true),
    duration: on('duration', true),
    streak: on('streak', true),
    progress: on('progress', true),
    counts: on('counts', true),
    volume: on('volume', true),
    deadline: on('deadline', true),
    stages: on('stages', true),
    activeDays: on('activeDays', true),
    items: on('items', true),
    // A data começa desligada: em cima do card ela parecia carimbo de
    // relatório, e o que a pessoa posta é o momento, não o dia. Quem quiser, liga.
    date: on('date', false),
    branding: on('branding', true),

    /*
      Os três que continuam desligados são os que carregam TEXTO escrito pela
      pessoa: o título do objetivo ("Sair da terapia"), a área que ela criou e
      o próprio nome. Mostrar o que ela fez é o ponto do card; dizer quem é ela
      e como ela chamou aquilo é outra decisão, e continua sendo dela.

      A frase do app também fica de fora: é a coisa mais "de aplicativo" do
      card, e o que a pessoa posta precisa parecer dela.
    */
    objective: on('objective', false),
    axis: on('axis', false),
    username: on('username', false),
    note: on('note', false),
  }
}

/** Garante que um conjunto vindo de fora não liga campo que o tipo não tem. */
export function sanitizeFields(type: JourneyEventType, fields: ShareFieldSet): ShareFieldSet {
  const available = FIELDS_BY_TYPE[type]
  const entries = SHARE_FIELDS.map(
    (field) => [field, available.includes(field) && fields[field]] as const,
  )
  return Object.fromEntries(entries) as ShareFieldSet
}

// ---------------------------------------------------------------------------
// o dado que o template desenha
// ---------------------------------------------------------------------------

export interface ShareMetric {
  /** Já formatado: "87%", "84", "5/5", "19". */
  readonly value: string
  readonly label: string | null
}

export interface ShareCardItem {
  readonly label: string
  readonly done: boolean
}

/**
 * Uma informacao curta da linha de apoio: "12 dias seguidos", "Leitura",
 * "5 habitos e 3 acoes".
 *
 * Existe como lista, e nao como campos soltos no card, porque o template
 * desenha todas do mesmo jeito: uma linha discreta abaixo do numero. Um campo
 * novo passa a aparecer sem que nenhum template saiba o que ele e, que e a
 * mesma razao de `items` ser uma lista em vez de sete propriedades.
 */
export interface ShareCardStat {
  readonly value: string
  /** Complemento em corpo menor. Null quando o valor ja se explica. */
  readonly label: string | null
}

export interface ShareCardData {
  readonly eventType: JourneyEventType
  /** Linha curta em caixa alta acima do título. Null quando não há. */
  readonly kicker: string | null
  readonly title: string
  readonly subtitle: string | null
  /** A estrela do card: o número que ocupa a maior área. */
  readonly primaryMetric: ShareMetric
  readonly secondaryMetric: ShareMetric | null
  readonly momentumBefore: number | null
  readonly momentumAfter: number | null
  readonly momentumChange: number | null
  readonly completionPercentage: number | null
  readonly items: readonly ShareCardItem[]
  /** A linha de apoio: sequencia, area, avanco e contagens, quando ligados. */
  readonly stats: readonly ShareCardStat[]
  readonly date: string | null
  readonly username: string | null
  readonly branding: boolean
  /** A frase de continuidade. Nunca elogio genérico. */
  readonly note: string | null
  /** Cor de acento: o eixo do evento, ou a marca. */
  readonly accent: string
}
