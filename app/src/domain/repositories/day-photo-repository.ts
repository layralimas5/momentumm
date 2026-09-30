import type { DayPhoto, NewDayPhotoInput } from '@/domain/entities/day-photo'
import type { DayKey } from '@/domain/entities/day'

/**
 * As fotos do dia, por intervalo.
 *
 * A leitura é sempre por faixa de datas porque quem pergunta é o calendário, e
 * ele mostra um mês por vez. Carregar o álbum inteiro pra desenhar trinta
 * células seria trazer anos de linha pra usar trinta.
 *
 * O ARQUIVO não passa por aqui: quem sobe e assina imagem é o
 * `MediaRepository`, que já tem o bucket, o limite de tamanho e o link
 * temporário. Aqui mora só o vínculo entre um dia e um caminho.
 */
export interface DayPhotoRepository {
  listBetween(userId: string, from: DayKey, to: DayKey): Promise<DayPhoto[]>
  /** Grava ou troca a foto do dia. Uma por dia: a segunda substitui a primeira. */
  save(input: NewDayPhotoInput): Promise<DayPhoto>
  remove(userId: string, day: DayKey): Promise<void>
}
