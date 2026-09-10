import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

/**
 * O posicionamento inteiro cabe nessas duas linhas: app de hábito pergunta se
 * você fez, o Momentumm registra quanto. Ele abria com a lista de eixos, que é
 * o argumento fraco — agregador qualquer um é.
 */
const LINES = ['Não é se você fez.', 'É quanto você fez.'] as const

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
          Leitura, estudo, treino e meditação viram número que acumula, na mesma linha do tempo. O
          que o Strava fez com a corrida, pro resto do que você constrói.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-9 flex flex-col items-center gap-5"
        >
          <Link
            to="/entrar"
            className="inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-xl bg-brand px-8 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
          >
            <BoltIcon />
            Começar grátis
          </Link>

          {/* Secundário vira link de texto: dois botões do mesmo peso dividiam o clique. */}
          <Link
            to="/app"
            className="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Ver por dentro, sem criar conta
          </Link>
        </motion.div>

        <p className="mt-6 text-sm text-ink-faint">
          Funciona no navegador. Sem cartão pra começar.
        </p>
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
