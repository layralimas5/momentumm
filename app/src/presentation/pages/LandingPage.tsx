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
import { StickyCta } from '@/presentation/components/landing/StickyCta'
import { Trust } from '@/presentation/components/landing/Trust'

/**
 * A ordem é um argumento, não um catálogo: promessa → prova social logo
 * abaixo, antes de qualquer explicação (quem chega desconfiado precisa ver
 * gente antes de ler método) → a dor que ninguém nomeia (o plano ideal não
 * sobrevive ao dia real) → o método que responde a isso → as telas → o
 * número que mede ritmo → a IA que monta e lê → só ENTÃO a comparação,
 * quando a pessoa já viu o produto e consegue comparar → o que sustenta a
 * promessa, colado no preço pra reduzir o risco na hora de decidir → preço
 * → dúvidas → o convite.
 *
 * Os CTAs no meio existem porque do hero aos planos são milhares de pixels:
 * quem se convence nas telas ou no score não deveria precisar rolar até o
 * fim. No celular, `StickyCta` faz o mesmo papel de forma permanente.
 *
 * Sem depoimentos até existirem relatos reais: depoimento de vitrine numa
 * página que vende assinatura custa mais confiança do que rende.
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
        <Screens />
        <MomentumScore />
        <MomentumAi />
        <Trust />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  )
}
