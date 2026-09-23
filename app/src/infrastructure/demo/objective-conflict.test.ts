import { describe, expect, it } from 'vitest'
import { dayKeyOf, addDays } from '@/domain/entities/day'
import { ObjectiveAxisConflictError } from '@/domain/entities/objective'
import { DemoObjectiveRepository } from './demo-repositories'
import { DEMO_USER } from './demo-store'

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
const TODAY = dayKeyOf(new Date())

/*
  A conta demo já nasce com objetivo em leitura, estudo e treino. Os testes
  usam `meditacao`, que é o único eixo de fábrica livre — num eixo ocupado o
  primeiro `create` já falharia e o teste provaria outra coisa.
*/
function novoObjetivo(titulo: string, axis: 'meditacao' | 'leitura') {
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
