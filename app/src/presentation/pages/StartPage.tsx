import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/presentation/auth/use-auth'
import { Wordmark } from '@/presentation/components/brand/Logo'
import { useSiteCta } from '@/presentation/components/landing/use-site-cta'

/**
 * A porta de entrada: uma tela, uma decisão.
 *
 * É o destino dos anúncios e a abertura do app instalado. Em vez de uma
 * landing inteira, ela pergunta só uma coisa: você está começando agora ou
 * já tem conta? Quem começa vai pro quiz, que monta o plano antes de pedir
 * cadastro; quem tem conta vai pro login. Com sessão aberta, a pergunta nem
 * aparece: vai direto pro app.
 *
 * O destaque é de quem está chegando. Quem já é cliente acha a porta dele
 * sem precisar de cor.
 *
 * No celular os botões ficam no rodapé, na altura do polegar, como a primeira
 * tela de um app. Do `sm` pra cima eles sobem pra logo abaixo do texto, que
 * num monitor largo o rodapé fica longe demais do olho.
 */

const EASE = [0.22, 1, 0.36, 1] as const

export function StartPage() {
  const { loading } = useAuth()
  const cta = useSiteCta('inicio')

  if (loading) return <div className="min-h-dvh bg-canvas" />
  if (cta.signedIn) return <Navigate to="/app" replace />

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-canvas px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:justify-center sm:px-8">
      <Backdrop />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center sm:flex-none">
        <Reveal delay={0}>
          <Wordmark className="w-48 sm:w-56" />
        </Reveal>

        <Reveal delay={0.28}>
          <h1 className="mt-10 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Pare de recomeçar.{' '}
            <span className="block text-brand-hi">Comece a continuar.</span>
          </h1>
        </Reveal>

        <Reveal delay={0.42}>
          <p className="mx-auto mt-5 max-w-sm text-pretty text-base text-ink-muted sm:text-lg">
            Sua meta vira um plano possível, e o plano vira o que fazer hoje.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.6} className="mx-auto w-full max-w-md sm:mt-12">
        <div className="flex flex-col gap-3">
          <Link
            to={cta.primary.to}
            className="pulse-button inline-flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-base font-semibold text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hi"
          >
            Quero começar
          </Link>
          {cta.entry ? (
            <Link
              to={cta.entry.to}
              className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-surface/60 text-base font-medium text-ink backdrop-blur transition-colors hover:border-line-hi hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hi"
            >
              Já tenho conta
            </Link>
          ) : null}
        </div>
        <p className="mt-4 text-center text-sm text-ink-faint">Grátis e sem cartão.</p>
      </Reveal>
    </main>
  )
}

interface RevealProps {
  readonly delay: number
  readonly className?: string
  readonly children: ReactNode
}

/** A entrada em cascata: cada peça sobe um pouco depois da anterior. */
function Reveal({ delay, className, children }: RevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * O fundo: uma grade que some nas bordas e um brilho da marca que anda
 * devagar. Tudo em CSS e tokens, então funciona no tema claro e não custa
 * download. Com movimento reduzido, o brilho fica parado.
 */
function Backdrop() {
  const reduceMotion = useReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
        }}
      />
      {/*
        Gradiente radial e não `blur`: um filtro de 120px num elemento que se
        move é caro no celular e, no Chrome, chegou a sumir com o símbolo da
        marca na hora de compor a tela.
      */}
      <motion.div
        className="absolute left-1/2 top-1/3 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--color-brand) 28%, transparent) 0%, transparent 65%)',
        }}
        animate={reduceMotion ? false : { x: [0, 60, -40, 0], y: [0, -30, 40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
