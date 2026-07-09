import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

/** Projeção futura (future-pacing) — a pessoa se imagina já transformada. */
export function Visualize() {
  return (
    <Section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-96 w-[700px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-600/12 to-blush-500/12 blur-[130px]"
      />

      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Imagine abrir o Aura daqui a 6 meses.
        </h2>

        <div className="mt-8 space-y-2 text-lg leading-relaxed text-zinc-400">
          <p>Aquela meta que parecia distante agora está quase completa.</p>
          <p>Os livros que você dizia que queria ler estão na sua estante.</p>
          <p>Pequenos passos que você nem lembrava estão registrados ali.</p>
        </div>

        <div className="mt-8 space-y-2 text-lg leading-relaxed text-zinc-400">
          <p>Você olha para tudo o que construiu.</p>
          <p>E percebe uma coisa.</p>
        </div>

        <p className="mt-8 text-balance text-2xl font-medium leading-snug text-white md:text-3xl">
          Você não é mais a mesma pessoa que começou.
        </p>

        <div className="mt-8 space-y-2 text-lg leading-relaxed text-zinc-400">
          <p>Não aconteceu de uma vez.</p>
          <p>Não foi uma rotina perfeita.</p>
          <p className="font-medium text-zinc-200">Você só continuou.</p>
        </div>

        <p className="mt-8 text-xl font-medium tracking-tight text-white md:text-2xl">
          Um passo. <span className="text-zinc-500">Depois outro.</span>{' '}
          <span className="text-zinc-600">E outro.</span>
        </p>

        <p className="mx-auto mt-8 max-w-xl text-balance text-lg leading-relaxed text-brand-300">
          Até começar a se tornar quem sempre quis ser.
        </p>
      </Reveal>
    </Section>
  )
}
