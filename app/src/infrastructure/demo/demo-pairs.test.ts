import { describe, expect, it } from 'vitest'
import { PLAN_LIMITS } from '@/domain/entities/plan'
import { DomainError } from '@/shared/errors'
import { DemoPairRepository } from './demo-pairs'

/*
  O modo demo tem que recusar o que a produção recusa.

  O perfil de demonstração é gratuito (`demo-store`), então o teto de uma dupla
  e o de um incentivo por dia valem ali igual. Divergência entre os dois
  repositórios do mesmo contrato é o começo de dois produtos saindo do mesmo
  código — e quem trabalha nas telas pelo modo demo é justamente quem não
  veria o limite antes de publicar.
*/
describe('DemoPairRepository', () => {
  it('nasce com uma dupla montada e sem vaga, como o gratuito', async () => {
    const repo = new DemoPairRepository()
    const visao = await repo.load()

    expect(visao.pairs).toHaveLength(1)
    expect(visao.max).toBe(PLAN_LIMITS.free.pairs)
    expect(visao.room).toBe(false)
  })

  it('recusa criar convite com a vaga do plano ocupada', async () => {
    const repo = new DemoPairRepository()
    await expect(repo.createInvite()).rejects.toBeInstanceOf(DomainError)
  })

  it('abre a vaga ao desfazer a dupla', async () => {
    const repo = new DemoPairRepository()
    const { pairs } = await repo.load()

    await repo.leave(pairs[0]!.id)
    const depois = await repo.load()

    expect(depois.pairs).toHaveLength(0)
    expect(depois.room).toBe(true)
    await expect(repo.createInvite()).resolves.toMatchObject({ token: expect.any(String) })
  })

  it('manda um incentivo e recusa o segundo do dia', async () => {
    const repo = new DemoPairRepository()
    const { pairs } = await repo.load()
    const id = pairs[0]!.id

    await repo.sendEncouragement(id, 'bora')
    expect((await repo.load()).pairs[0]?.encouragementsToday).toHaveLength(1)

    await expect(repo.sendEncouragement(id, 'mandou_bem')).rejects.toBeInstanceOf(DomainError)
  })

  it('reenviar o mesmo gesto não duplica nem gasta vaga', async () => {
    const repo = new DemoPairRepository()
    const { pairs } = await repo.load()
    const id = pairs[0]!.id

    await repo.sendEncouragement(id, 'bora')
    await repo.sendEncouragement(id, 'bora')

    expect((await repo.load()).pairs[0]?.encouragementsToday).toHaveLength(1)
  })

  it('não manda incentivo pra uma dupla que não é sua', async () => {
    const repo = new DemoPairRepository()
    await expect(repo.sendEncouragement('nao-existe', 'bora')).rejects.toBeInstanceOf(DomainError)
  })
})
