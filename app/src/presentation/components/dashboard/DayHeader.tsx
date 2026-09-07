import { dayKeyToDate, type DayKey } from '@/domain/entities/day'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'

/**
 * A abertura do dia: quem, quando e em que pé o dia está.
 *
 * A frase abaixo da saudação descreve o estado REAL — "continue de onde você
 * parou", "você concluiu tudo que planejou". Nada de motivação genérica: uma
 * frase que serviria pra qualquer pessoa em qualquer dia gasta a linha mais
 * lida da tela sem dizer nada.
 *
 * O progresso do dia saiu daqui: ele vive dentro do foco de hoje, ao lado das
 * atividades que o compõem. Um número de progresso longe do que ele mede
 * obriga a pessoa a procurar a origem.
 */
export function DayHeader({
  name,
  today,
  headline,
  resumeNote,
  overdue = 0,
  onReviewOverdue,
  compact = false,
}: {
  readonly name: string | null
  readonly today: DayKey
  readonly headline: string
  readonly resumeNote: string | null
  /** Ações em aberto com dia vencido. Vira um aviso curto, nunca um alarme. */
  readonly overdue?: number
  readonly onReviewOverdue?: () => void
  /**
   * No celular a barra de cima já traz saudação e data. Repetir as duas aqui
   * empurraria o conteúdo do dia pra baixo da dobra sem informação nova.
   */
  readonly compact?: boolean
}) {
  const date = dayKeyToDate(today)
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  return (
    <header className="flex flex-col gap-3">
      {/*
        No celular a barra de cima já dá saudação e data, mas não a frase de
        contexto — e é ela que diz em que pé o dia está. Some o cabeçalho,
        fica a frase.
      */}
      {compact ? (
        <p className="text-[0.95rem] text-ink-muted">{headline}</p>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ''}.
          </h2>
          <p className="mt-1.5 text-[0.95rem] text-ink-muted">{headline}</p>
          <p className="mt-0.5 text-sm text-ink-faint first-letter:uppercase">{formatted}</p>
        </div>
      )}

      {/*
        Atraso em uma linha, com a saída ao lado.

        Vermelho ocupando a tela não faz ninguém reorganizar nada — faz fechar o
        app. O aviso diz o tamanho do problema e oferece o caminho, e só.
      */}
      {overdue > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Icon name="adiar" className="size-4 shrink-0 text-ink-faint" />
            Você tem {overdue} {overdue === 1 ? 'ação atrasada' : 'ações atrasadas'}. Vamos
            reorganizar?
          </p>
          {onReviewOverdue ? (
            <Button size="sm" variant="secondary" onClick={onReviewOverdue}>
              Revisar
            </Button>
          ) : null}
        </div>
      ) : null}

      {resumeNote ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink-muted">
          <Icon name="desfazer" className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <span className="text-pretty">{resumeNote}</span>
        </p>
      ) : null}
    </header>
  )
}

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
