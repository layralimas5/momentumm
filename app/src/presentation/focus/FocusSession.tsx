import { useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import { formatElapsed } from '@/domain/entities/timer'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { useFocus } from './use-focus'

/**
 * Modo sem distrações. Durante a sessão a tela mostra só o cronômetro, a ação e
 * três decisões: pausar, concluir, encerrar. Qualquer coisa a mais aqui é uma
 * porta de saída pra distração.
 */
export function FocusSession() {
  const focus = useFocus()
  const [pages, setPages] = useState('')

  const session = focus.session
  if (!session) return null

  const type = activityType(session.type)
  const pagesValue = Number(pages)
  const pagesAreValid = Number.isFinite(pagesValue) && pagesValue > 0
  const ratio = focus.plannedRatio

  return (
    <Dialog
      open={focus.immersive}
      fullscreen
      title={`Foco em ${session.label ?? type.label}`}
      onClose={() => focus.setImmersive(false)}
    >
      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-6 py-5">
          <span className="inline-flex items-center gap-2 text-sm text-ink-faint">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: type.colorToken }}
            />
            {type.label}
          </span>
          <button
            type="button"
            onClick={() => focus.setImmersive(false)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <Icon name="fechar" className="size-4" />
            Sair do modo sem distrações
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <p className="max-w-xl text-balance text-xl font-medium text-ink-muted sm:text-2xl">
            {session.label ?? type.label}
          </p>

          <div className="relative mt-10 grid place-items-center">
            {focus.running ? (
              <span
                aria-hidden="true"
                className="breathe absolute size-72 rounded-full bg-brand/15 blur-2xl sm:size-96"
              />
            ) : null}
            <Ring ratio={ratio} />
            <p
              role="timer"
              aria-live="off"
              className="tabular absolute text-6xl font-semibold tracking-tight text-ink sm:text-7xl"
            >
              {formatElapsed(focus.elapsed)}
            </p>
          </div>

          <p className="sr-only" aria-live="polite">
            {focus.running ? 'Sessão em andamento' : 'Sessão pausada'}
          </p>

          {session.plannedMin ? (
            <p className="tabular mt-8 text-sm text-ink-faint">
              Meta da sessão: {session.plannedMin} minutos
            </p>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {focus.running ? (
              <Button variant="secondary" size="lg" onClick={focus.pause}>
                <Icon name="pausa" className="size-4" />
                Pausar
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={focus.resume}>
                <Icon name="play" className="size-4" />
                Retomar
              </Button>
            )}

            {focus.needsValue ? null : (
              <Button
                size="lg"
                onClick={() => void focus.finish()}
                disabled={!focus.canFinish}
                loading={focus.saving}
              >
                <Icon name="check" className="size-4" />
                Concluir
              </Button>
            )}

            <Button variant="ghost" size="lg" onClick={focus.discard}>
              Encerrar sem registrar
            </Button>
          </div>

          {focus.needsValue ? (
            <form
              className="mt-6 flex w-full max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (pagesAreValid) void focus.finish(pagesValue)
              }}
            >
              <label htmlFor="focus-pages" className="sr-only">
                Páginas lidas nessa sessão
              </label>
              <input
                id="focus-pages"
                type="number"
                inputMode="numeric"
                min={1}
                value={pages}
                onChange={(event) => setPages(event.target.value)}
                placeholder="Quantas páginas você leu?"
                className="h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-ink-faint focus:border-brand"
              />
              <Button
                type="submit"
                size="lg"
                disabled={!pagesAreValid || !focus.canFinish}
                loading={focus.saving}
              >
                Concluir
              </Button>
            </form>
          ) : null}

          <div aria-live="polite" className="mt-4 min-h-6">
            {focus.error ? <p className="text-sm text-danger">{focus.error}</p> : null}
            {!focus.canFinish && !focus.error ? (
              <p className="text-sm text-ink-faint">
                A partir de um minuto a sessão pode virar registro.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

const RADIUS = 132
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Anel de progresso da duração escolhida. Alvo visual, nunca corte automático. */
function Ring({ ratio }: { ratio: number }) {
  return (
    <svg viewBox="0 0 300 300" aria-hidden="true" className="size-72 -rotate-90 sm:size-80">
      <circle
        cx="150"
        cy="150"
        r={RADIUS}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="3"
      />
      <circle
        cx="150"
        cy="150"
        r={RADIUS}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, ratio))}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  )
}
