import { describe, expect, it } from 'vitest'
import { TOTAL_WEIGHT } from './plan-stage'
import {
  detectBlueprint,
  PLAN_BLUEPRINTS,
  weightSum,
  type PlanBlueprint,
} from './plan-blueprint'

describe('a biblioteca inteira', () => {
  it('todo roteiro fecha 100 de peso', () => {
    // O domínio recusa um conjunto que não soma 100, e recusar na hora de
    // gravar significa a pessoa perder o plano com ele já na tela.
    for (const blueprint of PLAN_BLUEPRINTS) {
      expect(weightSum(blueprint), blueprint.key).toBe(TOTAL_WEIGHT)
    }
  })

  it('toda ação aponta pra uma etapa que existe', () => {
    for (const blueprint of PLAN_BLUEPRINTS) {
      for (const task of blueprint.tasks) {
        expect(task.stageIndex, `${blueprint.key}: ${task.title}`).toBeLessThan(
          blueprint.stages.length,
        )
        expect(task.stageIndex).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('todo roteiro começa com pelo menos uma ação pra hoje', () => {
    // Plano que começa amanhã não começa. É a regra 4 do construtor, e ela
    // vale pros roteiros também.
    for (const blueprint of PLAN_BLUEPRINTS) {
      expect(
        blueprint.tasks.some((task) => task.when === 'hoje'),
        blueprint.key,
      ).toBe(true)
    }
  })

  it('as frações dos hábitos de duração somam o dia inteiro, nem mais nem menos', () => {
    /*
      Elas dividem entre si o que sobrou do orçamento depois dos gestos. Acima
      de 1 o plano pediria mais tempo do que a pessoa declarou ter; abaixo, ele
      deixaria minutos declarados sem uso e entregaria sessões menores do que
      caberiam.
    */
    for (const blueprint of PLAN_BLUEPRINTS) {
      const duracao = blueprint.habits.filter((habit) => habit.fixedMinutes === undefined)

      /*
        Um roteiro pode ser só de gestos, e "finanças" é o caso: registrar o
        gasto e conferir o saldo são cinco e dez minutos, não uma sessão.
        Exigir um hábito de duração ali seria inventar um.
      */
      if (duracao.length === 0) continue

      const total = duracao.reduce((sum, habit) => sum + (habit.share ?? 0), 0)
      expect(total, blueprint.key).toBeCloseTo(1, 2)
    }
  })

  it('todo hábito é ou de duração ou de gesto, nunca os dois', () => {
    for (const blueprint of PLAN_BLUEPRINTS) {
      for (const habit of blueprint.habits) {
        const temFracao = habit.share !== undefined
        const temFixo = habit.fixedMinutes !== undefined
        expect(temFracao !== temFixo, `${blueprint.key}: ${habit.name}`).toBe(true)
      }
    }
  })

  it('os gestos são curtos: gesto que leva meia hora é sessão', () => {
    for (const blueprint of PLAN_BLUEPRINTS) {
      for (const habit of blueprint.habits) {
        if (habit.fixedMinutes === undefined) continue
        expect(habit.fixedMinutes, `${blueprint.key}: ${habit.name}`).toBeLessThanOrEqual(15)
      }
    }
  })

  it('nenhum roteiro usa travessão', () => {
    // Regra de escrita do produto, e aqui é conteúdo escrito à mão, onde ela
    // escapa com mais facilidade do que na saída do modelo.
    const textos = PLAN_BLUEPRINTS.flatMap((blueprint) => [
      blueprint.rationale,
      blueprint.caution ?? '',
      ...blueprint.stages.flatMap((stage) => [stage.title, stage.description]),
      ...blueprint.habits.flatMap((habit) => [habit.name, habit.rationale]),
      ...blueprint.tasks.flatMap((task) => [task.title, task.minimalVersion]),
    ])

    for (const texto of textos) {
      expect(texto, texto).not.toMatch(/[—–]/)
    }
  })

  it('os assuntos de saúde e dinheiro dizem o limite do app em voz alta', () => {
    const precisamAvisar = ['emagrecer', 'massa', 'corrida', 'sono', 'financas', 'parar', 'meditacao']
    for (const key of precisamAvisar) {
      const blueprint = PLAN_BLUEPRINTS.find((item) => item.key === key)
      expect(blueprint?.caution, key).toBeTruthy()
    }
  })

  it('nenhum roteiro prescreve número de saúde', () => {
    /*
      A regra que mais importa deste arquivo: o roteiro organiza comportamento,
      nunca prescreve. Caloria, macro, carga em quilo e hora de sono como meta
      são o que separa "o app me ajudou a aparecer" de "o app me disse o que
      comer", e a segunda frase não é o que este produto é.
    */
    const proibido =
      /\bcalorias?\b|\bkcal\b|\bmacros?\b|\bprote[íi]na\s+por\b|\bd[ée]ficit\b|\b\d+\s?kg\b|\b\d+\s?horas?\s+de\s+sono\b|\bjejum\b|\blow\s?carb\b/i

    const textos = PLAN_BLUEPRINTS.flatMap((blueprint) => [
      blueprint.rationale,
      ...blueprint.stages.map((stage) => stage.description),
      ...blueprint.habits.map((habit) => habit.rationale),
      ...blueprint.tasks.map((task) => task.title),
    ])

    for (const texto of textos) {
      expect(texto, texto).not.toMatch(proibido)
    }
  })
})

describe('detectBlueprint', () => {
  const acha = (titulo: string, motivo?: string): string | null =>
    detectBlueprint(titulo, 'treino', motivo)?.key ?? null

  it('acha o assunto pelo que a pessoa escreveu', () => {
    expect(acha('Emagrecer 8kg')).toBe('emagrecer')
    expect(acha('Perder barriga até o verão')).toBe('emagrecer')
    expect(acha('Ganhar massa muscular')).toBe('massa')
    expect(acha('Correr 10km sem parar')).toBe('corrida')
    expect(acha('Passar no concurso da Receita')).toBe('concurso')
    expect(acha('Ficar fluente em inglês')).toBe('idioma')
    expect(acha('Dormir melhor')).toBe('sono')
    expect(acha('Sair das dívidas')).toBe('financas')
    expect(acha('Parar de fumar')).toBe('parar')
    expect(acha('Escrever o TCC')).toBe('escrever')
  })

  it('não se importa com acento nem com caixa', () => {
    expect(acha('EMAGRECER')).toBe('emagrecer')
    expect(acha('Ficar fluente em ingles')).toBe('idioma')
    expect(acha('Sair das dividas')).toBe('financas')
  })

  it('lê o motivo quando o título não diz o assunto', () => {
    // "Ficar bem" não é assunto nenhum; o motivo é onde ela disse de verdade.
    expect(acha('Ficar bem comigo', 'Quero emagrecer antes do casamento')).toBe('emagrecer')
  })

  it('não casa quando não tem certeza', () => {
    /*
      A regra 2 do arquivo: casar errado é pior que não casar. Um roteiro de
      corrida montado pra quem escreveu outra coisa faz o app parecer que não
      leu, e plano genérico não é ruim, é só genérico.
    */
    expect(acha('Ser uma pessoa melhor')).toBeNull()
    expect(acha('Organizar a casa')).toBeNull()
    expect(acha('Terminar o projeto do cliente')).toBeNull()
    expect(acha('')).toBeNull()
    expect(acha('ok')).toBeNull()
  })

  it('não confunde ganhar massa com emagrecer', () => {
    // As duas falam de peso e pedem planos opostos.
    expect(acha('Ganhar peso')).toBe('massa')
    expect(acha('Perder peso')).toBe('emagrecer')
  })
})

describe('o formato de cada roteiro', () => {
  const campos = (blueprint: PlanBlueprint) => ({
    etapas: blueprint.stages.length,
    habitos: blueprint.habits.length,
    acoes: blueprint.tasks.length,
  })

  it('tem etapas, hábitos e ações suficientes pra ser um plano', () => {
    for (const blueprint of PLAN_BLUEPRINTS) {
      const { etapas, habitos, acoes } = campos(blueprint)
      expect(etapas, blueprint.key).toBeGreaterThanOrEqual(3)
      expect(etapas, blueprint.key).toBeLessThanOrEqual(5)
      expect(habitos, blueprint.key).toBeGreaterThanOrEqual(2)
      expect(acoes, blueprint.key).toBeGreaterThanOrEqual(4)
    }
  })

  it('cada etapa tem descrição própria, não repetida de outra', () => {
    for (const blueprint of PLAN_BLUEPRINTS) {
      const descricoes = blueprint.stages.map((stage) => stage.description)
      expect(new Set(descricoes).size, blueprint.key).toBe(descricoes.length)
    }
  })

  it('toda chave é única', () => {
    const keys = PLAN_BLUEPRINTS.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
