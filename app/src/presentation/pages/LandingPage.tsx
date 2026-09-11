import { Benefits } from '@/presentation/components/landing/Benefits'
import { Comparison } from '@/presentation/components/landing/Comparison'
import { Faq } from '@/presentation/components/landing/Faq'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { Hero } from '@/presentation/components/landing/Hero'
import { Method } from '@/presentation/components/landing/Method'
import { MomentumAi } from '@/presentation/components/landing/MomentumAi'
import { MomentumScore } from '@/presentation/components/landing/MomentumScore'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { Problem } from '@/presentation/components/landing/Problem'
import { Screens } from '@/presentation/components/landing/Screens'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'

/**
 * A ordem é um argumento, não um catálogo: promessa → a dor que ninguém
 * nomeia (o plano ideal não sobrevive ao dia real) → o método que responde a
 * isso → por que as outras ferramentas não respondem → as telas → o número
 * que mede ritmo → a IA que monta e lê → o que só existe aqui → preço →
 * dúvidas → o convite.
 *
 * Nada aqui é "resultados reais" com card vazio: seção de prova social entra
 * quando houver gente de verdade pra citar.
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
        <Method />
        <Comparison />
        <Screens />
        <MomentumScore />
        <MomentumAi />
        <Benefits />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  )
}
