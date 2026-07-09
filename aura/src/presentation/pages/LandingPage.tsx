import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { Hero } from '@/presentation/components/landing/Hero'
import { Empathy } from '@/presentation/components/landing/Empathy'
import { HowItWorks } from '@/presentation/components/landing/HowItWorks'
import { ProductTour } from '@/presentation/components/landing/ProductTour'
import { WhyAura } from '@/presentation/components/landing/WhyAura'
import { Visualize } from '@/presentation/components/landing/Visualize'
import { NoMoreMotivation } from '@/presentation/components/landing/NoMoreMotivation'
import { Manifesto } from '@/presentation/components/landing/Manifesto'
import { Pricing } from '@/presentation/components/landing/Pricing'
import { FinalCta } from '@/presentation/components/landing/FinalCta'
import { Faq } from '@/presentation/components/landing/Faq'
import { ClosingCta } from '@/presentation/components/landing/ClosingCta'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'

export function LandingPage() {
  return (
    <div className="min-h-svh bg-black text-white antialiased">
      <SiteHeader />
      <main>
        <Hero />
        <Empathy />
        <HowItWorks />
        <ProductTour />
        <WhyAura />
        <Visualize />
        <NoMoreMotivation />
        <Manifesto />
        <Pricing />
        <FinalCta />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  )
}
