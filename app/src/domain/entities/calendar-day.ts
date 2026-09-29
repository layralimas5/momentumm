import type { DayKey } from './day'

/**
 * A célula do calendário visual.
 *
 * Este é o coração da tela: conforme a pessoa registra a rotina, o mês vai se
 * preenchendo de fotos, e depois de algumas semanas o calendário deixa de ser
 * um controle e vira um álbum da evolução dela. Um mapa de calor diria a mesma
 * coisa em menos espaço — dia aceso, dia apagado — e ninguém sente saudade de
 * um quadradinho verde.
 *
 * ## Os quatro estados, em ordem de força
 *
 *   publicacao  publicou com foto naquele dia. A célula É a foto.
 *   album       guardou uma foto no dia, sem publicar (o álbum da 0060).
 *   movimento   não tem imagem, mas o dia andou: atividade, hábito ou ação.
 *   vazio       nada.
 *
 * A ordem importa e é sempre a mesma: a publicação ganha do álbum porque ela é
 * o registro que tem legenda, objetivo e conversa em volta. O álbum não foi
 * jogado fora, ele continua sendo a resposta pros dias em que a pessoa quis
 * guardar sem contar.
 *
 * ## Dia vazio não é punição
 *
 * `vazio` é uma célula neutra: mesmo tom do fundo, número discreto, nenhum
 * vermelho, nenhum risco, nenhuma contagem de "dias perdidos". O calendário
 * mostra o que aconteceu, e a ausência de um dia num mês cheio já diz o que
 * tem pra dizer sem que o app precise apontar o dedo.
 */

export type CalendarCellKind = 'publicacao' | 'album' | 'movimento' | 'vazio'

export interface CalendarCell {
  readonly day: DayKey
  readonly kind: CalendarCellKind
  /** Caminho no bucket da imagem que ilustra o dia. `null` nos dois últimos estados. */
  readonly coverPath: string | null
  /** A publicação que a célula abre. `null` quando a imagem vem do álbum. */
  readonly postId: string | null
  /** Quantas publicações existem nesse dia. Acima de 1 a célula mostra o sinal. */
  readonly postCount: number
  readonly inMonth: boolean
  readonly isToday: boolean
  /** Dia que ainda não chegou: não é tocável, e não tem o que registrar. */
  readonly ahead: boolean
}

/** O que o servidor devolve por dia (função `profile_calendar`). */
export interface CalendarEntry {
  readonly day: DayKey
  readonly postId: string | null
  readonly coverPath: string | null
  readonly total: number
  readonly fromAlbum: boolean
}

/**
 * A grade pronta, a partir dos dias e das três fontes.
 *
 * É uma função pura, e é por isso que ela mora aqui: a decisão "qual estado
 * este dia tem" é a regra do produto, e testá-la não pode depender de montar
 * um componente e um servidor.
 */
export function buildCalendar(
  days: readonly DayKey[],
  month: DayKey,
  today: DayKey,
  entries: ReadonlyMap<DayKey, CalendarEntry>,
  movedDays: ReadonlySet<DayKey>,
): CalendarCell[] {
  const monthPrefix = month.slice(0, 7)

  return days.map((day) => {
    const entry = entries.get(day)
    const base = {
      day,
      inMonth: day.slice(0, 7) === monthPrefix,
      isToday: day === today,
      ahead: day > today,
    } as const

    const cover = entry?.coverPath ?? null
    const postId = entry?.postId ?? null

    /*
      O estado sai do que EXISTE, não de onde a imagem veio.

      Um dia pode ter publicação de texto e foto guardada no álbum ao mesmo
      tempo, e antes essa combinação caía em "album": a célula abria a folha da
      foto e escondia a publicação. Agora quem decide o que a célula ABRE é o
      `postId`, e quem decide o que ela MOSTRA é o `coverPath`, que são duas
      perguntas diferentes.
    */
    if (cover && postId) {
      return {
        ...base,
        kind: 'publicacao' as const,
        coverPath: cover,
        postId,
        postCount: entry?.total ?? 1,
      }
    }

    if (cover) {
      return { ...base, kind: 'album' as const, coverPath: cover, postId: null, postCount: 0 }
    }

    /*
      Publicação sem foto nenhuma ainda é um dia que andou. Ela chega aqui com
      `coverPath` nulo e cai em `movimento`, que é exatamente o que ela
      significa: teve registro, não teve imagem. A célula continua abrindo a
      publicação.
    */
    if (postId || movedDays.has(day)) {
      return {
        ...base,
        kind: 'movimento' as const,
        coverPath: null,
        postId,
        postCount: entry?.total ?? 0,
      }
    }

    return { ...base, kind: 'vazio' as const, coverPath: null, postId: null, postCount: 0 }
  })
}

/** Quantos dias do mês têm imagem. É a frase que resume o mês em cima da grade. */
export function filledCount(cells: readonly CalendarCell[]): number {
  return cells.filter((cell) => cell.inMonth && cell.coverPath !== null).length
}

/**
 * A frase do mês, e ela nunca cobra.
 *
 * "Você registrou 12 dias" conta o que houve. "Faltaram 18 dias" conta o que
 * não houve, e é a mesma informação lida como falha — num produto sobre
 * retomar o ritmo, essa segunda leitura é a que faz a pessoa fechar o app.
 */
export function monthSummary(cells: readonly CalendarCell[]): string {
  const withImage = filledCount(cells)
  const moved = cells.filter((cell) => cell.inMonth && cell.kind === 'movimento').length

  if (withImage === 0 && moved === 0) return 'Nenhum registro neste mês ainda.'
  if (withImage === 0) return moved === 1 ? '1 dia em movimento' : `${moved} dias em movimento`

  const fotos = withImage === 1 ? '1 dia com foto' : `${withImage} dias com foto`
  return moved > 0 ? `${fotos} · ${moved} em movimento` : fotos
}
