import { useEffect, useMemo, useState } from 'react'
import { buildCalendar, type CalendarCell, type CalendarEntry } from '@/domain/entities/calendar-day'
import { addDays, type DayKey } from '@/domain/entities/day'
import { addMonths, monthGridDays } from '@/domain/entities/month'
import { container } from '@/infrastructure/container'
import { toUserMessage } from '@/shared/errors'
import { useSocialRevision } from './PostComposerProvider'
import { signedUrl } from './use-signed-media'

export interface CalendarView {
  readonly cells: readonly CalendarCell[]
  /** A URL pronta de cada capa, por dia. Vazia enquanto o link não chegou. */
  readonly covers: ReadonlyMap<DayKey, string>
  readonly loading: boolean
  readonly error: string | null
  reload(): void
}

/**
 * O mês do calendário visual, pronto pra desenhar.
 *
 * Três coisas se juntam aqui, e elas vêm de lugares diferentes de propósito:
 *
 *   as PUBLICAÇÕES  do servidor, com a capa e a contagem por dia.
 *   o ÁLBUM         do mesmo servidor, como reserva dos dias sem publicação.
 *   o MOVIMENTO     do `PlannerProvider`, que já tem atividade, hábito e ação
 *                   carregados. Perguntar isso de novo ao banco seria uma
 *                   segunda conta de "esse dia andou", divergindo da primeira
 *                   no dia em que uma das duas mudasse.
 *
 * ## As imagens vêm em rajada
 *
 * Trinta links assinados de uma vez, na abertura do mês, em vez de trinta
 * esperas espalhadas: a grade aparece inteira em vez de ir se preenchendo
 * célula a célula. Falha em uma não derruba as outras — aquele dia fica sem
 * imagem e continua marcado, porque foto quebrada é pior que dia sem foto.
 *
 * ## Dois buckets, e o motivo importa
 *
 * A capa de uma publicação mora em `social-media`, onde a leitura é liberada
 * pela publicação. A foto do álbum mora em `user-media`, onde só o dono lê. É
 * por isso que `fromAlbum` decide quem assina.
 */
export function useCalendar(
  userId: string | null,
  month: DayKey,
  today: DayKey,
  movedDays: ReadonlySet<DayKey>,
): CalendarView {
  const revision = useSocialRevision()
  const [entries, setEntries] = useState<readonly CalendarEntry[]>([])
  const [covers, setCovers] = useState<ReadonlyMap<DayKey, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  /* O mês inteiro, e não a grade: a grade traz dias dos meses vizinhos, e
     pedir as fotos deles encheria a tela de imagem que não é daquele mês. */
  const from = month
  const to = useMemo(() => addDays(addMonths(month, 1), -1), [month])

  useEffect(() => {
    if (!userId) {
      setEntries([])
      setCovers(new Map())
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)

    void container.social
      .calendar(userId, from, to)
      .then(async (list) => {
        if (!alive) return
        setEntries(list)

        const pairs = await Promise.all(
          list
            .filter((entry) => entry.coverPath !== null)
            .map(async (entry) => {
              try {
                const url = await signedUrl(
                  entry.coverPath as string,
                  entry.fromAlbum ? 'album' : 'social',
                )
                return [entry.day, url] as const
              } catch {
                return null
              }
            }),
        )

        if (!alive) return
        setCovers(new Map(pairs.filter((pair): pair is readonly [DayKey, string] => pair !== null)))
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [userId, from, to, revision, tick])

  const cells = useMemo(() => {
    const byDay = new Map(entries.map((entry) => [entry.day, entry]))
    return buildCalendar(monthGridDays(month), month, today, byDay, movedDays)
  }, [entries, month, today, movedDays])

  return {
    cells,
    covers,
    loading,
    error,
    reload: () => setTick((value) => value + 1),
  }
}
