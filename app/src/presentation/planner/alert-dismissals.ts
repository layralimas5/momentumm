import type { DayKey } from '@/domain/entities/day'

const KEY = 'momentumm.alertas.dispensados.v1'

interface Stored {
  readonly day: string
  readonly ids: readonly string[]
}

/**
 * Os recados que a pessoa já leu hoje.
 *
 * Um aviso que não some depois de lido vira mobília: no segundo dia o olho
 * pula, no terceiro a tela inteira perde autoridade. Dispensar é o que
 * devolve significado ao que continua ali.
 *
 * ## Por que a marca é POR DIA
 *
 * Dispensar "2 ações atrasadas" não resolve as duas ações, resolve o RECADO
 * sobre elas, que já foi lido. Amanhã, se elas continuarem atrasadas, o recado
 * volta: o problema não é o aviso, é o atraso, e esconder um problema para
 * sempre porque alguém o viu uma vez seria o app mentindo por educação.
 *
 * E se a pessoa resolver o que foi avisado, o recado nem chega a voltar, ele
 * nasce do estado real, não de uma fila de notificações.
 *
 * A marca fica no navegador, não no servidor: é conveniência de aparelho, não
 * estado da conta. No pior caso, ver o mesmo recado outra vez em outro
 * aparelho.
 */
export function dismissedAlerts(today: DayKey): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return new Set()

    const parsed = JSON.parse(raw) as Partial<Stored>
    // Virou o dia: a lista de ontem não vale mais, e nem precisa ser apagada,
    // a próxima gravação sobrescreve.
    if (parsed.day !== today || !Array.isArray(parsed.ids)) return new Set()

    return new Set(parsed.ids.filter((id): id is string => typeof id === 'string'))
  } catch {
    // Navegador anônimo ou storage bloqueado: sem marca, os recados aparecem.
    return new Set()
  }
}

export function dismissAlert(today: DayKey, id: string): ReadonlySet<string> {
  return store(today, new Set(dismissedAlerts(today)).add(id))
}

/**
 * Limpar tudo, de uma vez.
 *
 * O sino junta o que sobrou, e limpar um por um uma lista de seis é trabalho
 * que ninguém faz: ou some tudo, ou a pessoa fecha o sino com a bolinha ainda
 * acesa. Vale pelo dia, como cada um deles.
 */
export function dismissAllAlerts(today: DayKey, ids: readonly string[]): ReadonlySet<string> {
  const next = new Set(dismissedAlerts(today))
  for (const id of ids) next.add(id)
  return store(today, next)
}

function store(today: DayKey, next: ReadonlySet<string>): ReadonlySet<string> {
  try {
    const payload: Stored = { day: today, ids: [...next] }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Não poder lembrar não é motivo pra quebrar a tela: o recado some agora e
    // volta no próximo carregamento, que é melhor do que um erro.
  }

  return next
}
