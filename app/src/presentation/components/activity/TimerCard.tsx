import { useState } from 'react'
import type { NewActivityInput } from '@/domain/entities/activity'
import { ACTIVITY_TYPE_LIST, activityType } from '@/domain/entities/activity-type'
import { formatElapsed } from '@/domain/entities/timer'
import { Button } from '@/presentation/components/ui/Button'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useTimer } from '@/presentation/hooks/use-timer'
import { cn } from '@/shared/lib/cn'

interface TimerCardProps {
  readonly onLog: (input: Omit<NewActivityInput, 'userId'>) => Promise<void>
}

/**
 * O outro caminho da fricção zero: quem estuda ou lê com o app aberto não
 * precisa lembrar do relógio. A sessão sobrevive a recarregar a página.
 */
export function TimerCard({ onLog }: TimerCardProps) {
  const timer = useTimer({ onLog })
  const [pages, setPages] = useState('')

  const finish = useAsyncAction(async (value: number | undefined) => {
    await timer.finish(value === undefined ? {} : { value })
    setPages('')
  })

  const session = timer.session

  if (!session) {
    return (
      <section aria-labelledby="cronometro" className="rounded-card border border-line bg-surface p-5">
        <h2 id="cronometro" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          Cronômetro
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Começa a sessão e deixa rodando. No fim, o tempo já vira registro.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIVITY_TYPE_LIST.map((type) => (
            <button
              key={type.slug}
              type="button"
              onClick={() => timer.start(type.slug)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm font-medium text-ink-muted transition-colors hover:border-line-hi hover:text-ink"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: type.colorToken }}
              />
              {type.label}
            </button>
          ))}
        </div>
      </section>
    )
  }

  const type = activityType(session.type)
  const askPages = timer.needsValue
  const pagesValue = Number(pages)
  const pagesAreValid = Number.isFinite(pagesValue) && pagesValue > 0

  return (
    <section
      aria-labelledby="cronometro"
      className="rounded-card border bg-surface p-5"
      style={{ borderColor: type.colorToken }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="cronometro" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {type.label} em andamento
        </h2>
        <span
          className="inline-flex items-center gap-2 text-xs text-ink-faint"
          aria-hidden="true"
        >
          <span
            className={cn('size-2 rounded-full', timer.running && 'animate-pulse')}
            style={{ backgroundColor: timer.running ? type.colorToken : 'var(--color-ink-faint)' }}
          />
          {timer.running ? 'correndo' : 'pausado'}
        </span>
      </div>

      <p
        role="timer"
        aria-live="off"
        className="tabular mt-3 text-5xl font-semibold tracking-tight text-ink"
      >
        {formatElapsed(timer.elapsed)}
      </p>
      <p className="sr-only" aria-live="polite">
        {timer.running ? 'Cronômetro correndo' : 'Cronômetro pausado'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {timer.running ? (
          <Button variant="secondary" onClick={timer.pause}>
            Pausar
          </Button>
        ) : (
          <Button variant="secondary" onClick={timer.resume}>
            Retomar
          </Button>
        )}

        {askPages ? null : (
          <Button
            onClick={() => void finish.run(undefined)}
            disabled={!timer.ready}
            loading={finish.running}
          >
            Encerrar e registrar
          </Button>
        )}

        <Button variant="ghost" onClick={timer.discard}>
          Descartar
        </Button>
      </div>

      {askPages ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (pagesAreValid) void finish.run(pagesValue)
          }}
        >
          <label htmlFor="timer-pages" className="sr-only">
            Páginas lidas nessa sessão
          </label>
          <input
            id="timer-pages"
            type="number"
            inputMode="numeric"
            min={1}
            value={pages}
            onChange={(event) => setPages(event.target.value)}
            placeholder="Páginas lidas nessa sessão"
            className="h-11 flex-1 rounded-xl border border-line bg-surface-hi px-3 text-ink placeholder:text-ink-faint focus:border-brand"
          />
          <Button type="submit" disabled={!pagesAreValid || !timer.ready} loading={finish.running}>
            Registrar
          </Button>
        </form>
      ) : null}

      <div aria-live="polite" className="min-h-6">
        {finish.error ? <p className="mt-2 text-sm text-danger">{finish.error}</p> : null}
        {!timer.ready && !finish.error ? (
          <p className="mt-2 text-sm text-ink-faint">
            A partir de um minuto a sessão pode virar registro.
          </p>
        ) : null}
      </div>
    </section>
  )
}
