import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { cn } from '@/shared/lib/cn'
import { Mascot } from '@/presentation/mascot/Mascot'
import { EASE_ENTER } from './quiz-motion'

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
  /**
   * Segundos até o botão aparecer. Em tela de leitura e de comemoração o
   * botão espera a animação terminar: aparecer antes é convite pra pular a
   * única coisa que a tela tem pra mostrar.
   */
  readonly footerDelay?: number
  /** Troca a cada tela, pra o atraso valer de novo na tela seguinte. */
  readonly footerKey?: string | number
}

export function QuizShell({
  children,
  footer,
  progress,
  progressLabel,
  tallFooter = false,
  footerDelay = 0,
  footerKey,
}: QuizShellProps) {
  const reduced = useReducedMotion()
  const waits = footerDelay > 0 && !reduced
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-brand/12 blur-[120px]"
      />

      {/*
        Logo no centro; o contador de perguntas fica na ponta sem tirar a logo
        do eixo. `pt-safe` só garante o notch, a folga do topo vem da margem,
        senão a marca encosta na borda da janela no navegador, onde a área
        segura é zero.
      */}
      <header className="relative mx-auto mt-4 grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center px-4 pt-safe sm:mt-8 sm:px-6">
        <span aria-hidden="true" />
        <Link to="/" aria-label="Momentumm" className="rounded-lg py-2">
          <Wordmark className="w-36" />
        </Link>
        {progress !== undefined ? (
          <span className="justify-self-end text-xs tabular-nums text-ink-faint">{progressLabel}</span>
        ) : null}
      </header>

      {progress !== undefined ? (
        <div className="relative mx-auto mt-2 w-full max-w-lg px-4 sm:px-6">
          <div className="relative">
            <ProgressHead progress={progress} />
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
        </div>
      ) : null}

      <main
        id="conteudo"
        className={cn(
          'relative mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-5 sm:px-6 sm:pt-6',
          footer ? (tallFooter ? 'pb-44' : 'pb-32') : 'pb-10',
        )}
      >
        {children}
      </main>

      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line/60 bg-canvas/85 backdrop-blur">
          <motion.div
            key={footerKey}
            initial={waits ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: footerDelay, ease: EASE_ENTER }}
            className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 pt-3 pb-safe sm:px-6"
          >
            {footer}
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * O Momo de bolso na ponta da barra, no lugar da nuvem que a Cláudia põe
 * ali. Anda junto com o preenchimento e, a cada avanço, dá um estalo e solta
 * um anel: é a resposta visual de "isso contou".
 */
function ProgressHead({ progress }: { readonly progress: number }) {
  const reduced = useReducedMotion()
  const left = `calc(${Math.max(4, progress * 100)}% - 0.75rem)`
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 z-10 -mt-3.5 grid size-6 place-items-center"
      initial={false}
      animate={{ left }}
      transition={{ duration: reduced ? 0 : 0.5, ease: EASE_ENTER }}
    >
      {reduced ? null : (
        <motion.span
          key={progress}
          className="absolute inset-1 rounded-full border-2 border-brand-hi"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.2, 0.6, 0.4, 1] }}
        />
      )}
      <Mascot size={24} mini gesture={{ kind: 'pop', key: progress }} />
    </motion.span>
  )
}
