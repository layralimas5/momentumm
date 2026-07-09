import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'
import { CtaButton } from '@/presentation/components/landing/CtaButton'

/** Fechamento curto e direto — última chamada antes do rodapé. */
export function ClosingCta() {
  return (
    <Section className="pb-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-balance text-2xl font-semibold leading-snug tracking-tight text-white md:text-3xl">
          Você sabe quem quer se tornar.
          <br />
          <span className="bg-gradient-to-r from-brand-300 to-blush-400 bg-clip-text text-transparent">
            O Aura te ajuda a chegar lá.
          </span>
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton />
        </div>
      </Reveal>
    </Section>
  )
}
