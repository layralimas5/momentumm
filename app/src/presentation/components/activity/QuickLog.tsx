import { useState } from 'react'
import { motion } from 'framer-motion'
import type { NewActivityInput } from '@/domain/entities/activity'
import type { ActivityType } from '@/domain/entities/activity-type'
import { Button } from '@/presentation/components/ui/Button'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

interface QuickLogProps {
  readonly onLog: (input: Omit<NewActivityInput, 'userId'>) => Promise<void>
}

/**
 * A mecânica número 1 do produto: registrar em dois toques. Escolhe o eixo,
 * toca no valor, acabou. O campo livre existe, mas ninguém é obrigado a usar.
 */
export function QuickLog({ onLog }: QuickLogProps) {
  const { axes } = usePlanner()
  const [slug, setSlug] = useState<string>(axes[0]?.slug ?? 'leitura')

  // A área escolhida pode ter sido apagada em outra aba: cai na primeira.
  const type: ActivityType = axes.find((item) => item.slug === slug) ?? (axes[0] as ActivityType)
  const [custom, setCustom] = useState('')
  const [justLogged, setJustLogged] = useState<number | null>(null)

  const action = useAsyncAction(async (value: number) => {
    await onLog({ type: type.slug, value })
    setJustLogged(value)
    setCustom('')
    window.setTimeout(() => setJustLogged(null), 1600)
  })

  const customValue = Number(custom)
  const customIsValid = Number.isFinite(customValue) && customValue > 0

  return (
    <section aria-labelledby="registro-rapido" className="rounded-card border border-line bg-surface p-5">
      <h2 id="registro-rapido" className="text-sm font-medium tracking-wide text-ink-muted uppercase">
        Registrar agora
      </h2>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Eixo">
        {axes.map((item) => {
          const selected = item.slug === type.slug
          return (
            <button
              key={item.slug}
              type="button"
              onClick={() => setSlug(item.slug)}
              aria-pressed={selected}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'border-transparent text-canvas'
                  : 'border-line text-ink-muted hover:border-line-hi hover:text-ink',
              )}
              style={selected ? { backgroundColor: item.colorToken } : undefined}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {type.quickValues.map((value) => (
          <Button
            key={value}
            variant="secondary"
            onClick={() => void action.run(value)}
            disabled={action.running}
            className="tabular"
          >
            {value} {type.unit === 'paginas' ? 'pág' : 'min'}
          </Button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (customIsValid) void action.run(customValue)
        }}
      >
        <label htmlFor="quick-log-custom" className="sr-only">
          Outro valor em {type.unitLabel.many}
        </label>
        <input
          id="quick-log-custom"
          type="number"
          inputMode="numeric"
          min={1}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={`Outro valor em ${type.unitLabel.many}`}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-hi px-3 text-ink placeholder:text-ink-faint focus:border-brand"
        />
        <Button type="submit" disabled={!customIsValid} loading={action.running}>
          Salvar
        </Button>
      </form>

      <div aria-live="polite" className="min-h-6">
        {action.error ? <p className="mt-2 text-sm text-danger">{action.error}</p> : null}
        {justLogged !== null ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-positive"
          >
            {type.verb} {justLogged} {justLogged === 1 ? type.unitLabel.one : type.unitLabel.many}.
            Registrado.
          </motion.p>
        ) : null}
      </div>
    </section>
  )
}
