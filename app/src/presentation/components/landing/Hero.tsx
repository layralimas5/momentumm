import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const LINES = ['Cada página', 'Cada treino', 'Juntos'] as const

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      {/* O brilho sobe além do topo pra passar por trás do menu transparente. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-52 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
      />

      <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-32 text-center sm:pb-28 sm:pt-40">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" />
          Primeiras vagas abertas
        </motion.p>

        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
          {LINES.map((line, index) => (
            <motion.span
              key={line}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="block"
            >
              {index === LINES.length - 1 ? (
                <span className="bg-gradient-to-r from-brand-hi to-flame bg-clip-text text-transparent">
                  {line}
                </span>
              ) : (
                line
              )}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-6 max-w-xl text-pretty text-lg text-ink-muted"
        >
          Leitura, estudo, treino, meditação e comunidade num app só, pra manter constância todos
          os dias.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            to="/entrar"
            className="inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-brand px-7 text-white transition-colors hover:bg-brand-hi sm:w-auto"
          >
            <BoltIcon />
            <span className="text-left leading-tight">
              <span className="block text-[10px] uppercase tracking-wide opacity-80">Comece</span>
              <span className="block font-medium">Grátis agora</span>
            </span>
          </Link>

          <Link
            to="/app"
            className="inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-xl border border-line px-7 text-ink transition-colors hover:border-line-hi sm:w-auto"
          >
            <EyeIcon />
            <span className="text-left leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-ink-faint">Conheça</span>
              <span className="block font-medium">Ver por dentro</span>
            </span>
          </Link>
        </motion.div>

        <p className="mt-4 text-sm text-ink-faint">Funciona no navegador. Sem cartão pra começar.</p>
      </div>
    </section>
  )
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
