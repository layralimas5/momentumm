import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { CTA } from './site'
import { useOffer } from './use-offer'
import { useSiteCta } from './use-site-cta'

/**
 * O hero.
 *
 * Título, uma frase, dois botões e a esteira das áreas. O app de verdade
 * aparece logo abaixo, na seção do Momentumm Score, onde o número na tela
 * tem contexto; aqui em cima ele só empurrava o botão pra baixo.
 */

/** A copy padrão. Com `?oferta=` no link, a oferta em teste assume (ver `offers.ts`). */
const DEFAULT_LINES = ['Objetivo vira plano.', 'Plano vira o que você faz hoje.'] as const
const DEFAULT_SUBTITLE =
  'Você diz o que quer alcançar e quanto tempo tem livre por dia. O Momentumm monta o plano, te entrega a ação de hoje e ajusta quando a semana não sai como o planejado.'

const EASE = [0.22, 1, 0.36, 1] as const

/** A fila de "logos" do hero: aqui são as áreas que o app atende, cada uma com o próprio ícone. */
const AREAS: readonly { readonly label: string; readonly icon: IconName }[] = [
  { label: 'Estudo', icon: 'formatura' },
  { label: 'Leitura', icon: 'livro' },
  { label: 'Treino', icon: 'halter' },
  { label: 'Meditação', icon: 'lotus' },
  { label: 'Concurso', icon: 'trofeu' },
  { label: 'Projeto pessoal', icon: 'objetivo' },
  { label: 'Idioma', icon: 'globo' },
  { label: 'Carreira', icon: 'plano' },
]

export function Hero() {
  const cta = useSiteCta()
  const offer = useOffer()
  const lines = offer?.lines ?? DEFAULT_LINES
  const subtitle = offer?.subtitle ?? DEFAULT_SUBTITLE
  const primaryLabel = cta.signedIn ? cta.primary.label : (offer?.cta ?? cta.primary.label)
  const reassurance = cta.signedIn
    ? 'Você já tem conta. O plano de hoje te espera.'
    : (offer?.reassurance ?? CTA.reassurance)

  return (
    <section id="home" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[48rem] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-[90rem] px-4 pb-16 pt-28 sm:px-8 sm:pt-36 lg:pb-24 xl:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-sm text-ink-muted backdrop-blur"
          >
            <Icon name="raio" className="size-3.5 text-brand-hi" />
            <span>
              <span className="font-medium text-ink">{TRIAL_DAYS} dias de PRO grátis</span>, sem cartão
            </span>
          </motion.p>

          <h1 className="mt-7 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
            {lines.map((line, index) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
                className={cn('block', index === lines.length - 1 && 'text-brand-hi')}
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mx-auto mt-6 max-w-[560px] text-pretty text-lg text-ink-muted"
          >
            {subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              to={cta.primary.to}
              className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
            >
              {primaryLabel}
            </Link>

            {cta.signedIn ? null : (
              <Link
                to={CTA.secondary.to}
                className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full border border-line-hi px-7 font-medium text-ink transition-colors hover:bg-surface-hi sm:w-auto"
              >
                {CTA.secondary.label}
                <ArrowIcon />
              </Link>
            )}
          </motion.div>

          <p className="mt-6 text-sm text-ink-faint">{reassurance}</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mx-auto mt-14 max-w-4xl text-center"
        >
          <p className="text-sm font-medium text-ink">Serve pra qualquer objetivo com prazo</p>
          {/*
            Uma fileira só, correndo pra esquerda sem fim: cabe em qualquer
            largura sem virar pilha de ícones. A lista é duplicada e o
            deslocamento é de metade da faixa, a mesma esteira dos depoimentos.
            Quem prefere menos movimento vê a fileira parada.
          */}
          <div className="marquee-fade mt-6 overflow-hidden" aria-label="Áreas que o Momentumm atende">
            <ul className="flex w-max animate-marquee [animation-duration:32s] motion-reduce:animate-none">
              {[0, 1].map((copy) => (
                <li key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-x-10 pr-10">
                  {AREAS.map((area) => (
                    <span
                      key={area.label}
                      className="inline-flex shrink-0 items-center gap-2 text-base font-medium whitespace-nowrap text-ink-muted"
                    >
                      <Icon name={area.icon} className="size-5" />
                      {area.label}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}
