import type { DayKey } from '@/domain/entities/day'
import { dayKeyOf } from '@/domain/entities/day'
import { DomainError } from '@/shared/errors'

/**
 * A foto do dia.
 *
 * Uma imagem por data, e é isso que transforma o calendário do perfil numa
 * linha do tempo em vez de um mapa de calor: a pessoa bate o olho em novembro
 * e lembra do treino na chuva, do café das cinco da manhã, da página que
 * terminou. O número diz que houve movimento; a foto diz qual foi.
 *
 * ## Por que o arquivo não mora na linha
 *
 * O avatar é um data URL dentro da coluna, e isso está certo pra UM arquivo de
 * ~20KB por conta. Aqui são até 365 por ano, por pessoa: guardar a imagem na
 * tabela faria cada leitura do mês arrastar megabytes e transformaria o banco
 * em servidor de arquivo. A linha guarda o CAMINHO no bucket privado, e a
 * imagem sai por link assinado, na hora de mostrar.
 *
 * ## Uma por dia
 *
 * A chave é (pessoa, dia). Escolher a segunda foto do mesmo dia TROCA a
 * primeira — não vira álbum. Álbum por dia é outro produto: pede ordem, capa,
 * navegação, e a pergunta que esta tela responde é "como foi esse dia", que
 * tem uma resposta só.
 */

export interface DayPhoto {
  readonly userId: string
  readonly day: DayKey
  /** Caminho no bucket privado: `<uid>/fotos/<id>.<ext>`. Nunca uma URL pública. */
  readonly path: string
  readonly createdAt: Date
}

export interface NewDayPhotoInput {
  readonly userId: string
  readonly day: DayKey
  readonly path: string
}

export function createDayPhoto(input: NewDayPhotoInput): DayPhoto {
  assertDayNotAhead(input.day)

  return {
    userId: input.userId,
    day: input.day,
    path: input.path,
    createdAt: new Date(),
  }
}

/**
 * Foto em dia que ainda não chegou é registro do que não aconteceu. O
 * calendário deixa os dias futuros apagados justamente por isso.
 */
export function assertDayNotAhead(day: DayKey): void {
  if (day > dayKeyOf(new Date())) {
    throw new DomainError('Dá pra guardar foto de hoje ou de um dia que já passou.')
  }
}

/** As fotos do mês por dia, pro calendário perguntar uma vez por célula. */
export function photosByDay(photos: readonly DayPhoto[]): Map<DayKey, DayPhoto> {
  return new Map(photos.map((photo) => [photo.day, photo]))
}
