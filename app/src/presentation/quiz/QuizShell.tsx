import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { cn } from '@/shared/lib/cn'

/**
 * A casca do quiz: logo em cima, conteúdo no meio, e os botões numa barra
 * fixa embaixo, na altura do polegar. A barra fica fora da rolagem pra o
 * CTA continuar visível com o teclado aberto e em tela baixa.
 */
interface QuizShellProps {
  readonly children: ReactNode
  /** A barra de baixo. Sem ela o conteúdo ocupa a tela inteira. */
  readonly footer?: ReactNode
  /** Barra de progresso de 0 a 1. Ausente na intro e no resultado. */
  readonly progress?: number
  readonly progressLabel?: string
  /** Rodapé com dois botões empilhados precisa de mais folga embaixo. */
  readonly tallFooter?: boolean
}

export function QuizShell({ children, footer, progress, progressLabel, tallFooter = false }: QuizShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-brand/12 blur-[120px]"
      />

      {/* Logo no centro; o contador de perguntas fica na ponta sem tirar a logo do eixo. */}
      <header className="relative mx-auto grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center px-4 pt-safe sm:px-6">
        <span aria-hidden="true" />
        <Link to="/" aria-label="Momentumm" className="rounded-lg py-2">
          <Wordmark className="w-28" />
        </Link>
        {progress !== undefined ? (
          <span className="justify-self-end text-xs tabular-nums text-ink-faint">{progressLabel}</span>
        ) : null}
      </header>

      {progress !== undefined ? (
        <div className="relative mx-auto mt-2 w-full max-w-lg px-4 sm:px-6">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Progresso do quiz"
            className="h-1 overflow-hidden rounded-full bg-surface-top"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <main
        id="conteudo"
        className={cn(
          'relative mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 sm:px-6 sm:pt-8',
          footer ? (tallFooter ? 'pb-44' : 'pb-32') : 'pb-10',
        )}
      >
        {children}
      </main>

      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 pt-3 pb-safe sm:px-6">
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  )
}
