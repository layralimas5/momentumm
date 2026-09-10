import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BUILTIN_ACTIVITY_TYPE_LIST,
  formatUnit,
  type ActivityType,
  type ActivityTypeSlug,
} from '@/domain/entities/activity-type'
import { cn } from '@/shared/lib/cn'
import { MockCard, MockHeader, PhoneMockup } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * O único momento interativo da página.
 *
 * Duas seções de mockup passivo diziam "funciona pra qualquer área" com print
 * parado. Aqui a pessoa troca a área e registra de verdade: é o argumento da
 * arquitetura (uma unidade só, a atividade) sendo demonstrado em vez de
 * descrito.
 *
 * Os controles ficam FORA da moldura do celular de propósito: o PhoneMockup é
 * `aria-hidden`, então nada clicável pode morar lá dentro.
 */

/** Meta diária de exemplo, na unidade primária de cada área. */
const DAILY_GOAL: Readonly<Record<ActivityTypeSlug, number>> = {
  leitura: 20,
  estudo: 45,
  treino: 30,
  meditacao: 10,
}

const AXES = BUILTIN_ACTIVITY_TYPE_LIST

interface Entry {
  readonly id: number
  readonly value: number
}

type Log = Readonly<Record<ActivityTypeSlug, readonly Entry[]>>

const EMPTY_LOG: Log = Object.fromEntries(AXES.map((type) => [type.slug, []]))

export function AxisPlayground() {
  const [slug, setSlug] = useState<ActivityTypeSlug>(AXES[0]?.slug ?? 'leitura')
  const [log, setLog] = useState<Log>(EMPTY_LOG)

  const type = useMemo(() => AXES.find((item) => item.slug === slug) ?? AXES[0], [slug])
  const entries = log[slug] ?? []
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)

  if (!type) return null

  const goal = DAILY_GOAL[type.slug] ?? 30
  const progress = Math.min(total / goal, 1)
  const touched = entries.length > 0

  function register(value: number): void {
    setLog((current) => ({
      ...current,
      [slug]: [{ id: Date.now(), value }, ...(current[slug] ?? [])].slice(0, 4),
    }))
  }

  return (
    <Section id="eixos" className="border-t border-line">
      <SectionHeading
        eyebrow="Na prática"
        title="Troca a área. A tela é a mesma."
        description="Área nova não é módulo novo: é uma linha a mais. Registra aqui e vê o histórico, a meta e a sequência funcionando igual pros quatro."
      />

      <div className="mt-12 grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <div>
            <fieldset>
              <legend className="text-sm font-medium text-ink">1. Escolhe a área</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {AXES.map((axis) => (
                  <AxisChip
                    key={axis.slug}
                    type={axis}
                    active={axis.slug === slug}
                    onSelect={() => setSlug(axis.slug)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-8">
              <legend className="text-sm font-medium text-ink">2. Quanto você fez hoje?</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {type.quickValues.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => register(value)}
                    className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink transition-colors hover:border-line-hi hover:bg-surface-hi"
                  >
                    {formatUnit(type, value)}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="mt-6 text-pretty text-sm text-ink-muted">
              {touched
                ? 'Foi isso. Dois toques entre fazer e registrar, e o resto do app já sabe: o histórico, a meta do dia e a sequência somam sozinhos.'
                : 'Toca num valor. Nada aqui é print: é a mesma lógica que roda no app.'}
            </p>

            {touched ? (
              <button
                type="button"
                onClick={() => setLog(EMPTY_LOG)}
                className="mt-4 text-sm text-ink-faint underline-offset-4 transition-colors hover:text-ink-muted hover:underline"
              >
                Limpar e testar outra área
              </button>
            ) : null}

            <p aria-live="polite" className="sr-only">
              {touched
                ? `${type.label}: ${formatUnit(type, total)} de ${formatUnit(type, goal)} hoje.`
                : ''}
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <PhoneMockup>
            <MockHeader title={type.label} subtitle="Hoje" />

            <MockCard>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-muted">Meta do dia</span>
                <span className="text-sm font-medium text-ink">
                  {total} de {formatUnit(type, goal)}
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-hi">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ backgroundColor: type.colorToken }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                {progress >= 1 ? 'Meta batida. A sequência de hoje tá salva.' : 'Sequência · 12 dias'}
              </p>
            </MockCard>

            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Histórico
            </p>

            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {entries.map((entry) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <MockCard className="flex items-center gap-2.5 p-3">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: type.colorToken }}
                      />
                      <span className="text-sm text-ink">
                        {type.verb} {formatUnit(type, entry.value)}
                      </span>
                    </MockCard>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {!touched ? (
              <p className="rounded-2xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-ink-faint">
                Nada registrado ainda
              </p>
            ) : null}
          </PhoneMockup>
        </Reveal>
      </div>
    </Section>
  )
}

function AxisChip({
  type,
  active,
  onSelect,
}: {
  type: ActivityType
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={active ? { borderColor: type.colorToken } : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
        active ? 'bg-surface-hi text-ink' : 'border-line text-ink-muted hover:text-ink',
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full"
        style={{ backgroundColor: type.colorToken }}
      />
      {type.label}
    </button>
  )
}
