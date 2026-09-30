import { Faq } from '@/presentation/components/landing/Faq'
import { Features } from '@/presentation/components/landing/Features'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { ForWhom } from '@/presentation/components/landing/ForWhom'
import { Hero } from '@/presentation/components/landing/Hero'
import { HowItWorks } from '@/presentation/components/landing/HowItWorks'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { StickyCta } from '@/presentation/components/landing/StickyCta'
import { useLandingView } from '@/presentation/components/landing/landing-analytics'

/**
 * A página curta: promessa, pra quem é, o app, como funciona, preço,
 * objeções e convite.
 *
 * Quem chega aqui vem de um carrossel e já sabe a dor. A página não explica
 * o método: mostra a tela real, diz o que muda no dia, mostra o preço e tira
 * o medo. O resto (o ciclo, a retomada, o score, a IA) é conversa do quiz e
 * do próprio app.
 *
 * Um CTA só na página inteira ("Criar meu plano", ver `site.ts`), levando pro
 * quiz: no header, no hero, no preço, na barra do celular e no fim.
 */
export function LandingPage() {
  useLandingView()

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo">
        <Hero />
        <ForWhom />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  )
}
