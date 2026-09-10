import { AxisMarquee } from '@/presentation/components/landing/AxisMarquee'
import { AxisPlayground } from '@/presentation/components/landing/AxisPlayground'
import { Faq } from '@/presentation/components/landing/Faq'
import { Hero } from '@/presentation/components/landing/Hero'
import { HowItWorks } from '@/presentation/components/landing/HowItWorks'
import { Problem } from '@/presentation/components/landing/Problem'
import { Pro } from '@/presentation/components/landing/Pro'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { SoloFirst } from '@/presentation/components/landing/SoloFirst'

/**
 * A ordem é um argumento, não um catálogo: promessa → o problema que ninguém
 * tinha nomeado → como o app resolve → a prova jogável → a objeção do app
 * vazio → preço → dúvidas.
 *
 * Quatro seções (ValueProps, FeatureShowcase, ScrollFeatures, WhyMomentumm)
 * repetiam as mesmas três ideias e viraram HowItWorks + AxisPlayground.
 * Results saiu: seção de "resultados reais" com card vazio anuncia produto sem
 * usuário. O esqueleto dela continua no git, é só voltar quando houver gente
 * de verdade pra citar.
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
        <Problem />
        <HowItWorks />
        <AxisPlayground />
        <SoloFirst />
        <Pro />
        <Faq />
      </main>

      <SiteFooter />
    </div>
  )
}
