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
 *
 * A data também saiu: o cabeçalho do app já a mostra no monitor, e a barra de
 * cima no celular. A mesma terça-feira escrita duas vezes a 150px de distância
 * não é redundância inofensiva — é uma linha a mais entre a saudação e a ação
 * do dia.
 */
export function DayHeader({
  name,
  headline,
  resumeNote,
  overdue = 0,
  onReviewOverdue,
  compact = false,
}: {
  readonly name: string | null
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
  return (
    <header className="flex flex-col gap-3">
      {/*
        No celular a barra de cima já dá saudação e data, mas não a frase de
        contexto — e é ela que diz em que pé o dia está. Some o cabeçalho,
        fica a frase.
      */}
      {/*
        No celular a frase de contexto saiu: a faixa da semana diz em que dia a
        pessoa está e os três números dizem em que pé o dia está. "Seu plano de
        hoje está pronto" era uma linha a mais antes do que importa.
      */}
      {compact ? null : (
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ''}.
          </h2>
          <p className="mt-1.5 text-[0.95rem] text-ink-muted">{headline}</p>
        </div>
      )}

      {/*
        Atraso em uma linha, com a saída ao lado.

        Vermelho ocupando a tela não faz ninguém reorganizar nada — faz fechar o
        app. O aviso diz o tamanho do problema e oferece o caminho, e só.
      */}
      {overdue > 0 ? (
        compact && onReviewOverdue ? (
          /*
            No celular o botão ao lado do texto quebrava pra uma segunda linha
            e o aviso virava um bloco de duas alturas antes do que importa. A
            linha inteira vira o alvo: mesmo destino, metade do espaço.
          */
          <button
            type="button"
            onClick={onReviewOverdue}
            className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors active:bg-surface-hi"
          >
            <Icon name="adiar" className="size-4 shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1 text-sm text-ink-muted">
              {overdue} {overdue === 1 ? 'ação atrasada' : 'ações atrasadas'}. Dá pra reorganizar.
            </span>
            <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
          </button>
        ) : (
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
        )
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
