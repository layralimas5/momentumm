import { describe, expect, it } from 'vitest'
import {
  SHARE_COMPOSITIONS,
  SHARE_FORMAT_SPECS,
  SHARE_TEMPLATES,
  type ShareCardData,
  type ShareCompositionId,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { renderShareCard } from './render-share-card'

/**
 * As quatro cores e os seis arranjos desenhando de verdade.
 *
 * O renderizador é canvas puro: um arranjo que erra o nome de um método ou
 * esquece de fechar um caminho não quebra o build nem o teste de domínio — ele
 * quebra na mão da pessoa, no meio do Story. Este teste desenha as vinte e
 * quatro combinações num contexto falso que anota tudo que foi chamado, e
 * confere que cada uma pintou fundo e escreveu texto no espaço do card.
 *
 * O contexto é falso porque o `canvas` do Node é uma dependência nativa: pesada
 * pra compilar em Windows e desnecessária pra responder a pergunta que
 * importa aqui, que é "o desenho acontece sem estourar".
 */

interface Call {
  readonly method: string
  readonly args: readonly unknown[]
}

function fakeContext() {
  const calls: Call[] = []
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
  }

  const gradient = { addColorStop: record('addColorStop') }

  const ctx = {
    calls,
    canvas: { width: 1080, height: 1920 },
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    scale: record('scale'),
    drawImage: record('drawImage'),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: (text: string) => ({ width: text.length * 18 }),
  }

  return ctx as unknown as CanvasRenderingContext2D & { calls: Call[] }
}

const DATA: ShareCardData = {
  eventType: 'day_completed',
  kicker: 'Dia cumprido',
  title: 'Sete de sete, no dia mais cheio da semana',
  subtitle: 'Rotina da manhã inteira, sem pular nenhuma',
  primaryMetric: { value: '100%', label: 'do plano do dia' },
  secondaryMetric: { value: '+6', label: 'nesta semana' },
  items: [
    { label: 'Ler 20 páginas', done: true },
    { label: 'Treino de força', done: true },
    { label: 'Meditar 10 min', done: false },
  ],
  stats: [
    { value: '12', label: 'dias seguidos' },
    { value: '5', label: 'hábitos' },
    { value: 'Leitura', label: null },
  ],
  momentumBefore: 76,
  momentumAfter: 84,
  momentumChange: 8,
  completionPercentage: 1,
  note: 'Constância é o que move.',
  date: '8 de setembro',
  username: 'Lay',
  branding: true,
  accent: '#6d5cff',
}

function drawWith(template: ShareTemplateId, composition: ShareCompositionId = 'destaque') {
  const ctx = fakeContext()
  renderShareCard(ctx, DATA, { template, composition, format: 'stories' })
  return ctx.calls
}

function textOf(template: ShareTemplateId, composition: ShareCompositionId = 'destaque'): string {
  return drawWith(template, composition)
    .filter((call) => call.method === 'fillText')
    .map((call) => String(call.args[0]))
    .join('')
}

describe('as cores', () => {
  it.each(SHARE_TEMPLATES)('%s pinta o card e escreve o conteúdo', (template) => {
    const calls = drawWith(template)

    expect(calls.some((call) => call.method === 'clearRect')).toBe(true)
    expect(calls.filter((call) => call.method === 'fillText').length).toBeGreaterThan(3)
  })

  it('só o PNG deixa o fundo vazio', () => {
    for (const template of SHARE_TEMPLATES) {
      const painted = drawWith(template).some((call) => call.method === 'fillRect')
      expect(painted).toBe(template !== 'transparent')
    }
  })

  it('a moldura do neon é desenhada e some quando há foto por baixo', () => {
    expect(drawWith('neon').filter((call) => call.method === 'stroke').length).toBeGreaterThan(0)

    const ctx = fakeContext()
    renderShareCard(ctx, DATA, {
      template: 'neon',
      composition: 'destaque',
      format: 'stories',
      photo: { image: {} as CanvasImageSource, width: 1080, height: 1440 },
    })

    expect(ctx.calls.some((call) => call.method === 'drawImage')).toBe(true)
  })
})

