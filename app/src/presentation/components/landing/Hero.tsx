import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { servedPrerendered } from '@/presentation/seo/prerender-snapshot'
import { cn } from '@/shared/lib/cn'
import { HeroBackdrop } from './HeroBackdrop'
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
 * ## A tela do produto vem embaixo, não ao lado
 *
 * O hero é dor, solução, botão e o produto, nessa ordem, em qualquer tela.
 * Um card ao lado do título disputava o olhar com ele; embaixo, a tela real
 * do plano confirma a promessa sem competir. É uma captura do app, nunca
 * ilustração: quem chega precisa ver em cinco segundos o que vai receber.
 */
const HERO_SCREEN = {
  src: '/telas/passo-2-plano.webp',
  alt: 'Plano gerado pelo Momentumm: a meta "ler 12 livros até dezembro" dividida em três marcos com prazo e uma rotina de 3 dias por semana, 20 minutos por vez.',
} as const

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
  // Sem entrada animada pra quem pediu menos movimento, nem quando o HTML
  // pré-renderizado já mostrou o hero pronto.
  const skipIntro = useReducedMotion() === true || servedPrerendered()
  const intro = (delay: number, y = 0) =>
    skipIntro
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        }
  const reassurance = cta.signedIn
    ? 'Você já tem conta. O plano de hoje te espera.'
    : CTA.reassurance

  return (
    <section id="home" className="relative">
      <HeroBackdrop />

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-8 sm:pt-36 lg:pb-20 xl:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
            {lines.map((line, index) => (
              <motion.span
                key={line}
                {...intro(index * 0.08, 14)}
                className={cn('block', index === lines.length - 1 && 'text-brand-hi')}
              >
                {line}
              </motion.span>
            ))}
          </h1>

          <motion.p
            {...intro(0.3)}
            className="mx-auto mt-6 max-w-[560px] text-pretty text-lg text-ink-muted"
          >
            {subtitle}
          </motion.p>

          <motion.div
            {...intro(0.4, 8)}
            className="mt-9 flex flex-col items-center justify-center gap-3"
          >
            <Link
              to={cta.primary.to}
              onClick={() => trackLanding('hero_cta_clicked')}
              className="pulse-button inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white transition-colors hover:bg-brand-hi sm:w-auto"
            >
              {cta.primary.label}
              {cta.signedIn ? null : <ArrowIcon />}
            </Link>

          </motion.div>

          <p className="mt-6 text-sm text-ink-muted">{reassurance}</p>

          {/* A explicação do produto, agora como apoio: confirma a promessa sem disputar o título. */}
          <motion.p
            {...intro(0.6)}
            className="mt-8 text-pretty text-sm font-medium tracking-wide text-ink-muted sm:text-base"
          >
            Objetivo vira plano. Plano vira ação.{' '}
            <span className="text-brand-hi">Ação vira progresso.</span>
          </motion.p>
        </div>

        <motion.figure {...intro(0.5, 24)} className="relative mx-auto mt-12 max-w-[340px] sm:mt-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-10 h-72 rounded-full bg-brand/25 blur-3xl"
          />
          <div className="relative h-[420px] overflow-hidden rounded-t-[2.5rem] border border-b-0 border-line-hi bg-surface p-2.5 pb-0 shadow-2xl shadow-black/40 sm:h-[480px]">
            <img
              src={HERO_SCREEN.src}
              alt={HERO_SCREEN.alt}
              width={780}
              height={1688}
              decoding="async"
              className="block w-full rounded-t-[2rem]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-canvas to-transparent"
            />
          </div>
        </motion.figure>
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
