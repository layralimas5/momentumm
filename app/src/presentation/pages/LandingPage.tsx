import { AxisMarquee } from '@/presentation/components/landing/AxisMarquee'
import { Faq } from '@/presentation/components/landing/Faq'
import { FeatureShowcase } from '@/presentation/components/landing/FeatureShowcase'
import { Hero } from '@/presentation/components/landing/Hero'
import { Pro } from '@/presentation/components/landing/Pro'
import { Results } from '@/presentation/components/landing/Results'
import { ScrollFeatures } from '@/presentation/components/landing/ScrollFeatures'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { ValueProps } from '@/presentation/components/landing/ValueProps'
import { WhyMomentumm } from '@/presentation/components/landing/WhyMomentumm'

/**
 * Ordem das seções espelhando a referência (fitfolio.com.br):
 * header → hero → faixa de eixos → proposta de valor → features com mockup →
 * celular que troca no scroll → por que escolher → resultados → PRO → FAQ →
 * rodapé.
 *
 * Oculto por ora: <Gallery /> ("Na prática"). O componente segue em
 * components/landing/Gallery.tsx, é só voltar a importar quando quiser mostrar.
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
        <AxisMarquee />
        <ValueProps />
        <FeatureShowcase />
        <ScrollFeatures />
        <WhyMomentumm />
        <Results />
        <Pro />
        <Faq />
      </main>

      <SiteFooter />
    </div>
  )
}
