import { Adaptive } from '@/presentation/components/landing/Adaptive'
import { Faq } from '@/presentation/components/landing/Faq'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { Hero } from '@/presentation/components/landing/Hero'
import { HowItWorks } from '@/presentation/components/landing/HowItWorks'
import { MomentumAi } from '@/presentation/components/landing/MomentumAi'
import { Objectives } from '@/presentation/components/landing/Objectives'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { Problem } from '@/presentation/components/landing/Problem'
import { Progress } from '@/presentation/components/landing/Progress'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { StickyCta } from '@/presentation/components/landing/StickyCta'
import { Today } from '@/presentation/components/landing/Today'
import { useLandingView } from '@/presentation/components/landing/landing-analytics'

/**
 * A página é uma conversa, na ordem em que ela acontece.
 *
 * 1. A dor, na primeira frase: "pare de recomeçar toda segunda".
 * 2. O ciclo que ela reconhece, terminando em "recomeça".
 * 3. Como o produto quebra esse ciclo, em quatro momentos com tela.
 * 4. A semana ruim, que é onde todo outro app falha. É o centro da página.
 * 5. A tela de todo dia, grande e sem legenda.
 * 6. O número que mostra constância sem punir uma falha.
 * 7. A IA, vendida pelo que resolve.
 * 8. Só então a amplitude: serve pra qualquer objetivo.
 * 9. Preço, dúvidas, convite.
 *
 * O que saiu e por quê: a seção de método (o ciclo explicado em seis passos)
 * e a de telas (seis abas com print) diziam a mesma coisa que "como funciona"
 * e "a tela de hoje", só que em vocabulário de documentação. A comparação com
 * Notion e habit tracker posicionava o produto contra ferramentas em vez de
 * contra o problema. Os depoimentos já tinham saído por não existirem pessoas
 * reais pra citar, e as garantias viraram três linhas coladas no preço, que é
 * onde o risco realmente aparece.
 *
 * Um CTA só na página inteira ("Criar meu plano", ver `site.ts`), repetido no
 * header, no hero, no meio, no preço, na barra do celular e no fim.
 */
export function LandingPage() {
  useLandingView()

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
        <HowItWorks />
        <Adaptive />
        <Today />
        <Progress />
        <MomentumAi />
        <Objectives />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  )
}
