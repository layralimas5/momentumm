import { beforeAll, describe, expect, it } from 'vitest'
import { addDays, dayKeyOf } from '@/domain/entities/day'
import { requiredDays, type Challenge } from '@/domain/entities/challenge'
import { DomainError } from '@/shared/errors'
import { DemoChallengeRepository } from './demo-repositories'
import { DEMO_PEOPLE, DEMO_USER } from './demo-store'

/**
 * O fluxo inteiro pelo modo demo.
 *
 * É o teste mais próximo do que a tela faz: criar, convidar, aceitar, recusar,
 * publicar e encerrar, passando pelo mesmo repositório que o `container`
 * entrega à apresentação. Sem `localStorage` no ambiente de teste o store cai
 * em memória sozinho — que é justamente o caminho que o app usa quando o
 * navegador bloqueia o armazenamento.
 */

const repository = new DemoChallengeRepository()
const AMIGA = DEMO_PEOPLE[0]?.id ?? ''
const AMIGO = DEMO_PEOPLE[1]?.id ?? ''

const today = dayKeyOf(new Date())
let challenge: Challenge

beforeAll(async () => {
  const created = await repository.create({
    ownerId: DEMO_USER.id,
    name: 'Ler 30 minutos por dia',
    axis: 'leitura',
    mode: 'diaria',
    startsOn: today,
    endsOn: addDays(today, 13),
    dailyTarget: 30,
  })

  challenge = created.challenge
})

describe('criar', () => {
  it('coloca o dono dentro na mesma operação', async () => {
    const participants = await repository.listParticipants([challenge.id])
    const owner = participants.find((item) => item.userId === DEMO_USER.id)

    expect(owner?.status).toBe('ativo')
    expect(owner?.joinedAt).not.toBeNull()
    expect(owner?.doneDays).toBe(0)
  })

  it('no modo diário a meta é a janela: catorze dias, catorze exigidos', () => {
    expect(requiredDays(challenge)).toBe(14)
  })

  it('aparece pra quem participa', async () => {
    const mine = await repository.listByUser(DEMO_USER.id)
    expect(mine.map((item) => item.id)).toContain(challenge.id)
  })

  it('não aparece pra quem não foi convidado', async () => {
    const theirs = await repository.listByUser('user-estranho')
    expect(theirs.map((item) => item.id)).not.toContain(challenge.id)
  })
})

describe('convite', () => {
  it('nasce esperando resposta, e a mesma pessoa não entra duas vezes', async () => {
    const invited = await repository.invite(challenge.id, DEMO_USER.id, AMIGA)

    expect(invited.status).toBe('convidado')
    expect(invited.joinedAt).toBeNull()

    await expect(repository.invite(challenge.id, DEMO_USER.id, AMIGA)).rejects.toThrow(
      DomainError,
    )
  })

  it('aceitar carimba a entrada; recusar não', async () => {
    const convidada = await repository.invite(challenge.id, DEMO_USER.id, AMIGO)

    const aceita = await repository.respond(convidada.id, AMIGO, true)
    expect(aceita.status).toBe('ativo')
    expect(aceita.joinedAt).not.toBeNull()

    const outra = (await repository.listParticipants([challenge.id])).find(
      (item) => item.userId === AMIGA,
    )
    const recusada = await repository.respond(outra?.id ?? '', AMIGA, false)
    expect(recusada.status).toBe('recusado')
    expect(recusada.joinedAt).toBeNull()
  })

  it('ninguém responde por outra pessoa', async () => {
    const rows = await repository.listParticipants([challenge.id])
    const alheia = rows.find((item) => item.userId === AMIGO)

    await expect(repository.respond(alheia?.id ?? '', DEMO_USER.id, true)).rejects.toThrow(
      DomainError,
    )
  })
})

describe('publicar o avanço', () => {
  it('grava os dias e a conclusão de quem publicou', async () => {
    const rows = await repository.listParticipants([challenge.id])
    const me = rows.find((item) => item.userId === DEMO_USER.id)

    const parcial = await repository.publishProgress(me?.id ?? '', DEMO_USER.id, 7, false)
    expect(parcial.doneDays).toBe(7)
    expect(parcial.completedAt).toBeNull()

    const fechado = await repository.publishProgress(me?.id ?? '', DEMO_USER.id, 14, true)
    expect(fechado.doneDays).toBe(14)
    expect(fechado.completedAt).not.toBeNull()
  })

  it('não deixa publicar em nome de outra pessoa', async () => {
    const rows = await repository.listParticipants([challenge.id])
    const alheia = rows.find((item) => item.userId === AMIGO)

    await expect(
      repository.publishProgress(alheia?.id ?? '', DEMO_USER.id, 14, true),
    ).rejects.toThrow(DomainError)
  })
})

describe('sair e encerrar', () => {
  it('sair marca a linha em vez de apagá-la', async () => {
    const rows = await repository.listParticipants([challenge.id])
    const dele = rows.find((item) => item.userId === AMIGO)

    await repository.leave(dele?.id ?? '', AMIGO)

    const depois = await repository.listParticipants([challenge.id])
    expect(depois.find((item) => item.userId === AMIGO)?.status).toBe('saiu')
  })

  it('encerrar carimba a data e o desafio para de rodar', async () => {
    const closed = await repository.update(challenge.id, DEMO_USER.id, {
      completedAt: new Date(),
    })

    expect(closed.completedAt).not.toBeNull()
  })
})
