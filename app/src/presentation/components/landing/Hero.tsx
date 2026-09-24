import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { trackLanding } from './landing-analytics'
import { MockCard, MockLabel } from './PhoneMockup'
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
 * ## Por que o texto sai do centro no desktop
 *
 * Centralizado, o hero era texto puro sobre preto e sobrava ar dos dois
 * lados. Em duas colunas o mesmo texto ocupa a esquerda e a direita mostra o
 * que a pessoa vai receber: UM recorte, não uma vitrine de cards flutuantes.
 * É a única prova de produto acima da dobra, e uma basta.
 *
 * No celular ele continua centralizado e sem o recorte: ali a ordem é dor,
 * solução, botão, e qualquer coisa no meio empurra o CTA pra fora da tela.
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
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
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
              className="mx-auto mt-6 max-w-[560px] text-pretty text-lg text-ink-muted lg:mx-0"
            >
              {subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
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

          <HeroGlimpse />
        </div>
      </div>
    </section>
  )
}

/**
 * O recorte do produto: a pergunta que a tela Hoje responde, e a resposta.
 *
 * Um card só, sem inclinação e sem moldura de celular. A moldura viria com
 * status bar, notch e barra de navegação, três coisas pra olhar antes da
 * única que importa aqui: o passo de hoje.
 */
function HeroGlimpse() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
      aria-hidden="true"
      className="relative hidden lg:block"
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-brand/10 blur-3xl"
      />
      <div className="relative rounded-card border border-line bg-surface p-6 shadow-2xl shadow-black/50">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink">Hoje</p>
          <p className="text-xs text-ink-faint">Terça, 9 de setembro</p>
        </div>

        <MockLabel>Sua prioridade</MockLabel>
        <MockCard tone="brand">
          <p className="text-[10px] text-ink-faint">Objetivo: Terminar o TCC · Etapa: Rascunho</p>
          <p className="mt-1 text-sm font-medium text-ink">Escrever a seção de métodos</p>
          <p className="mt-1.5 text-[11px] text-ink-muted">
            Versão mínima: abrir o arquivo e escrever 200 palavras
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-medium text-white">
              Começar
            </span>
            <span className="text-[10px] text-ink-faint">45 min previstos</span>
          </div>
        </MockCard>

        <p className="mt-4 text-xs text-ink-faint">
          Uma ação por dia. O resto do plano espera a vez.
        </p>
      </div>
    </motion.div>
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
