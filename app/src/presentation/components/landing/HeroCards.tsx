import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Quatro recortes do app flutuando ao redor da promessa: o score, a semana,
 * os minutos por dia e a lista de hoje. São ilustrações estáticas com os
 * mesmos números do exemplo usado na seção de telas, pra pessoa reconhecer
 * o mesmo caso quando rolar. Nada aqui lê o domínio: é vitrine.
 */

const EASE = [0.22, 1, 0.36, 1] as const

interface FloatingCardProps {
  readonly children: ReactNode
  readonly className?: string
  readonly tilt: number
  readonly delay: number
}

export function FloatingCard({ children, className, tilt, delay }: FloatingCardProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: tilt }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={cn(
        'rounded-2xl border border-line-hi bg-surface/90 p-4 shadow-2xl shadow-black/50 backdrop-blur',
        className,
      )}
    >
      {reduced ? (
        children
      ) : (
        <motion.div
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 3.2, delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  )
}

export function ScoreCard() {
  const score = 82
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div className="w-44">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink">Momentum Score</p>
        <span className="text-[10px] text-ink-faint">28 dias</span>
      </div>
      <div className="mt-3 grid place-items-center">
        <svg viewBox="0 0 88 88" className="size-24" aria-hidden="true">
          <circle
            cx="44"
            cy="44"
            r={radius}
            className="stroke-surface-top"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            className="stroke-brand-hi"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 44 44)"
          />
          <text x="44" y="48" textAnchor="middle" className="fill-ink text-[18px] font-semibold">
            {score}
          </text>
        </svg>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-muted">
        Ritmo de pé, mesmo com 2 dias fracos
      </p>
    </div>
  )
}

const WEEK_STATS = [
  { value: '5/7', label: 'dias cumpridos' },
  { value: '82%', label: 'do plano' },
  { value: '12', label: 'dias seguidos' },
  { value: '3', label: 'hábitos ativos' },
] as const

export function WeekCard() {
  return (
    <div className="w-48">
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-positive" />
        <p className="text-xs font-medium text-ink">Semana atual</p>
      </div>
      <p className="mt-0.5 text-[10px] text-ink-faint">Objetivo: terminar o curso</p>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {WEEK_STATS.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-surface-hi px-2.5 py-2">
            <dd className="text-sm font-semibold text-ink">{stat.value}</dd>
            <dt className="text-[10px] text-ink-faint">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  )
}

const MINUTES = [
  { day: 'S', value: 40 },
  { day: 'T', value: 55 },
  { day: 'Q', value: 20 },
  { day: 'Q', value: 60 },
  { day: 'S', value: 45 },
  { day: 'S', value: 0 },
  { day: 'D', value: 30 },
] as const

export function MinutesCard() {
  const max = Math.max(...MINUTES.map((entry) => entry.value))
  const total = MINUTES.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="w-52">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink">Minutos por dia</p>
        <span className="rounded-full bg-brand-dim px-1.5 py-0.5 text-[10px] font-medium text-brand-ink">
          {total} min
        </span>
      </div>
      <div className="mt-3 flex h-24 gap-1.5">
        {MINUTES.map((entry, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-sm',
                  entry.value === max
                    ? 'bg-brand-hi'
                    : entry.value === 0
                      ? 'bg-surface-top'
                      : 'bg-brand/50',
                )}
                style={{ height: `${Math.max(6, (entry.value / max) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-ink-faint">{entry.day}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">Quarta caiu e o plano encolheu sozinho.</p>
    </div>
  )
}

const TODAY = [
  { label: 'Módulo 4: revisar aula', done: true, main: true },
  { label: 'Ler 12 páginas', done: true, main: false },
  { label: 'Treino leve, 20 min', done: false, main: false },
] as const

export function TodayCard() {
  return (
    <div className="w-52">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink">Hoje</p>
        <span className="text-[10px] text-ink-faint">2 de 3</span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {TODAY.map((item) => (
          <li
            key={item.label}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px]',
              item.main ? 'bg-brand-dim/60 text-ink' : 'bg-surface-hi text-ink-muted',
            )}
          >
            <span
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full border',
                item.done ? 'border-positive bg-positive text-canvas' : 'border-line-hi',
              )}
              aria-hidden="true"
            >
              {item.done ? (
                <svg
                  viewBox="0 0 24 24"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : null}
            </span>
            <span className={cn(item.done && 'line-through decoration-ink-faint')}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
