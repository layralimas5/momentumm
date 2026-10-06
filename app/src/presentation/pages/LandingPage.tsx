import { AdvancedFeatures } from '@/presentation/components/landing/AdvancedFeatures'
import { Faq } from '@/presentation/components/landing/Faq'
import { Features } from '@/presentation/components/landing/Features'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { ForWhom } from '@/presentation/components/landing/ForWhom'
import { Hero } from '@/presentation/components/landing/Hero'
import { Platform } from '@/presentation/components/landing/Platform'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { Problem } from '@/presentation/components/landing/Problem'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { SocialProof } from '@/presentation/components/landing/SocialProof'
import { StickyCta } from '@/presentation/components/landing/StickyCta'
import { WeeklyReview } from '@/presentation/components/landing/WeeklyReview'
import { useLandingView } from '@/presentation/components/landing/landing-analytics'

/**
 * A landing segue a estrutura de dez seções de página de SaaS, nesta ordem:
 * topo, primeira dobra, problema, o app por dentro, recursos avançados,
 * prova social, diferencial, planos, objeções e chamada final com rodapé.
 * Dois acréscimos dentro dela: "pra quem é" fecha o problema (quem se
 * reconhece já se qualificou) e os cards do gratuito fecham o app por dentro,
 * antes do que é do PRO. O topo tem o menu completo, com âncoras pra cada
 * seção.
 *
 * Quem chega aqui vem de um anúncio ou de um carrossel e já sabe a dor. A
 * página mostra a tela real, diz o que muda no dia, mostra o preço e tira o
 * medo. O resto (o ciclo, o score, a IA em detalhe) é conversa do quiz e do
 * próprio app.
 *
 * Um CTA só na página inteira ("Criar meu plano", ver `site.ts`), levando pro
 * quiz: no topo, no hero, no diferencial, no preço, na barra do celular e no
 * fim. A prova social só aparece quando existir depoimento real.
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
        <Problem />
        <ForWhom />
        <Platform />
        <Features />
        <AdvancedFeatures />
        <SocialProof />
        <WeeklyReview />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  )
}
