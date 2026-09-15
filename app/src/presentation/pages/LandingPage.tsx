import { Comparison } from '@/presentation/components/landing/Comparison'
import { Faq } from '@/presentation/components/landing/Faq'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { Hero } from '@/presentation/components/landing/Hero'
import { MomentumAi } from '@/presentation/components/landing/MomentumAi'
import { MomentumScore } from '@/presentation/components/landing/MomentumScore'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { Problem } from '@/presentation/components/landing/Problem'
import { Screens } from '@/presentation/components/landing/Screens'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { StickyCta } from '@/presentation/components/landing/StickyCta'
import { Testimonials } from '@/presentation/components/landing/Testimonials'

/**
 * Cada seção responde uma pergunta que a anterior deixou aberta; se
 * responde a mesma, é corte. Promessa → a dor que ninguém nomeia (o plano
 * ideal não sobrevive ao dia real) → o produto, que é a prova: as seis telas
 * já contam o ciclo inteiro, então não existe seção de "método" separada →
 * o número que mede ritmo → a IA que monta e lê → a comparação, quando a
 * pessoa já viu o produto e consegue comparar → prova social colada no
 * preço, que é onde ela decide → preço → dúvidas → o convite.
 *
 * No celular a `StickyCta` acompanha a rolagem inteira; no desktop o header
 * faz esse papel. Por isso não há CTA solto entre seções.
 *
 * `Testimonials` é vitrine (ver testimonials-data.ts) até haver usuários pra
 * citar.
 */
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo">
        <Hero />
        <Problem />
        <Screens />
        <MomentumScore />
        <MomentumAi />
        <Comparison />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  )
}
