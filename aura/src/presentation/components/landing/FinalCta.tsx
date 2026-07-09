import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'
import { CtaButton } from '@/presentation/components/landing/CtaButton'

/** CTA final repetido — mesma ação e mesmo verbo do hero (CRO). */
export function FinalCta() {
  return (
    <Section>
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-6 py-16 text-center md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-30%] h-80 w-[560px] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-500/30 to-blush-500/25 blur-[100px]"
          />
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            A segunda-feira perfeita não vem.
          </h2>

          <div className="mx-auto mt-6 max-w-md space-y-1.5 text-lg leading-relaxed text-zinc-400">
            <p>O mês perfeito também não.</p>
            <p>E talvez você nunca acorde se sentindo 100% pronta para começar.</p>
          </div>

          <p className="mx-auto mt-6 max-w-md text-pretty text-lg text-zinc-300">
            Mas você não precisa esperar. Hoje já serve. Dê o primeiro passo agora — daqui a
            um mês, você vai agradecer por ter começado.
          </p>

          <div className="mt-9 flex justify-center">
            <CtaButton />
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
