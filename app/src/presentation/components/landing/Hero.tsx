import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { trackLanding } from './landing-analytics'
import { CTA } from './site'
import { useOffer } from './use-offer'
import { useSiteCta } from './use-site-cta'

/**
 * O hero.
 *
 * A primeira frase é a dor, não o produto: quem chega de um carrossel sobre
 * "eu começo e abandono" precisa reconhecer a própria conversa antes de ler
 * o que o app faz. A explicação do produto ("objetivo vira plano") desceu
 * pra linha de apoio, onde ela confirma a promessa em vez de abrir a página
 * com um conceito.
 *
 * ## Por que é tudo centralizado e sem recorte do produto
 *
 * O hero é dor, solução e botão, nessa ordem, em qualquer tela. Um card da
 * tela Hoje ao lado disputava o olhar com o título, e o produto já aparece
 * inteiro mais abaixo, na seção da tela de todo dia.
 */

/** A copy padrão. Com `?oferta=` no link, a oferta em teste assume (ver `offers.ts`). */
const DEFAULT_LINES = ['Pare de recomeçar', 'toda segunda-feira.'] as const
const DEFAULT_SUBTITLE =
  'O Momentumm transforma sua meta em um plano possível, mostra o que realmente importa hoje e ajuda você a continuar quando a rotina sai do eixo.'

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const cta = useSiteCta('lp-hero')
  const offer = useOffer()
  const lines = offer?.lines ?? DEFAULT_LINES
  const subtitle = offer?.subtitle ?? DEFAULT_SUBTITLE
  const reassurance = cta.signedIn
    ? 'Você já tem conta. O plano de hoje te espera.'
    : CTA.reassurance

  return (
    <section id="home" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[48rem] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-8 sm:pt-36 lg:pb-20 xl:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
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
              onClick={() => trackLanding('hero_cta_clicked')}
              className="pulse-button inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
            >
              {cta.primary.label}
              {cta.signedIn ? null : <ArrowIcon />}
            </Link>

            <Link
              to={CTA.secondary.to}
              onClick={() => trackLanding('secondary_cta_clicked')}
              className="pulse-on-hover inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full border border-line-hi px-7 font-medium text-ink transition-colors hover:bg-surface-hi sm:w-auto"
            >
              {CTA.secondary.label}
            </Link>
          </motion.div>

          <p className="mt-6 text-sm text-ink-muted">{reassurance}</p>

          {/* A explicação do produto, agora como apoio: confirma a promessa sem disputar o título. */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 text-pretty text-sm font-medium tracking-wide text-ink-muted sm:text-base"
          >
            Objetivo vira plano. Plano vira ação.{' '}
            <span className="text-brand-hi">Ação vira progresso.</span>
          </motion.p>
        </div>
      </div>
    </section>
  )
}

/* Seta pra frente, não a diagonal de link externo: o plano é a página seguinte. */
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
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  )
}
