import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ACTIVITY_TYPE_LIST } from '@/domain/entities/activity-type'
import { Wordmark } from '@/presentation/components/brand/Logo'

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Wordmark className="text-base" />
        <Link
          to="/entrar"
          className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm font-medium text-brand-hi">Sua evolução, registrada</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            O que o Strava é pra corrida, o Momentumm é pra quem quer crescer.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            Leitura, estudo, treino e meditação no mesmo lugar. Você registra em dois toques,
            acompanha a sequência e vê a evolução virar número.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/entrar"
              className="inline-flex h-13 items-center justify-center rounded-xl bg-brand px-6 font-medium text-white transition-colors hover:bg-brand-hi"
            >
              Começar agora
            </Link>
            <Link
              to="/app"
              className="inline-flex h-13 items-center justify-center rounded-xl border border-line px-6 font-medium text-ink transition-colors hover:border-line-hi"
            >
              Ver por dentro
            </Link>
          </div>
        </motion.div>

        <ul className="mt-16 grid gap-3 sm:grid-cols-2">
          {ACTIVITY_TYPE_LIST.map((type, index) => (
            <motion.li
              key={type.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4"
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: type.colorToken }}
              />
              <span className="text-sm text-ink">
                <span className="font-medium">{type.label}</span>
                <span className="text-ink-muted"> · medido em {type.unitLabel.many}</span>
              </span>
            </motion.li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-ink-faint">
          Começa sozinho e já funciona: sequência, metas e histórico não dependem de mais ninguém.
        </p>
      </main>
    </div>
  )
}
