import { Section } from '@/presentation/components/landing/Section'
import { Reveal } from '@/presentation/components/landing/Reveal'

const pains = [
  'Você começa com vontade. Duas semanas depois, já parou.',
  'Compra um livro, lê os primeiros capítulos e ele vira enfeite na estante.',
  'Suas metas estão espalhadas entre cadernos, prints e notas do celular.',
  'E quando o ano termina, você mal lembra de tudo o que conquistou.',
]

/** Seção de empatia — conecta pela dor antes de apresentar a solução (humaniza). */
export function Empathy() {
  return (
    <Section id="empatia" className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[600px] max-w-full -translate-x-1/2 rounded-full bg-brand-600/10 blur-[110px]"
      />
      <Reveal className="mx-auto max-w-3xl text-center">
        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-400">
          Talvez você se reconheça
        </span>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Não é falta de vontade.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-zinc-400">
          É que, no meio da rotina, é fácil perder de vista a vida que você queria construir.
        </p>
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-2">
        {pains.map((pain, i) => (
          <Reveal key={pain} delay={i * 0.06}>
            <p className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left text-zinc-300 hover:aura-pulse">
              {pain}
            </p>
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto mt-14 max-w-2xl text-center">
        <p className="text-balance text-2xl font-medium leading-snug text-white md:text-3xl">
          O problema não é não ter sonhos.
          <br />É não conseguir enxergar a própria jornada.
        </p>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400">
          O Aura existe pra você não se perder de si no caminho. Um lugar calmo, seu, onde
          seus sonhos ganham direção e sua evolução deixa de ser uma promessa distante.
        </p>
        <p className="mt-4 text-lg font-medium text-brand-300">
          Você começa a enxergar quem está se tornando.
        </p>
      </Reveal>
    </Section>
  )
}
