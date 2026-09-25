import { describe, expect, it } from 'vitest'
import type { ActivityTypeSlug } from '@/domain/entities/activity-type'
import { dayKeyOf, addDays } from '@/domain/entities/day'
import { ObjectiveAxisConflictError, type Objective } from '@/domain/entities/objective'
import { DemoObjectiveRepository, DemoProfileRepository } from './demo-repositories'
import { demoStore, DEMO_USER } from './demo-store'

/**
 * Um objetivo ativo por área, e o erro que diz QUAL área.
 *
 * O teste nasce de um beco sem saída real: a ativação do plano do quiz
 * esbarrava nessa regra, mostrava "Não consegui ativar seu plano" e oferecia
 * dois botões que falhavam sempre — "tentar de novo" (mesma regra) e "refazer
 * o quiz" (mesma área). Como a casca do app manda pra tela de ativação
 * enquanto houver plano pendente, a conta ficava inacessível.
 *
 * A saída exigiu um erro TIPADO, com o eixo junto: sem saber a área, a tela
 * não consegue mostrar quem está ocupando o lugar nem oferecer liberar. Este
 * teste trava as duas coisas — o tipo do erro e o eixo dentro dele.
 */

const objectives = new DemoObjectiveRepository()
const profiles = new DemoProfileRepository()
const TODAY = dayKeyOf(new Date())

/*
  A conta demo já nasce com objetivo em leitura, estudo e treino. Os testes
  usam `meditacao`, que é o único eixo de fábrica livre — num eixo ocupado o
  primeiro `create` já falharia e o teste provaria outra coisa.
*/
function novoObjetivo(titulo: string, axis: ActivityTypeSlug) {
  return objectives.create({
    userId: DEMO_USER.id,
    title: titulo,
    axis,
    target: 30,
    startedOn: TODAY,
    deadline: addDays(TODAY, 60),
  })
}

describe('um objetivo ativo por área', () => {
  it('o segundo objetivo na mesma área é recusado com o eixo junto', async () => {
    await novoObjetivo('Meditar todo dia', 'meditacao')

    /*
      `rejects.toThrow` sozinho não provaria nada: o erro genérico também
      passaria. O que importa é o TIPO e o campo `axis`, que é o que permite
      a tela oferecer a saída em vez de repetir a mensagem.
    */
    const conflito = novoObjetivo('Respirar 10 minutos', 'meditacao')
    await expect(conflito).rejects.toBeInstanceOf(ObjectiveAxisConflictError)
    await conflito.catch((cause: unknown) => {
      expect((cause as ObjectiveAxisConflictError).axis).toBe('meditacao')
    })
  })

  it('a área que a conta demo já ocupa também é recusada', async () => {
    // Leitura já vem ocupada na conta demo: a regra vale pro que já existia,
    // não só pro que este teste criou.
    await expect(novoObjetivo('Outro de leitura', 'leitura')).rejects.toBeInstanceOf(
      ObjectiveAxisConflictError,
    )
  })

  it('a mensagem diz o que fazer, não só que deu errado', async () => {
    await novoObjetivo('Mais um de leitura', 'leitura').catch((cause: unknown) => {
      expect((cause as Error).message).toMatch(/arquiva|fecha/i)
    })
  })
})

/**
 * O mesmo caminho, numa conta PRO.
 *
 * O teste nasce de outro beco sem saída: a regra "um por eixo" era do banco e
 * valia pra todo mundo, então quem pagava esbarrava nela igual. Numa conta com
 * objetivo em todas as áreas de fábrica, o diálogo de objetivo novo abria preso
 * em "Leitura" — cartão desabilitado, botão desabilitado, nenhuma saída.
 *
 * O que ele trava é que o teto por área saiu do código e passou a ser o PLANO,
 * inclusive no modo demo. Um `some()` fixo aqui faria o demo recusar o que o
 * Supabase aceita, e é no demo que a regra é vista primeiro.
 */
describe('vários objetivos na mesma área, no PRO', () => {
  it('quatro objetivos na mesma área coexistem', async () => {
    await profiles.update(DEMO_USER.id, { plan: 'pro' })

    const criados: Objective[] = []
    for (const titulo of ['Lançar meu aplicativo', 'Criar meu curso', 'Aumentar faturamento']) {
      criados.push(await novoObjetivo(titulo, 'estudo'))
    }

    expect(criados).toHaveLength(3)
    const ativos = demoStore
      .objectives()
      .filter((item) => item.axis === 'estudo' && item.archivedAt === null)
    // A conta demo já nasce com um objetivo em estudo: três criados aqui, quatro no total.
    expect(ativos.length).toBeGreaterThanOrEqual(4)
  })

  it('voltar pro gratuito volta a recusar, sem apagar o que já existe', async () => {
    await profiles.update(DEMO_USER.id, { plan: 'pro' })
    await novoObjetivo('Frente extra em estudo', 'estudo')

    await profiles.update(DEMO_USER.id, { plan: 'free' })
    await expect(novoObjetivo('Mais uma em estudo', 'estudo')).rejects.toBeInstanceOf(
      ObjectiveAxisConflictError,
    )

    // O que a conta criou como PRO continua lá: o teto barra criação, não posse.
    const ativos = demoStore
      .objectives()
      .filter((item) => item.axis === 'estudo' && item.archivedAt === null)
    expect(ativos.length).toBeGreaterThan(1)
  })
})