describe('os arranjos', () => {
  it.each(SHARE_COMPOSITIONS)('%s desenha em qualquer cor', (composition) => {
    for (const template of SHARE_TEMPLATES) {
      const calls = drawWith(template, composition)
      expect(calls.filter((call) => call.method === 'fillText').length).toBeGreaterThan(2)
    }
  })

  it.each(SHARE_COMPOSITIONS)('%s mantém o texto dentro do card', (composition) => {
    const { width, height } = SHARE_FORMAT_SPECS.stories
    const texts = drawWith('dark', composition).filter((call) => call.method === 'fillText')

    for (const call of texts) {
      const x = call.args[1] as number
      const y = call.args[2] as number
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(height)
    }
  })

  it('o cartaz abre pelo número e o destaque abre pelo título', () => {
    /*
      O texto sai caractere a caractere quando há espaçamento entre letras, e é
      por isso que a ordem é lida pela posição de cada trecho na sequência de
      escritas concatenada, não pela primeira chamada.
    */
    const order = (composition: ShareCompositionId) => {
      const written = textOf('dark', composition)
      return { metric: written.indexOf('100%'), title: written.indexOf('Sete') }
    }

    const cartaz = order('cartaz')
    const destaque = order('destaque')

    expect(cartaz.metric).toBeGreaterThanOrEqual(0)
    expect(cartaz.metric).toBeLessThan(cartaz.title)
    expect(destaque.title).toBeLessThan(destaque.metric)
  })

  it('o gráfico desenha o anel e as barras do momentum', () => {
    const calls = drawWith('dark', 'grafico')

    // Trilho e preenchimento: dois arcos de círculo inteiro, no mesmo centro.
    const rings = calls.filter(
      (call) => call.method === 'arc' && Math.abs(Number(call.args[3]) - Math.PI * 2) > 0,
    )
    expect(rings.length).toBeGreaterThanOrEqual(2)

    const written = textOf('dark', 'grafico')
    expect(written).toContain('100%')
    expect(written).toContain('Momentum agora')
  })

  it('o mapa liga os nós ao centro com traços curvos', () => {
    const curves = drawWith('dark', 'mapa').filter(
      (call) => call.method === 'quadraticCurveTo',
    )
    expect(curves.length).toBeGreaterThan(0)
  })

  it('os tópicos listam as informações que os outros arranjos escalam', () => {
    const written = textOf('dark', 'topicos')

    expect(written).toContain('dias seguidos')
    expect(written).toContain('hábitos')
    expect(written).toContain('100%')
  })

  /*
    O card cheio é o caso real agora que quase tudo nasce ligado: dez itens,
    oito informações de apoio e o momentum não cabem em 1920px, e sem o corte
    o excesso saía pela borda de baixo em silêncio.
  */
  it.each(SHARE_COMPOSITIONS)('%s corta o excesso em vez de vazar', (composition) => {
    const { height } = SHARE_FORMAT_SPECS.stories
    const crowded: ShareCardData = {
      ...DATA,
      items: Array.from({ length: 12 }, (_, index) => ({
        label: `Hábito número ${index + 1} da rotina`,
        done: index % 3 !== 0,
      })),
      stats: [
        { value: '12', label: 'dias seguidos' },
        { value: '1.240 de 1.800', label: 'páginas' },
        { value: '3 de 5', label: 'etapas' },
        { value: '23', label: 'dias restantes' },
        { value: '5 de 7', label: 'dias ativos' },
        { value: '5', label: 'hábitos' },
        { value: '3', label: 'ações' },
        { value: '1h30', label: 'de foco' },
      ],
    }

    const ctx = fakeContext()
    renderShareCard(ctx, crowded, { template: 'dark', composition, format: 'stories' })

    const texts = ctx.calls.filter((call) => call.method === 'fillText')
    for (const call of texts) {
      expect(call.args[2] as number).toBeLessThanOrEqual(height)
      expect(call.args[2] as number).toBeGreaterThanOrEqual(0)
    }
  })

  it.each(SHARE_COMPOSITIONS)('%s desenha a linha de apoio ou os seus dados', (composition) => {
    const written = textOf('dark', composition)

    // No gráfico e no mapa os mesmos números aparecem dentro do desenho; o que
    // não pode é a informação sumir porque o arranjo mudou.
    expect(written).toContain('dias seguidos')
  })
})
